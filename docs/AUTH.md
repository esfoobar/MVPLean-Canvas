# Sign-in with GitHub

ZA-129, esfoobar/zeroagent#228. The API half of the desktop's GitHub device
flow sign-in: the desktop never talks to a database here, it hands this route
a GitHub access token and gets back a ZeroAgent account JWT. The full design
(why device flow, why GitHub only, what the desktop does with the token) is
in the issue; this file documents only the contract this route ships.

## The route

```
POST /api/auth/github
```

Request body:

```json
{ "github_token": "<GitHub OAuth access token from the desktop's device flow>" }
```

The function calls `GET https://api.github.com/user` with:

```
Authorization: Bearer <github_token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: ZeroAgent-SignIn (+https://mvplean.com)
```

and requires a 200 response with a numeric `id` and a string `login`.

### 200 response

```json
{
  "token": "<JWT>",
  "account": "acct_gh1234567",
  "login": "<github login>",
  "plan": "free",
  "expires_at": "<ISO 8601 UTC>"
}
```

### Errors

Every error is `{"error": "<code>"}` with no other field:

| Status | Code | When |
| --- | --- | --- |
| 400 | `bad_request` | Missing or non-string `github_token`, or a body that fails to parse as JSON |
| 401 | `github_token_invalid` | GitHub answered 401 or 403 |
| 405 | `method_not_allowed` | Any method but POST |
| 502 | `github_unavailable` | GitHub 5xx, an unexpected non-200 response, a network error, or the 10 second request timeout |

The GitHub token is never echoed back in a response and never logged, on any
path including the error paths.

There are no CORS headers on this route. The caller is the Electron main
process, not a browser, and none are needed.

## The account id

`account = "acct_gh" + <GitHub numeric id>`, for example `acct_gh1234567`.
This is deterministic and needs no store: ZA-130 can add real account storage
later keyed on the same id, with no migration. Plan is always `"free"` until
that store exists.

## The JWT

HS256, hand-rolled with `node:crypto` (`createHmac`) rather than a JWT
library: the only other place `jose` reaches this project is as a transitive
dependency of `@vercel/oidc`, and a signer this small was not worth adding as
an explicit one.

Claims, and no others:

| Claim | Value |
| --- | --- |
| `iss` | `"https://mvplean.com"` |
| `sub` | the account id, e.g. `"acct_gh1234567"` |
| `gh` | the GitHub numeric id, as a number |
| `login` | the GitHub login |
| `plan` | `"free"` |
| `iat` | issued-at, Unix seconds |
| `exp` | `iat + 30 days` |

## The signing secret

`ZEROAGENT_JWT_SECRET`, generated with `openssl rand -hex 32` and set on the
`mvp-lean-canvas` Vercel project for Production and Preview:

```
vercel env add ZEROAGENT_JWT_SECRET production
vercel env add ZEROAGENT_JWT_SECRET preview
```

Same value both times. It lives only in Vercel's env, never in this repo or
in any doc or report; the relay (ZA-209) will read it from there to verify
tokens it receives at connect. If this route ever runs without the secret
set, it answers `github_unavailable` rather than signing with an empty
value.

## What this route does not do yet

No account store (ZA-130), no refresh endpoint (`POST /api/auth/token` was
proposed in ZA-129 but not built here), no revocation. A minted JWT is valid
for its full 30 days regardless of what happens to the GitHub token that
produced it.
