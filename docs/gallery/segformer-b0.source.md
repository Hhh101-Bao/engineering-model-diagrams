# SegFormer-B0

Primary source: https://github.com/NVlabs/SegFormer/blob/master/mmseg/models/decode_heads/segformer_head.py

Locator: SegFormerHead.forward; official B0 config

Scope: Four MiT-B0 output levels32/64/160/256. Each decoder projection maps to256 and resizes to1/4. Fusion concat is1024 channels before1×1 fusion and prediction. Final resize shown; encoder internals omitted.

Source-backed macro redraw, not an official author figure.
