# mvplean-canvas

`mvplean.com`, Jorge's consulting site. Plain static HTML: `index.html`, `static/`
(css/js/images), `sitemap.xml`. No package.json, no build step, no tests, no CI.
Deployed on Vercel as project `mvp-lean-canvas`, team `mvpl-ean`.

## Git

Default branch is `master`. Never commit to `master`. One issue, one branch, one PR.

## The /zeroagent pages

`/zeroagent/` and `/zeroagent/download/` are ZeroAgent's public landing and download
pages, tracked as issues in the `zeroagent` repo (ticket prefix `ZA-`), not here. They
carry `<meta name="robots" content="noindex">` and are not linked from this site's
navigation or `sitemap.xml` until launch (ZA-149) removes both restrictions. Page-specific
assets live under `static/css/zeroagent.css` and `static/js/zeroagent-release.js`,
separate from the homepage's `custom.css` so the existing homepage stays untouched.
