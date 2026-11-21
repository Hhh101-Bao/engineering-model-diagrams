# SegFormer All-MLP decoder

Primary source: https://github.com/NVlabs/SegFormer/blob/master/mmseg/models/decode_heads/segformer_head.py

Locator: SegFormerHead.forward

Scope: Four feature levels are linearly embedded and aligned to the finest stride. Concatenation and1×1 fusion precede class prediction. Decoder embedding width is configurable.

Source-backed macro redraw, not an official author figure.
