"""Tests for occupancy_video.py. Run: python -m unittest (needs only OpenCV + NumPy)."""
import os
import tempfile
import unittest

import numpy as np

import occupancy_video as ov

SPOT = {"id": "s1", "x": 0.1, "y": 0.1, "w": 0.3, "h": 0.4}
FACE = (40, 40, 30, 30)  # x, y, w, h in pixels


def noisy_frame():
    rng = np.random.default_rng(7)
    return rng.integers(0, 256, size=(200, 300, 3), dtype=np.uint8)


def car(x, y, w, h, cls="car", score=0.9):
    return {"cls": cls, "score": score, "x": x, "y": y, "w": w, "h": h}


class BlurBeforeProcess(unittest.TestCase):
    def test_detector_only_sees_blurred_pixels(self):
        raw = noisy_frame()
        original = raw.copy()
        seen = []
        privatize = ov.make_privatizer(lambda frame: [FACE])

        def detect(frame):
            x, y, w, h = FACE
            seen.append(frame[y:y + h, x:x + w].copy())
            return []

        list(ov.run([(0.0, raw)], [SPOT], detect, privatize))
        x, y, w, h = FACE
        region = seen[0]
        self.assertFalse(np.array_equal(region, original[y:y + h, x:x + w]))
        # A 3x3 pixelation leaves at most 9 distinct colours across the padded region.
        self.assertLessEqual(len(np.unique(region.reshape(-1, 3), axis=0)), 9)

    def test_privatize_runs_before_detect_on_every_frame(self):
        calls = []
        privatize = lambda f: calls.append("blur") or f
        detect = lambda f: calls.append("detect") or []
        list(ov.run([(0.0, noisy_frame()), (1.0, noisy_frame())], [SPOT], detect, privatize))
        self.assertEqual(calls, ["blur", "detect", "blur", "detect"])

    def test_bundled_cascades_load_offline(self):
        finder = ov.CascadeFinder()
        self.assertTrue(all(not c.empty() for c in finder.cascades))
        self.assertEqual(finder(np.zeros((120, 160, 3), dtype=np.uint8)), [])


class AggregateOnlyOutput(unittest.TestCase):
    def test_rows_hold_only_time_spot_and_state(self):
        rows = list(ov.run([(2.0, noisy_frame())], [SPOT],
                           lambda f: [car(0.15, 0.15, 0.2, 0.3)], lambda f: f))
        self.assertEqual(rows, [{"t": 2.0, "spot": "s1", "occupied": 1}])
        for r in rows:
            self.assertEqual(tuple(r), ov.OUTPUT_FIELDS)
            self.assertTrue(all(isinstance(v, (int, float, str)) for v in r.values()))

    def test_source_never_writes_images(self):
        with open(ov.__file__, encoding="utf-8") as f:
            src = f.read()
        for banned in ("imwrite", "VideoWriter", "imencode", "np.save"):
            self.assertNotIn(banned, src)


class SpotGeometry(unittest.TestCase):
    def test_parked_car_fills_spot(self):
        self.assertTrue(ov.occupied_spots([car(0.15, 0.15, 0.2, 0.3)], [SPOT])["s1"])

    def test_person_and_low_score_do_not(self):
        dets = [car(0.15, 0.15, 0.2, 0.3, cls="person"), car(0.15, 0.15, 0.2, 0.3, score=0.2)]
        self.assertFalse(ov.occupied_spots(dets, [SPOT])["s1"])

    def test_car_clipping_edge_does_not(self):
        self.assertFalse(ov.occupied_spots([car(0.35, 0.1, 0.3, 0.4)], [SPOT])["s1"])

    def test_frame_sized_box_is_ignored(self):
        self.assertFalse(ov.occupied_spots([car(0.0, 0.0, 0.9, 0.9)], [SPOT])["s1"])


class Accuracy(unittest.TestCase):
    def test_matches_nearest_prediction_per_spot(self):
        rows = [{"t": 0.0, "spot": "s1", "occupied": 1}, {"t": 1.0, "spot": "s1", "occupied": 0}]
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("t,spot,occupied\n0.1,s1,1\n0.9,s1,1\n5,s9,0\n")
        try:
            self.assertEqual(ov.accuracy(rows, f.name), (1, 2))
        finally:
            os.unlink(f.name)


if __name__ == "__main__":
    unittest.main()
