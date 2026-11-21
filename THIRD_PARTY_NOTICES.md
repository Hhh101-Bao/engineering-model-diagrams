# Third-party components

The MIT license at the repository root covers this project's original code,
instructions and original example figures. It does not replace the licenses below.

| Component | Pinned version / commit | License | Location |
|---|---|---|---|
| [neural-netz](https://github.com/edgaremy/neural-netz) | 0.3.0 / `1c4e728c4703b77577a7761839154b0fa2232685` | MIT-0 | `skills/engineering-model-diagrams/scripts/vendor/neural-netz/LICENSE` |
| [CeTZ](https://github.com/cetz-package/cetz) | 0.4.2 | LGPL-3.0 | The bundled `packages/preview/cetz/0.4.2` license files |
| [oxifmt](https://github.com/PgBiel/typst-oxifmt) | 1.0.0 | MIT OR Apache-2.0 | The bundled `packages/preview/oxifmt/1.0.0` license files |
| [PlotNeuralNet](https://github.com/HarisIqbal88/PlotNeuralNet) | `e96bc852189c2089dd500527a0a01a5a36e8977e` | MIT | `scripts/vendor/plotneuralnet/LICENSE` within the skill |
| [elkjs](https://github.com/kieler/elkjs) | 0.12.1 | EPL-2.0 | `scripts/vendor/ELK-LICENSE.md` within the skill |
| [Typst](https://github.com/typst/typst) | 0.15.1 | Apache-2.0 and bundled notices | `scripts/vendor/typst/LICENSE` and `NOTICE` within the skill; compiler only in the Windows release |
| [NN-Models-drawio-library](https://github.com/HuanPP/NN-Models-drawio-library) | `17ba3ee38bf8862250594096b30782fe5efcbf84` | MIT | Historical flat-mode color data under `assets/upstream` |

The original `lib.typ` is retained. Local changes are isolated in `placed.typ`
and listed with hashes in `local-extensions.json`. ELK's bundled code is unchanged
except its filename extension. Included library source and license files must
remain available when redistributing the skill or its portable source assets.

The homepage figures are original architecture schematics rendered by this
project. They are not reproduced paper figures and do not claim to be exact
implementations of a named published model. Public papers used during development
are linked as evidence; complete third-party papers are not redistributed.
