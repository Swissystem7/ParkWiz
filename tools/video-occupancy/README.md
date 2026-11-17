# video-occupancy

Measures parking occupancy from a recorded video, offline on CPU (issue #412).
Faces and plates are blurred before any other processing. The output is only `t,spot,occupied` rows. See [PRIVACY.md](PRIVACY.md).

This is a standalone Python tool. The web app stays dependency-free, and `npm test` does not run these tests.

```bash
python -m venv .venv && . .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu   # CPU-only torch, avoids the CUDA download
pip install -r requirements.txt

python occupancy_video.py clip.mp4 --spots ../../pilot/sample-spots.json --out occupancy.csv \
  --every 1 --labels labels.csv
python -m unittest -v
```

- `--spots`: calibration JSON, same schema as `pilot/sample-spots.json` (normalized rectangles; draw one in `pilot-calibrate.html`).
- `--labels`: optional hand-labelled CSV with the same columns as the output. Each label is compared with the prediction for that spot nearest in time, and the accuracy is printed.
- `--model`: local YOLO weights. `yolov8n.pt` downloads once on first run. After that the tool needs no network.
