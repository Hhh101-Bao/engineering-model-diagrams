# 体积描述与后端

## neural-netz：默认选择

固定 neural-netz 0.3.0 + CeTZ 0.4.2，Windows 包含 Typst 0.15.1 便携编译器。原始 `scripts/vendor/neural-netz/src/lib.typ` 保留，本地扩展在 placed.typ 和 local-extensions.json 中记录。

JSON 顶层用 `backend:"neural-netz"`，必填 layers。示例见 assets/examples/cnn-neural-netz.json、unet-neural-netz.json、dual-stream-neural-netz.json。

| 字段 | 含义 |
|---|---|
| widthMm | 目标宽，默认200mm；几何迭代拟合，容差约0.25mm |
| minFontPt | 声明的最小物理字号，默认8pt；需要核对实际PDF |
| palette | cold或warm |
| depthMultiplier | 斜投影深度系数，默认0.22 |
| showRelu / showLegend | 激活条带 / 原生图例开关 |
| layers | 体积层定义 |
| connections | 显式连接定义；绝对位置时必须给真实连接 |

每层使用 `name` 稳定ID，`type` 是 input、conv、convres、pool、unpool、deconv、concat、gap、fc、sum、convsoftmax、softmax、output、custom 之一。

- `widths:[0.5,0.5]` 表示两次卷积实体分段；height/depth 是正面高和几何深度，逻辑单位cm。
- `tensor:[C,H,W]` 保存真实维度。channels 用于标注：两个Conv可写 `[64,64,128]`，前两项为C，额外最后项为空间边标。为减少重复可写 `["",64,128]`，tensor仍完整保留。
- `label` 可是字符串或分行数组。`fill`、`bandfill` 用hex颜色，opacity 为透明度。
- 顺序布局用offset；空间布局用 `at:[x,y]`，其中x是正面左边，y为投影中心轴，y向上。Sum的at使用圆的左侧位置。空间布局不按数组顺序暗连。
- `labelAt:[x,y]` 可把文字置于空白区；不会自动避障。

连接：`{from,to,type:"direct",fromPort,toPort}`。端口为 west/east/north/south、四角、true_west/true_east，或左侧两个独立入口 west_upper/west_lower。

正交路径可用 `route:"orthogonal",laneX:4` 或 laneY；脚本根据实际锚点求折点，避免手算坐标导致断接。也可给via数组，但不能同时给lane。labelAt用于连接文字的位置。U形主干允许清晰的斜向直连。

示例：

```json
{"from":"branch","to":"concat","type":"direct","fromPort":"east","toPort":"west_upper","route":"orthogonal","laneX":4}
```

框图与本格式不能仅通过替换type相互转换，必须提供真实尺度、厚度与连接布局。内置校验检查基本字段和已知输入下的Sum/Concat形状；其他算子的数学关系需结合模型核对。几何拟合和标注隐藏不应改变tensor。

## PlotNeuralNet：原生TikZ风格

使用 `backend:"plotneuralnet"`，层ID字段是id，连接字段是edges。与neural-netz的逻辑单位、参数命名不同；按 [PlotNeuralNet](plotneuralnet.md) 和 cnn-volume.json 编写，不将两者混用。

## 输出与迁移

neural-netz输出的.typ使用相邻的 `PREFIX.assets`。可运行：

```powershell
typst compile --package-path PREFIX.assets/packages FILE.typ FILE.pdf
```

整体移动.typ与assets目录。SVG包含矢量字形，编辑文字使用.typ/JSON。PNG从矢量PDF渲染。默认不把完整图先栅格化再嵌入SVG/PDF。
