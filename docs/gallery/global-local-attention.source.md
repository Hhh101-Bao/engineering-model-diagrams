# UNetFormer global-local attention

Primary source: https://github.com/WangLibo1995/GeoSeg/blob/main/geoseg/models/UNetFormer.py

Locator: GlobalLocalAttention.forward

Scope: Local1×1+3×3 features are added to window attention with cross-shaped pooling, then projected by separable convolution. Norm/MLP and outer GLTB residuals are outside this inner attention view.

Source-backed macro redraw, not an official author figure.
