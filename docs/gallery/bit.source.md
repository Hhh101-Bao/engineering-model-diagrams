# BIT · bitemporal transformer

Primary source: https://github.com/justchenhao/BIT_CD/blob/master/models/networks.py

Locator: BASE_Transformer.forward; semantic tokenizer and transformer decoder

Scope: Shared backbone extracts both dates. Joint transformer encodes concatenated semantic tokens, which split by date for two decoder calls. Feature bypasses are preserved. Absolute differencing, upsampling and CNN classification follow.

Source-backed macro redraw, not an official author figure.
