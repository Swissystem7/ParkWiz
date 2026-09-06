# Synthetic only — ParkWiz

**Hard label:** demo data is **synthetic**. Manifest and scenes ship with `synthetic: true` and **`fieldMeasured: false`**.

## What that means

| Claim | Status |
| --- | --- |
| Occupancy scenes in `src/lib/dataset.js` / `pilot/dataset/` | Synthetic labeled examples |
| Field measurement vs Netanya inspectors | **Not done** — `fieldMeasured: false` |
| Live municipal camera / ANPR feed | **None** in this repo |

## Do / do not

| Do | Do not |
| --- | --- |
| Keep `fieldMeasured: false` until a signed field protocol exists | Market demo accuracy as field-proven |
| Point partners at DPIA skeleton + paired-inspector kit | Invent camera pilots or live occupancy SKUs |
| Re-run `test/dataset.test.js` after any dataset edit | Strip synthetic / fieldMeasured flags |

## Checklist

- [ ] Dataset manifest: `synthetic: true`, `fieldMeasured: false`
- [ ] Compare / eval copy says synthetic demo, not field study
- [ ] No public claim of measured curb accuracy without a city partner
