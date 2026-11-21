# 五套科研主题与细节标准

配色按算子角色保持一致，白底、深色文字、低饱和体积面。五套主题都可用于新论文的自动流程；publication 是 steel-teal 的别名，classic 是旧版兼容主题，不计入五套。

| theme | 名称 | 卷积/骨干 | 拼接 | 注意力/自定义 | 输出/融合 |
|---|---|---|---|---|---|
| steel-teal | 钢蓝青绿 | #8FAAC4 | #D8BC80 | #B0A3C3 | #91B6A1 |
| ocean-sand | 海蓝砂金 | #769BC2 | #CDB98B | #A5B2C8 | #83B2AD |
| sage-earth | 鼠尾草大地 | #9EAD97 | #D5BD85 | #B4AAA1 | #83A596 |
| plum-slate | 灰紫岩蓝 | #A39CB7 | #D6BE8F | #B19CAC | #8FB2AA |
| graphite-amber | 石墨琥珀 | #99A7B2 | #C4B18B | #AAA3AE | #92ACA8 |

用户可直接要求“使用鼠尾草大地主题”，由助手设置 `render.theme: sage-earth`。CLI 也支持：

```text
node scripts/compile-model.mjs MODEL.ir.json --out PREFIX --theme sage-earth
node scripts/render-network.mjs MODEL.volume.json --out PREFIX --theme plum-slate
```

目标不是颜色越多越好。一个图最多用4–5个语义角色色，重点模块突出，其余低饱和。同一体积有明暗区分，但不使用装饰性强渐变、夸张阴影或发光。确保灰度下仍能靠形状、文字和连线区分算子，不能只靠色差表达关键语义。

对标 PlotNeuralNet 的尺寸/通道标注、连续卷积表达和长跳连；对标 neural-netz 的统一投影、矢量几何和模块布局。结合本工具的证据记录、五套语义配色、分离式子层、GLB几何和实际成图审查。展示图库与作者原图区分：我们绘制的是有来源的结构重绘，不冒充作者官方出图。

成图检查：体积面投影一致，子层和独立操作留空隙；张量尺寸与通道数可辨；连接接到实体表面；重复次数有明示；标签不贴边或碰撞；图例与正文不冲突；目标成图宽度和最小文字字号可检查。密集模型拆总图/模块图，不能把所有层挤成窄条。
