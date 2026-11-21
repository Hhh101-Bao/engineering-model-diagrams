# BIT semantic tokenizer

Primary source: https://github.com/justchenhao/BIT_CD/blob/master/models/networks.py

Locator: _forward_semantic_tokens

Scope: A learned1×1 projection creates L spatial attention maps; softmax is over flattened spatial positions. Weighted aggregation of the original features produces L×C tokens.

Source-backed macro redraw, not an official author figure.
