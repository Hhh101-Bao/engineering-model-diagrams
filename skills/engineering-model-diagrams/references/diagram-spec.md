# 图形描述 v1

入口是 UTF-8 JSON。`version: 1`；`nodes` 与 `edges` 必填。先参考 `assets/examples/dual-branch.json`，其 `fusion.module` 与总览共用一份源文件。

| 顶层字段 | 含义 |
|---|---|
| title / subtitle | 可选标题与说明；论文已有图题时可省略 |
| widthMm | 导出物理宽度，默认 180 mm |
| minFontPt | 最终最小字号门限，默认 7.5 pt；以投稿要求覆盖 |
| theme | paper、mono 或 upstream |
| layout | `{mode: "auto", direction: "RIGHT"}` 或 `{mode: "fixed"}`；自动方向可用 RIGHT / DOWN / LEFT / UP |
| groups | `[{id, label}]`，本版是平面背景分组，不支持嵌套 |
| legend | `[{label,type}]`；false 隐藏，省略则为图中的算子自动生成图例 |

## 节点

`id` 是字母开头的稳定字母数字下划线或连字符标识。`label` 必填。`type` 可选：input, output, conv, convblock, pool, upsample, linear, attention, norm, activation, add, concat, multiply, feature, dropout, softmax, embedding, block, loss。

`tensor` 为已声明的维度数组，元素为正整数或 null。示例默认 C×H×W；渲染器只展示声明的值，不执行网络前向计算。`detail` 可代替默认张量标签。`width` 调整方块的逻辑宽度，默认 132。Add/Concat/Multiply 显示符号、名称和张量尺寸；逻辑高度根据字体测量和换行自动计算。`group` 引用分组。固定布局还需要 `x`、`y`。

已知维度会检查逐元素算子输入一致性，以及 Concat 非拼接维度与输出之和；缺失的维度输出审查提示。Concat 的 `axis` 默认 0。本版不检查 Conv、Upsample 等所有算子的数学关系，需核对模型。

模块节点可以包含 `module`：其值是一个完整的子图描述，使用 `--view NODE_ID` 输出。子图是明确存储的模块定义，不是渲染时推测。输入输出接口需与外层人工核对。本版支持总览与单独展开图，不支持自动将子图嵌入总览重新布线。

## 边

`{id,from,to}` 必填。`kind` 为 data（默认）、skip、auxiliary；后者使用虚线。可用 `label` 加文字。固定布局可用 `fromSide`、`toSide` 指定 N/S/E/W，或用 `via:[{x,y},...]` 给折点。所有折点需构成正交路径。

自动布局交给 ELK；固定布局端口在同一面的边之间等距分配。多条连接进入同一节点时，不要手算单一中点并假设其他端口不变。修改固定布局后重跑检查。

## 修改约定

改颜色只改 theme；改文字保留 ID；改拓扑更新 edges 与真实 tensor。保留原始用户材料。渲染输出 `.source.json` 是所选视图的有效配置，主源文件包含的其他模块定义不应被展开视图覆盖。
