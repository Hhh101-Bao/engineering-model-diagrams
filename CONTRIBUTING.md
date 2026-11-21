# Contributing source-backed diagrams

A new model entry needs a primary paper or author-maintained implementation,
a version/commit or precisely identified variant, a locator for every key
structural fact, and a statement of omitted internals. Label inferred or example
dimensions. Never label a redraw as an official author figure.

Add a model or module to the skill's `assets/catalog/definitions.mjs`, or supply
an evidence-backed IR when the automatic workflow is more suitable. Rebuild the
affected figure using `render-catalog.mjs --model ID --out PREFIX`, inspect the
actual PNG and target-size typography, and keep the vector and GLB outputs.

Independent operations must have visible gaps; separated repeated layers must
retain real surface ports. Reject caption collisions, hidden arrows, accidental
wire merging and unsupported dimension claims. Preserve unknown values rather
than inventing them. Test at least one scientific palette and confirm that a
palette change preserves the graph and geometry.

Development checks require `requirements-dev.txt`; run `node evals/verify-v04.mjs`
and `python scripts/verify-gallery.py`. The PDF text-box check finds candidates,
not a universal proof of visual quality. Include actual render observations in
the pull request. Keep third-party source/license notices and avoid committing
full papers, credentials, local paths or runtime caches.
