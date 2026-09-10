# mvplean-canvas

`mvplean.com`, Jorge's consulting site. Plain static HTML: `index.html`, `static/`
(css/js/images), `sitemap.xml`. No package.json, no build step, no tests, no CI.
Deployed on Vercel as project `mvp-lean-canvas`, team `mvpl-ean`.

## Git

Default branch is `master`. Never commit to `master`. One issue, one branch, one PR.

## Testing a branch in a worktree

`vercel dev` and `vercel link` resolve the project link from the repository root, so running
either one from inside a git worktree (under `.zeroagent/worktrees/`) silently operates on the
main checkout at the repo root, not on the worktree: you end up serving master's code while
believing you're testing your branch. Verify a branch instead through the PR's Vercel preview
deployment, or by running `vercel dev` only after confirming the served code is the branch's
(for example by temporarily printing a branch marker), or by pulling env with
`vercel env pull` into the worktree and running the functions under a plain Node harness.

## Projects section and the retired /zeroagent pages

ZeroAgent's public site moved to `https://zeroagenthq.com` (repo `esfoobar/zeroagent-site`,
tracked in the `zeroagent` repo, ticket prefix `ZA-`). The homepage's `#section-projects`
(reached from the header nav) replaces the old ZeroAgent promo banner and landing pages:
it lists MVPLean's own projects, ZeroAgent first, linking straight out to zeroagenthq.com.
Add future MVPLean projects here as more cards in the same section, not as pages under
this repo.

`vercel.json` carries permanent redirects (ZA-286) from `/zeroagent`, `/zeroagent/download`,
`/zeroagent/terms`, `/zeroagent/privacy` and `/zeroagent/stats` to their zeroagenthq.com
equivalents, since those old URLs may still be linked or indexed elsewhere. The retired page
files under `zeroagent/` and their page-specific assets (`static/css/zeroagent.css`,
`static/js/zeroagent-arch.js`, `static/js/zeroagent-copy.js`, `static/js/zeroagent-release.js`)
are unreachable now that the redirects intercept those paths before the filesystem serves
them, but stay checked in until a separate cleanup ticket removes them. `sitemap.xml` no
longer lists any `/zeroagent/*` page; the new site carries its own `sitemap.xml` and
`robots.txt`.

The API under `/api/*` and the counted download at `/zeroagent/download/arm64` and
`/zeroagent/download/x64` are exact-path matches that the `/zeroagent/download` redirect
above does not catch, and both moved to zeroagenthq.com under ZA-289 (2026-09-10): `/api/*`
is a `vercel.json` rewrite proxying to `api.zeroagenthq.com`, and `/zeroagent/download/:arch`
is a temporary redirect onto the same counted download endpoint there, which now does the
logging and the 302 to the CDN that a local function used to do. The old `api/` functions,
including that download redirect's own former implementation, are excluded from deployment
by `.vercelignore` so the rewrite is what actually answers (Vercel serves a project's own
functions before it applies rewrites); the files themselves stay checked in until ZA-292
removes them.
