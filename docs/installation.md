# 安装与使用

## 运行环境

| 依赖 | 用途 |
|---|---|
| Node.js20或更新版本 | 布局、体积配置、图代码与GLB生成 |
| Python3.10或更新版本 + pypdf | PDF文本/来源准备 |
| Typst0.14或更新版本 | 真实矢量编译；当前便携版固定0.15.1 |
| Poppler的pdftoppm | 论文页及输出PDF的PNG预览 |
| 系统字体 | 首选Arial/Liberation Sans；中文需要Microsoft YaHei或相应中文字体 |

Windows x64 Release包含经过SHA-256校验的Typst；仓库源码不含大型exe，可运行 `python scripts/setup-typst.py` 获取官方固定版本。Linux/macOS使用官方Typst安装方式并放入PATH，或设置 `ENGINEERING_TYPST`。Ubuntu通常可安装`poppler-utils fonts-liberation`，macOS可使用`brew install typst poppler`。Python依赖见根目录requirements.txt。

## 安装 Skill

独立Windows Skill ZIP解压后直接复制engineering-model-diagrams目录到Codex的skills目录；包含便携Typst。skill-source ZIP不含编译器，需要自行安装Typst。下面的安装脚本位于完整源码仓库，需要图库与开发文件时使用Git克隆或GitHub自动生成的Source code ZIP。

```text
python scripts/install-skill.py
```

安装到`CODEX_HOME/skills/engineering-model-diagrams`，或默认`~/.codex/skills/engineering-model-diagrams`。目标已存在时脚本保留旧文件并退出；可自行备份旧版或用`--dest`选择新目录。Skill在下一轮助手对话可用。

如果宿主提供skill-installer，也可要求“从Hhh101-Bao/engineering-model-diagrams仓库的skills/engineering-model-diagrams安装此Skill”。

## 三种入口

1. 附论文/模型图/代码，调用`$engineering-model-diagrams`：宿主助手自动完成理解、证据、中间结构、布局、代码、编译和视觉修正，不需要另配API。
2. 选正式来源图库条目：`node skills/engineering-model-diagrams/scripts/render-catalog.mjs --model bit --theme ocean-sand --out output/bit`。
3. 已有模型IR：`node skills/engineering-model-diagrams/scripts/compile-model.mjs MODEL.ir.json --theme plum-slate --out output/model`。

CLI单独运行时不会理解自然语言论文；先有助手生成的IR或选择图库。IR可自行修改语义，volume.json可修改几何。图形编译失败时保留诊断，不降级平面。

## 输出与迁移

- `.typ` 与同名 `.assets/` 必须一起移动；包含可再编译的依赖和许可证。
- `.pdf/.svg/.png` 为论文用矢量输出及预览；SVG文字是矢量字形，改字请编辑Typst或JSON。
- `.glb/.scene3d.json/.3d.html` 保存真实三维几何及离线查看器；GitHub源码页面不执行HTML，先下载后用本机浏览器打开。
- `.ir.json` 与 `.source.md/.evidence.md` 保留结构和来源。文件中的scope说明宏观分组、变体、示意尺度及省略内容。

旧 PlotNeuralNet 后端还需要Tectonic，首轮会下载TeX依赖；自动工作流默认不需要它。详见Skill的references/plotneuralnet.md。
