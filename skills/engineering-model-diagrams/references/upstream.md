# 上游与复现

## v0.3 自动工作流

`ingest-paper.py`、`model-ir.mjs`、`compile-model.mjs`、`export-scene3d.mjs` 与 `review-workflow.mjs` 是本 Skill 新增的工作流代码。论文理解由宿主助手完成，布局实际调用下述已固定版本的 ELK，体积绘图调用 neural-netz/CeTZ。三维 GLB 和离线查看器由同一套体积几何生成，不使用第三方示例图片或三维贴图。

placed.typ 进一步扩展显式表面端点、可配置 GAP/FC/Pool 厚度，以及相乘球体符号；原件 lib.typ 保留，派生哈希记录于 local-extensions.json。公开论文作为测试输入只引用来源与简短释义，不在 Skill 或发布包重新分发整篇论文。

## v0.2 实际体积后端

- **neural-netz 0.3.0**，commit `1c4e728c4703b77577a7761839154b0fa2232685`：https://github.com/edgaremy/neural-netz 。使用真实CeTZ体积绘制。MIT-0原件、派生placed.typ、逐项扩展和哈希位于scripts/vendor/neural-netz；CeTZ0.4.2、oxifmt1.0.0的源包与声明同时保留。
- **Typst 0.15.1**：https://github.com/typst/typst 。Windows便携编译器位于scripts/vendor/typst，保留LICENSE、NOTICE；下载包与exe的SHA256记录在neural-netz/provenance.json。
- **PlotNeuralNet**，commit `e96bc852189c2089dd500527a0a01a5a36e8977e`：https://github.com/HarisIqbal88/PlotNeuralNet 。实际使用Box、RightBandedBox、Ball，源文件与MIT声明位于scripts/vendor/plotneuralnet。通过Tectonic真实编译。

两种后端均实际跑通。Tectonic首轮TeX依赖缓存不随Skill打包；neural-netz的Typst包已随附，可离线编译。v0.2不以复用颜色代替后端集成。

## v0.1 历史平面兼容资源

机器可读版本与校验值见 `assets/upstream/provenance.json`。

- **elkjs 0.12.1**：https://github.com/kieler/elkjs 。实际用于自动布局，保留 `scripts/vendor/ELK-LICENSE.md`，许可证 EPL-2.0。随附 npm 发布包中的未改动 `lib/elk.bundled.js`，改扩展名为 `.cjs` 以便 ESM 调用。对应源码可由官方 elkjs 仓库的版本标签或已记录的 npm 包取得。
- **HuanPP/NN-Models-drawio-library**，commit `17ba3ee38bf8862250594096b30782fe5efcbf84`：实际复用 nn_components.xml 中 11 项组件数据的原始 fillColor/strokeColor，提供 upstream 配色对照。原始选中数据保存在 `assets/upstream/nn-components.json`，保留 MIT-LICENSE.txt。主主题与渲染器是本项目实现。
- v0.1曾参考 **NN-SVG** 的参数化矢量图、**Net2Vis** 的分组抽象；二者代码未集成。PlotNeuralNet已在v0.2作为实际后端接入。

新增上游资源时分别记录代码、模板与图片来源，固定版本或 commit，保留相应声明。当前没有把 dl-visuals 图片打包进 Skill。

上游颜色对照使用相同图、相同布局与相同字体，仅替换选中组件的配色，不能作为“全面超过原引擎”的证据。
