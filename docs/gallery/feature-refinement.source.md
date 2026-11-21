# UNetFormer feature-refinement head

Primary source: https://github.com/WangLibo1995/GeoSeg/blob/main/geoseg/models/UNetFormer.py

Locator: FeatureRefinementHead.forward

Scope: Upsampling and normalized weighted skip fusion precede post-convolution. Channel/spatial attention branches gate x; their results add, project and combine with a shortcut before activation.

Source-backed macro redraw, not an official author figure.
