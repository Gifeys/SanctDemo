# SanctiWalk brand assets

Extracted from `SANCTIWALK LOGO (1).ai` — which is a PDF underneath, so these
are the original artwork rather than a trace. Two tints of each variant:

| File | Variant | Use |
|---|---|---|
| `sanctiwalk-primary-*` | emblem + stacked *Sancti / Walk* | the full lockup, where there is room |
| `sanctiwalk-secondary-*` | emblem above the wordmark | tall, narrow spaces |
| `sanctiwalk-simplified-*` | *Sanctiwalk* with the cross as its "t" | horizontal strips; the app icon |
| `sanctiwalk-submark-*` | the emblem alone | the parish band; anywhere small |

`-white` is for dark backgrounds, `-navy` (#02074A) for light ones. Both tints
come from one alpha mask, so they are pixel-identical in shape.

Brand navy is **#02074A**. Note this is not the app's `--color-brand-primary`
(#1C2C56) — the logo keeps its own colour.

## Where they are used in the app

- `public/ui/sanctiwalk-mark-white.png` — parish welcome band
- `public/ui/sanctiwalk-mark-navy.png` — sign-in card
- `public/ui/sanctiwalk-wordmark-*.png` — horizontal lockup, currently unused
- `android/app/src/main/res/mipmap-*` — launcher icons, built from the simplified wordmark
- `public/favicon.ico`, `public/ui/apple-touch-icon.png`
