# Image/font delivery assets

`public/delivery/scene-1.svg` through `scene-3.svg` are original geometric artwork
created for this repository by `scripts/delivery/generate.mjs`; they contain no
third-party photography, logos or external resources. They and their raster
variants may be used, modified and redistributed with this project (CC0-1.0).
The three fixed scenes are independent of dataset seed/count so route comparisons
always use identical artwork. Do not substitute remote or random images.

Regenerate with `node scripts/delivery/generate.mjs`. It uses the Sharp installation
provided by the existing Next dependency; it does not install or upgrade packages.
Committed SVGs are the source; the deterministic generator writes JPEG 2400×1350
and AVIF/WebP 480×270, 960×540, 1280×720 variants. `public/delivery/manifest.json`
records actual byte sizes, hashes and Sharp version. Re-encoding with another Sharp
version may change bytes. No photo/image generation service is used.

`geist-latin.woff2` is copied unmodified from Next 16.3.4's
`dist/next-devtools/server/font/geist-latin.woff2`. Copyright 2024 The Geist Project
Authors. It is redistributed under SIL Open Font License 1.1; the full notice and
license are retained in `public/delivery/OFL.txt`, obtained from
https://github.com/vercel/geist-font/blob/main/OFL.txt.

Only `scenario=image-font-delivery` references these assets. Baseline uses the
2400px JPEGs eagerly, intentionally omits width/height/aspect-ratio reservation,
and uses a local font with `font-display: swap` and a serif fallback. Delivery can
therefore change image geometry and font metrics. Optimized uses native picture
AVIF/WebP srcsets, explicit sizes, 16:9 reservations with a solid placeholder,
one eager/high-priority hero candidate, and lazy/low-priority subsequent images.
The same font uses `optional`, a sans-serif fallback, and a scenario-only preload:
a late font need not replace already painted fallback. Browser policy determines
whether optional font is used; final glyph metrics can differ between approaches.

There are exactly three image slots and one font URL, no loops, remote traffic,
artificial stalls or runtime polling. Tests hold requests only in the browser test
harness. The hero is an LCP candidate, not a measured LCP element. No LCP/CLS result
or guaranteed layout-shift reduction is claimed. Widths, line height and final
image aspect ratios match; intentionally unreserved loading geometry differs.
