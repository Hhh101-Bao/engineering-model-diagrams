# PlotNeuralNet 体积后端

使用官方 PlotNeuralNet 的 Box、RightBandedBox 和 Ball 实现三维坐标投影的矢量立体网络示意。固定 commit 为 `e96bc852189c2089dd500527a0a01a5a36e8977e`，源码、MIT 许可证及逐文件 SHA256 保存在 `scripts/vendor/plotneuralnet/`。连续卷积是真实分段几何，convrelu 用原有激活条带；本后端不把二维卡片贴图作为体积。

## 运行

```powershell
python scripts/plotneuralnet_backend.py INPUT.json --out OUTPUT_PREFIX --width-mm 200 --cache-dir WORKSPACE_CACHE
```

依赖 Python 3、pypdf、Tectonic；PNG 需要 pdftoppm。Codex 内使用内置 Python 和工具，不需要安装系统级 TeX。首轮 Tectonic 会下载 LaTeX/TikZ 格式包，后续复用缓存。Windows 沙箱默认缓存可能报重命名拒绝，脚本会将 TECTONIC_CACHE_DIR 指向输出目录下 `.tectonic-cache`，也可用 --cache-dir 指向工作区共享缓存。

输出 `.tex`、`.pdf`、`.png`、`.source.json`、`.backend.json`、`.compile.txt`，以及与 TeX 相邻的 `PREFIX-assets/layers/`。保留 `.tex` 和相邻 assets 才能移动后继续编译。`--no-compile` 只生成源码；`--no-png` 跳过 PNG。`--compiler PATH` 指定另一份 Tectonic 可执行文件。

## 结构描述

顶层包含 `layers`、可选 `edges`、`title`、`legend`、`fontSize`（默认16 pt）、`widthMm`、`fontFamily`。Windows 默认 Microsoft YaHei，已实际验证中文可编译。其他系统需提供已安装且覆盖相应字符的字体。

每层：

```json
{
  "id":"encoder",
  "type":"convrelu",
  "tensor":[64,64,64],
  "repeat":2,
  "channels":[64,64],
  "widths":[2.5,2.5],
  "height":24,
  "depth":24,
  "at":[3,0,0],
  "caption":"Conv",
  "color":"#ECCB82",
  "bandColor":"#D49540"
}
```

类型：input、feature、conv、convrelu、pool、upsample、fc、softmax、attention、block、output、add、concat。`tensor` 为 C×H×W，允许 null 表示未知。repeat 与 channels/widths 长度一致，最后一个 channel 与 tensor 的 C 一致。纯 conv 的重复不会自动添加 ReLU 语义。Add/Concat 需要至少两条显式输入边；已知维度会检查逐元素相加或拼接的维度关系，Concat axis 默认0。

`at` 是绝对三维坐标；或用 `to:"previous-east"` 与 `offset:[dx,dy,dz]` 相对定位。几何 height/depth 与张量尺寸独立，省略时按空间分辨率计算受限平方根映射；默认 width 按通道数的对数映射。需要严格对照厚度时显式统一 widths。

默认通道数在体积顶部，caption、repeat 与完整 C×H×W 在底部。可用 `labelOffset:[dx,dy,dz]` 调整底部标注，或用绝对 `labelAt:[x,y,z]` 对齐成图。showLabels / showChannels 可显式隐藏对应标注。紧贴卷积的 Pool 薄层宜将标注放到独立行，避免标签进入大体积内部。立体图的遮挡与标注仍需检查真实 PNG。

边：`{id,from,to,kind?,fromAnchor?,toAnchor?,via?,label?}`。kind=skip 默认为顶部跨接；其他边默认为 east→west。via 是三维折点数组，例如 `[[10,6,0],[18,6,0]]`，也可以引用已存在的合法体积锚点。未提供 edges 时连接相邻层；多分支必须提供真实边。相邻体积直接接触时，可用 `draw:false` 保留语义连接并省略箭头。

## 编译与尺寸

widthMm 由编译后等比例缩放 PDF 得到，源 TeX 保留自然尺寸。重新导出并保持同样物理宽度时应使用原 JSON 与同样 widthMm。实际 PDF 页面宽高与最小文字大小记录在 backend.json；该记录不替代视觉审查。

本后端输出矢量 PDF 与可编辑 TeX，不提供 draw.io 反向编辑或 SVG 导出。它是斜投影立体示意，不是可旋转的三维网格文件。实际测试包括官方原样 FCN8 示例和含中文的分层 CNN；不能据此声称整体优于原项目。
