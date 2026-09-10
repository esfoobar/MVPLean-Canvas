# mvplean-canvas

`mvplean.com`, Jorge's consulting site. Plain static HTML: `index.html`, `static/`
(css/js/images), `sitemap.xml`. No package.json, no build step, no tests, no CI.
Deployed on Vercel as project `mvp-lean-canvas`, team `mvpl-ean`. `vercel.json`
carries redirects and a rewrite proxying to zeroagenthq.com; see below.

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

The old `/zeroagent` pages and the `api/` functions are gone from this repo (ZA-292);
`vercel.json` is what answers those paths now. It carries permanent redirects (ZA-286)
from `/zeroagent`, `/zeroagent/download`, `/zeroagent/terms`, `/zeroagent/privacy` and
`/zeroagent/stats` to their zeroagenthq.com equivalents, since those old URLs may still
be linked or indexed elsewhere. `sitemap.xml` no longer lists any `/zeroagent/*` page;
the new site carries its own `sitemap.xml` and `robots.txt`.

The counted download at `/zeroagent/download/arm64` and `/zeroagent/download/x64` is a
temporary redirect (ZA-289, 2026-09-10) onto the counted download endpoint at
zeroagenthq.com, which does the logging and the 302 to the release CDN that a local
function used to do; it is an exact-path match that the `/zeroagent/download` redirect
above does not catch. `/api/*` is a `vercel.json` rewrite proxying to
`api.zeroagenthq.com`; desktop builds before 0.3.1 still call mvplean.com through it,
so both stay until those clients are gone.
