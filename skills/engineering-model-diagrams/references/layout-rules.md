# 布局与物理尺寸

## 自动布局

ELK layered + ORTHOGONAL，固定随机种子与模型顺序，适合方向明确的网络。分组背景在节点布局后计算，不是 ELK compound 子图。复杂分组可能发生标题遮挡；检查会报错，此时调整分组或采用固定布局。

## 固定布局

对于 U 形总览、对称分支和刻意设计的阅读路径，使用 x/y 与端口约束。以 `assets/examples/encoder-decoder.json` 为例。节点高度来自标签与字体测量，不要只按示例的视觉高度猜折点。将图片、卷积、解码器等放在明确的逻辑行列，给分组标题留 39 个逻辑单位。

布局文件保存未加页面边距的节点位置和走线。`--reuse-layout` 会核对几何尺寸、全部边定义、布局模式和显式位置；符合时复用。修改颜色可完全保留几何；较长标签、增加节点或更改连接会触发重新布局。固定布局修改需要提供新位置。

## 字号

字体由最终物理宽度与逻辑画布宽度共同决定。不要靠任意缩小图形通过验收。检查最小字号低于 minFontPt 时，优先减少展开细节、竖向排列、拆为总览与子图，或在用户允许时增加 widthMm。

## 字体与导出

PDF/PNG 共用 ReportLab 场景和字体度量。Windows 默认 Arial + 微软雅黑。Linux 可配置 TrueType 字体；某些 Noto CJK OpenType/CFF 集合无法被 ReportLab TTFont 使用，应换用带所需字符的 TrueType 字体。

可配置环境变量 ENGINEERING_FONT_REGULAR、ENGINEERING_FONT_BOLD、ENGINEERING_FONT_CJK、ENGINEERING_FONT_CJK_BOLD。缺字会报错。SVG 保留可编辑文本并使用系统字体栈；换机器时核对字体。PDF 嵌入子集字体，PNG 从 PDF 渲染。

draw.io 是结构化编辑输出：保留节点与正交折点，不承诺与 PDF 每个字符的位置完全一致。修改 draw.io 后可自行导出；本版未实现 draw.io 改动反向同步 JSON，需选择一种结构事实来源。
