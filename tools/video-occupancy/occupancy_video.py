"""ParkWiz: parking occupancy from a recorded video, privacy first (issue #412).

Every frame has faces and licence plates blurred before anything else looks at
it. Only per-spot occupied/free rows leave this process; no frame, crop or box
is ever written to disk or printed. Runs offline on CPU.

Spot geometry mirrors src/lib/vision-occupancy.js (same constants, same
coverage-or-centroid rule), so a calibration drawn in pilot-calibrate.html
scores the same here as in the browser camera demo.
"""
import argparse
import csv
import json
import sys

import cv2

VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle"}
MIN_SCORE = 0.4
OVERLAP = 0.3
MAX_BOX_AREA = 0.45
CENTROID_MIN_INSIDE = 0.5
OUTPUT_FIELDS = ("t", "spot", "occupied")
# OpenCV ships these cascades inside the package, so blurring needs no download.
CASCADES = (
    "haarcascade_frontalface_default.xml",
    "haarcascade_profileface.xml",
    "haarcascade_russian_plate_number.xml",
)


def load_spots(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    spots = data["spots"] if isinstance(data, dict) else data
    return [{"id": str(s["id"]), **{k: float(s[k]) for k in "xywh"}} for s in spots]


class CascadeFinder:
    """Finds faces and plates with OpenCV's bundled Haar cascades."""

    def __init__(self):
        self.cascades = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in CASCADES]

    def __call__(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        found = []
        for cascade in self.cascades:
            for r in cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(12, 12)):
                found.append(tuple(int(v) for v in r))
        return found


def blur_regions(frame, regions):
    """Pixelates each region (plus a margin) in place. 3x3 blocks keep no readable detail."""
    fh, fw = frame.shape[:2]
    for x, y, w, h in regions:
        x0, y0 = max(0, x - w // 4), max(0, y - h // 4)
        x1, y1 = min(fw, x + w + w // 4), min(fh, y + h + h // 4)
        if x1 <= x0 or y1 <= y0:
            continue
        tiny = cv2.resize(frame[y0:y1, x0:x1], (3, 3), interpolation=cv2.INTER_AREA)
        frame[y0:y1, x0:x1] = cv2.resize(tiny, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
    return frame


def make_privatizer(finder):
    return lambda frame: blur_regions(frame, finder(frame))


class YoloDetector:
    """Local YOLO vehicle detector on CPU. Boxes come back normalized 0..1."""

    def __init__(self, model):
        from ultralytics import YOLO  # imported here so the tests need only OpenCV
        self.model = YOLO(model)

    def __call__(self, frame):
        fh, fw = frame.shape[:2]
        res = self.model.predict(frame, device="cpu", verbose=False)[0]
        out = []
        for (x0, y0, x1, y1), cls, score in zip(res.boxes.xyxy.tolist(), res.boxes.cls.tolist(), res.boxes.conf.tolist()):
            out.append({"cls": res.names[int(cls)], "score": float(score),
                        "x": x0 / fw, "y": y0 / fh, "w": (x1 - x0) / fw, "h": (y1 - y0) / fh})
        return out


def spot_score(box, s):
    """Share of the spot the box covers, or 1 when the box sits centred and mostly inside it."""
    ix = max(0.0, min(box["x"] + box["w"], s["x"] + s["w"]) - max(box["x"], s["x"]))
    iy = max(0.0, min(box["y"] + box["h"], s["y"] + s["h"]) - max(box["y"], s["y"]))
    inter, area = ix * iy, s["w"] * s["h"]
    if inter <= 0 or area <= 0:
        return 0.0
    cx, cy = box["x"] + box["w"] / 2, box["y"] + box["h"] / 2
    centred = s["x"] <= cx <= s["x"] + s["w"] and s["y"] <= cy <= s["y"] + s["h"]
    if centred and inter / (box["w"] * box["h"]) >= CENTROID_MIN_INSIDE:
        return 1.0
    return inter / area


def occupied_spots(detections, spots):
    boxes = [d for d in detections
             if d["cls"] in VEHICLE_CLASSES and d["score"] >= MIN_SCORE
             and d["w"] > 0 and d["h"] > 0 and d["w"] * d["h"] <= MAX_BOX_AREA]
    return {s["id"]: any(spot_score(b, s) >= OVERLAP for b in boxes) for s in spots}


def video_frames(path, every_s):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise SystemExit(f"cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, round(fps * every_s))
    i = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            if i % step == 0:
                yield round(i / fps, 2), frame
            i += 1
    finally:
        cap.release()


def run(frames, spots, detect, privatize):
    """Yields aggregate rows only. The frame never leaves this loop."""
    for t, frame in frames:
        frame = privatize(frame)
        for spot_id, occ in occupied_spots(detect(frame), spots).items():
            yield {"t": t, "spot": spot_id, "occupied": int(occ)}


def accuracy(rows, labels_path):
    """Compares each hand label with the prediction for that spot nearest in time."""
    by_spot = {}
    for r in rows:
        by_spot.setdefault(r["spot"], []).append(r)
    hit = total = 0
    with open(labels_path, newline="", encoding="utf-8") as f:
        for lab in csv.DictReader(f):
            cands = by_spot.get(str(lab["spot"]))
            if not cands:
                continue
            t = float(lab["t"])
            pred = min(cands, key=lambda r: abs(r["t"] - t))
            total += 1
            hit += pred["occupied"] == int(lab["occupied"])
    return hit, total


def main(argv=None):
    ap = argparse.ArgumentParser(description="Parking occupancy from a recorded video (aggregates only).")
    ap.add_argument("video")
    ap.add_argument("--spots", required=True, help="calibration JSON, same schema as pilot/sample-spots.json")
    ap.add_argument("--out", default="occupancy.csv")
    ap.add_argument("--every", type=float, default=1.0, help="seconds between sampled frames")
    ap.add_argument("--model", default="yolov8n.pt", help="local YOLO weights")
    ap.add_argument("--labels", help="hand-labelled CSV (t,spot,occupied) for an accuracy report")
    args = ap.parse_args(argv)

    spots = load_spots(args.spots)
    rows = list(run(video_frames(args.video, args.every), spots,
                    YoloDetector(args.model), make_privatizer(CascadeFinder())))
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_FIELDS)
        w.writeheader()
        w.writerows(rows)
    frames = len({r["t"] for r in rows})
    occ = sum(r["occupied"] for r in rows) / len(rows) if rows else 0.0
    print(f"frames={frames} spots={len(spots)} mean_occupancy={occ:.1%} -> {args.out}")
    if args.labels:
        hit, total = accuracy(rows, args.labels)
        print(f"accuracy={hit}/{total}" + (f" ({hit / total:.1%})" if total else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
