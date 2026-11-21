# 正式来源模型与模块目录

目录包含14个模型结构示意和14个模块/子网络示意，来源为原论文或作者/官方实现；它们是本工具重绘，不是作者官方出图。每个条目附 source、locator、scope。借鉴 PlotNeuralNet/neural-netz 的体积与标注表达，并加入证据、分离式模块、GLB与五套科研主题。

| 大类 | 模型ID |
|---|---|
| 计算机视觉骨干 | resnet18, mobilenetv2, vit-b16, swin-t |
| 视觉分割/基础模型 | unet-original, deeplabv3plus, segformer-b0, sam |
| 目标检测 | detr |
| 遥感语义分割 | unetformer |
| 遥感变化检测 | bit, changeformer, stanet |
| 视觉语言 | clip |
| 卷积/残差模块 | residual-basic, inverted-residual |
| Transformer模块 | vit-encoder, swin-pair |
| 多尺度模块 | aspp, segformer-mlp |
| 注意力模块 | se, cbam |
| 遥感模块/子网络 | global-local-attention, semantic-tokenizer, siamese-difference, feature-refinement, stanet-pam, stanet-extractor |

```text
node scripts/render-catalog.mjs --list
node scripts/render-catalog.mjs --model unetformer --theme sage-earth --out OUTPUT_PREFIX
```

目录数据在 assets/catalog/definitions.mjs；STANet的详细证据IR在同目录。渲染会交付体积配置、IR、Typst及依赖、PDF/SVG/PNG、GLB与离线三维。宏观模型会分组卷积/归一化/激活等细节，在scope中声明；详细模块单独展开。不得将目录条目当作任意同名模型的精确配置。

特别注意：U-Net条目是原论文valid-padding的572→388结构；其他同名same-padding实现不同。STANet采用固定官方代码版本，PAM残差、距离与插值顺序、末阶段重复次数存在论文/代码差异。ChangeFormer条目是家族宏观概览，不宣称某个V1–V6版本的精确逐层参数。CLIP条目是对比预训练视图，不是推理分割网络。标签中的示例尺寸与符号均需保留其证据性质。

用户要精确复现或不同变体时重新读取其指定来源，逐条核对关键连接、repeat与维度，生成新的IR并走论文工作流。图库用于提供有依据的表达参考，不替代理解。
