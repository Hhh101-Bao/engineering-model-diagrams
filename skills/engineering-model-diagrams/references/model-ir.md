# paper-model/1 中间表示

该文件由助手自动生成，用户无需准备。它记录语义与证据，不含布局坐标；编译器生成坐标及 Typst 代码。例子仅用于字段理解，不可将例子的数字当论文参数。

```json
{
  "schema": "paper-model/1",
  "title": "模型名称及范围",
  "sources": [{"id":"s1","path":"ABSOLUTE_SOURCE_PATH","uri":"CANONICAL_URL","sha256":"FULL_64_HEX_SHA256","kind":"pdf"}],
  "evidence": [{"id":"f1","source":"s1","locator":"p.3, Fig.2 and §3.1","statement":"简短释义，说明输入经卷积产生输出。","status":"stated"}],
  "nodes": [
    {"id":"x","op":"input","label":"输入","axes":"CHW","shape":[3,128,128],"shapeStatus":"stated","evidence":["f1"]},
    {"id":"conv","op":"conv","label":"卷积","params":{"outChannels":32,"kernel":3,"stride":2,"padding":1},"evidence":["f1"]},
    {"id":"y","op":"output","label":"输出","evidence":["f1"]}
  ],
  "edges": [{"id":"e1","from":"x","to":"conv","evidence":["f1"]},{"id":"e2","from":"conv","to":"y","evidence":["f1"]}],
  "uncertainties": [],
  "render": {"mode":"volume","widthMm":220,"minFontPt":8,"direction":"RIGHT","depthMultiplier":0.22}
}
```

`sources` 从 ingest 的 manifest 复制完整数据。纯文字请求可保存用户实际描述为文件并计算哈希；不要把生成的中间结构当成原始来源。`--check-sources` 在本地来源和哈希都存在时核对哈希；可复用的公开图附 canonical uri，迁移后本地文件缺失可以重取实际材料，不能伪造相同哈希。

每个 node/edge 的 evidence 引用至少一条真实依据。证据 status 为 stated/inferred/uncertain，inferred 必须给 reason。每个给定 shape 都写 shapeStatus 为 stated/inferred/unknown，推导 shape 要写 shapeReason。缺失 shape 可留空，由编译器尝试推导；最终未知维度记为 null。符号如 `"C/r"`、`"H"` 保留，文字标注直接展示；字符串不做代数求解。C/H/W 以外轴用 axes 标明原义，几何是抽象张量，不宣称物理长宽对应图像。

常用 op：input/output/conv/convblock/pool/gap/linear/relu/sigmoid/softmax/norm/dropout/identity/upsample/concat/add/multiply/attention/custom。新 op 必须有 meaning；不认识的算子保留抽象体积，不自动发明内部结构。

自动尺寸推导只覆盖：透传算子；CHW 全局平均池化；linear 的 outChannels；给定 kernel/stride/padding 的 conv/pool；给定 scale 的 upsample；相等形状 add；指定 axis（默认通道轴0）的 concat；显式 `params.broadcast:true` 的 multiply。卷积默认 dilation=1，非默认须给出。参数或特殊规则不完整时直接保存原文 shape 和理由，编译器不猜默认步幅/填充。声明/推导的数值维度冲突会阻止编译；符号表达式不具备通用等价性验证能力。

`repeat` 是实际重复次数，卷积可用最多三个几何分段加 ×N 压缩表示。不要把不同算子重复打包为一个 convblock，除非说明模块含义和展开范围。

`render.mode` 必须为 volume。direction 支持 RIGHT/DOWN。`render.maxHeightMm`可限制成图高度，超限会要求拆图或调整构图，不会压小字号。布局由 ELK 根据新 nodes/edges 生成，不写 at/labelAt/via；这些字段属于生成后的 volume.json。复杂层级目前建议拆总图/模块图，循环网络可用有证据的宏观模块保留时间展开含义，不能以图形无环布局反推模型无反馈。`nodes[].visual`按[语义图形规则](visual-language.md)选择表达，不改算子或证据。

`render.theme` 默认 `publication`：低饱和钢蓝表示卷积，青绿表示融合输出，琥珀表示降采样/拼接，灰紫表示全连接或自定义模块，使用无衬线字体。`classic` 保留旧配色。颜色表达算子角色，不能仅凭颜色推断论文未给出的结构。
