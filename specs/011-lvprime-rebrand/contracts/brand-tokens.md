# Style Contract: Brand tokens

**Spec**: FR-007 to FR-014 | **Source of values**: [data-model.md](../data-model.md) BrandPalette

`app/src/styles/tokens.css` is the only file that defines colour and font values. Components consume semantic tokens only.

## Additions (`:root`)

```
--brand-evergreen, --brand-evergreen-deep, --brand-brass,
--brand-brass-on-light, --brand-ivory, --brand-stone
```

Dark scheme (`@media (prefers-color-scheme: dark)`) overrides `--brand-brass-on-light` to the on-dark Brass; the others stay constant.

## Remaps

Per data-model.md "Semantic remap" table. Headings: `h1, h2` use `var(--font-display)` at weight 500; `.logo-text` uses weight 600.

## Guarantees

1. Values of `--accent*`, `--danger*`, `--warning*`, `--chart-*` are unchanged in both schemes.
2. No selector outside the header lock-up, sign-in brand block and one decorative rule references `--brand-brass` or `--brand-brass-on-light`.
3. `--body-size` and all existing font sizes are unchanged or larger.
4. Fonts load only from bundled `@fontsource` packages.
