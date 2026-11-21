# STANet PAM | official-code inference redraw · 结构与出处

此文件由模型中间表示生成；出处指针需要结合原文/原图核对，自动引用检查不能证明理解正确。

| 模块 | 算子 | 维度 | 状态 | 依据 |
|---|---|---|---|---|
| Date A / RGB | input | 3×256×256 | inferred | sample, shared |
| Date B / RGB | input | 3×256×256 | inferred | sample, shared |
| Shared FCN | custom | 64×64×64 | inferred | shared, extract, backbone, trace |
| Shared FCN | custom | 64×64×64 | inferred | shared, extract, backbone, trace |
| Concat width | custom | 64×64×128 | inferred | temporal |
| PAM 1,2,4,8 | attention | 64×64×128 | inferred | temporal, regions, aggregate |
| Split date A | custom | 64×64×64 | inferred | temporal |
| Split date B | custom | 64×64×64 | inferred | temporal |
| L2 distance | custom | 1×64×64 | inferred | shared |
| Bilinear x4 | upsample | 1×256×256 | inferred | shared |
| Threshold >1 | custom | 1×256×256 | inferred | shared, paper_metric |
| Change mask | output | 1×256×256 | inferred | shared |

## 来源证据

- **scope** · stated · pred_image; lines 54-64：Demo explicitly selects CDFA, mynet3 and PAM.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/demo.py）
- **sample** · inferred · Prepare Datasets, cut bitemporal image pairs：A 256 x 256 RGB input is an illustrative size, not a fixed architecture requirement.；推导：README describes the 256 x 256 non-overlapping patches used in the paper; RGB input follows CDFA netF in_c=3.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/README.md）
- **defaults** · stated · BaseOptions.initialize, lines 33-48：Feature width defaults to 64 and attention downsampling ds defaults to 1.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/options/base_options.py）
- **shared** · stated · CDFAModel.__init__ and forward, lines 39-40 and 85-98：The same netF instance processes A and B, followed by netA; Euclidean feature distance precedes bilinear distance-map resizing, then threshold dist > 1.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/CDFA_model.py）
- **extract** · stated · Decoder.__init__/forward; mynet3.forward, lines 280-348：Four ResNet stage outputs are projected to 96 channels, aligned at quarter resolution, concatenated to 384 channels, followed by 3 x 3 to 256 and 1 x 1 to 64.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/mynet3.py）
- **backbone** · stated · define_F, lines 11-16：Official mynet3 instantiation uses a ResNet-18 based backbone with output_stride=32.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/backbone.py）
- **stages** · stated · ResNet18; ResNet.__init__; ResNet.forward, lines 43-48, 145-180, 220-236：Stem Conv7/2 and MaxPool3/2 precede stage outputs 64,128,256,512 at strides 4,8,16,32. This implementation uses 2,2,2,3 BasicBlocks; the last stage uses dilation multipliers 1,2,4.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/mynet3.py）
- **temporal** · stated · CDSA.__init__/forward, lines 31-47：PAM uses scales [1,2,4,8]. Feature maps are concatenated along width, then split back into dates after attention.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/backbone.py）
- **regions** · stated · _PAMBlock.forward, lines 42-122：Each s x s spatial grid region includes both dates; keys and queries have C/8 channels and values C. Scaled QK similarity is softmax-normalized and used for weighted value aggregation, then region outputs are reassembled.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/PAM2.py）
- **aggregate** · stated · PAM.__init__/forward, lines 134-168：Four context tensors are concatenated on the channel dimension and projected with Conv1x1 from 4C to C. This implementation returns the projected output directly, without an input residual addition.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/PAM2.py）
- **paper_extract** · stated · pp. 6-7, Fig.2(b), section 2.1.2：The paper uses a ResNet-18 based multi-scale feature extractor with 96-channel projections and final 256/64-channel convolutions.（https://doi.org/10.3390/rs12101662）
- **paper_pam** · stated · p.8, Fig.2(d), section 2.1.3：The paper defines four scales {1,2,4,8}, per-region attention, channel concatenation and a final 1x1 convolution followed by residual addition to X.（https://doi.org/10.3390/rs12101662）
- **paper_metric** · stated · p.9, section 2.1.4, Eq.(4)：The paper resizes the two feature maps before Euclidean distance, then thresholds distance at 1. This differs from the code order.（https://doi.org/10.3390/rs12101662）
- **trace** · inferred · ResNet and Decoder.forward, lines 145-180 and 305-320：For the illustrative 256 x 256 input, the inferred quarter-resolution feature tensor is 64 x 64 x 64.；推导：Apply the explicit stride-2 stem, maxpool, stage strides and decoder interpolation to 256 x 256; batch axis is omitted.（https://github.com/justchenhao/STANet/blob/6152d72f55df00a43d341580970be7a58c6b0cd5/models/mynet3.py）

## 待确认

- Scope: fixed official commit 6152d72f55df00a43d341580970be7a58c6b0cd5; CDFA / mynet3 / PAM / f_c=64 / ds=1. This is a sourced redraw, not an official author figure.
- All displayed shapes use one illustrative RGB 256 x 256 input, omit the batch axis, and are inferred from the code. Geometry is compressed and non-proportional.
- The main diagram abstracts the shared feature extractor and PAM. Companion diagrams expand their topology; BN, ReLU, training dropout, individual residual internals, parameter learning, and BCL supervision are omitted.
- Paper/code differences are intentional: paper PAM adds X residually, code PAM2 does not; paper resizes features before distance, code computes distance then resizes it. These alternatives are not combined.
