# mvplean-canvas

`mvplean.com`, Jorge's consulting site. Plain static HTML: `index.html`, `static/`
(css/js/images), `sitemap.xml`. No package.json, no build step, no tests, no CI.
Deployed on Vercel as project `mvp-lean-canvas`, team `mvpl-ean`.

## Git

Default branch is `master`. Never commit to `master`. One issue, one branch, one PR.

## The /zeroagent pages

`/zeroagent/` and `/zeroagent/download/` are ZeroAgent's public landing and download
pages, tracked as issues in the `zeroagent` repo (ticket prefix `ZA-`), not here. ZA-149 has
shipped, so they no longer carry `<meta name="robots" content="noindex">` and all four
(`/zeroagent/`, `/zeroagent/download/`, `/zeroagent/terms/`, `/zeroagent/privacy/`) are
listed in `sitemap.xml`. `/zeroagent/stats/` is the exception: it keeps its `noindex` and
stays out of the sitemap. Do not add a `Disallow` for it to `robots.txt`, because a
crawler blocked from fetching the page never sees the `noindex` on it. Page-specific
assets live under `static/css/zeroagent.css` and `static/js/zeroagent-release.js`,
separate from the homepage's `custom.css` so the existing homepage stays untouched.
