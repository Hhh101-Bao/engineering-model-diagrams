# UNetFormer

Primary source: https://github.com/WangLibo1995/GeoSeg/blob/main/geoseg/models/UNetFormer.py

Locator: Decoder.forward inference path; UNetFormer class

Scope: ResNet18 encoder and64-channel decoder. Three global-local blocks at1/32,1/16,1/8; weighted fusion includes upsampling. Feature-refinement head uses1/4 skip; auxiliary training head omitted.

Source-backed macro redraw, not an official author figure.
