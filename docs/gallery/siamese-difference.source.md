# Siamese feature differencing

Primary source: https://github.com/justchenhao/BIT_CD/blob/master/models/networks.py

Locator: BASE_Transformer.forward

Scope: Shared feature extraction and absolute elementwise difference; head and interpolation details stay model-specific. Two backbone invocations share weights, not input tensors.

Source-backed macro redraw, not an official author figure.
