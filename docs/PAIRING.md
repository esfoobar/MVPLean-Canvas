# Pairing the phone by QR

ZA-224, esfoobar/zeroagent#365. The desktop is already signed in
(`docs/AUTH.md`); pairing lets a phone get its own account credential
without ever showing a sign-in screen. This file documents the four routes'
contracts. The design decision behind the device token's shape, and what the
relay (ZA-209) and the iOS app need to know, is in
`/Users/jorescobar/Projects/zeroagent/docs/ACCOUNT.md`, not here: durable
ZeroAgent knowledge lives in that repo.

## The flow

1. Desktop: `POST /api/auth/pair` with its own account JWT. Gets a pairing
   token good for five minutes, usable once, and renders it as a QR code.
2. Phone: scans the code, `POST /api/auth/pair/claim` with that token. Gets
   its own long-lived device token for the same account. No sign-in step.
3. Desktop: `GET /api/auth/devices` to show paired devices,
   `POST /api/auth/devices/revoke` to revoke one.

## POST /api/auth/pair

Bearer-authenticated with the account JWT `api/auth/github.js` mints. A
device token (one already carrying a `device` claim) is refused: only the
desktop that owns the account can mint a pairing token.

Request: no body.

### 200 response

```json
{ "token": "<pairing token>", "expires_at": "<ISO 8601 UTC, ~5 minutes out>" }
```

### Errors

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthorized` | Missing, malformed, wrong-secret or expired Bearer token |
| 403 | `device_token_not_allowed` | The Bearer token is a device token, not a desktop token |
| 405 | `method_not_allowed` | Any method but POST |
| 502 | `account_store_unavailable` | The pairing-token store could not be written |

## POST /api/auth/pair/claim

No Authorization header: the phone has no credential yet, only the pairing
token it scanned.

Request body:

```json
{ "token": "<pairing token from the QR code>", "device_name": "Jorge's iPhone" }
```

`device_name` is optional and free text (truncated to 60 characters); it
falls back to `"Device"` when missing or blank.

Claiming marks the pairing token used immediately, so a second claim of the
same token is always refused, even if it races the first (the claim is one
atomic database operation, not a check followed by a write).

### 200 response

```json
{
  "token": "<device JWT>",
  "account": "acct_gh1234567",
  "login": "<github login>",
  "plan": "free",
  "device_id": "dev_...",
  "expires_at": "<ISO 8601 UTC>"
}
```

### Errors

Every error is `{"error": "<code>"}`:

| Status | Code | When |
| --- | --- | --- |
| 400 | `bad_request` | Missing or non-string `token`, or a body that fails to parse as JSON |
| 401 | `pairing_token_invalid` | The token was never minted (or is nonsense) |
| 401 | `pairing_token_expired` | The token existed but its five minutes are up |
| 401 | `pairing_token_used` | The token was already claimed once |
| 404 | `account_not_found` | The pairing token points at an account the store no longer has (should not happen in practice) |
| 405 | `method_not_allowed` | Any method but POST |
| 502 | `account_store_unavailable` | The pairing-token store or the users store could not be reached |

## GET /api/auth/devices

Bearer-authenticated the same way `GET /api/app/me` is. A device token is
refused: only the desktop manages the devices paired to its own account.

### 200 response

```json
{
  "devices": [
    { "deviceId": "dev_...", "name": "Jorge's iPhone", "createdAt": "<ISO 8601 UTC>", "revokedAt": null }
  ]
}
```

The device-token hash is never included here or anywhere in a response.

### Errors

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthorized` | Missing, malformed, wrong-secret or expired Bearer token |
| 403 | `device_token_not_allowed` | The Bearer token is a device token |
| 404 | `account_not_found` | No user row for this GitHub id |
| 405 | `method_not_allowed` | Any method but GET |
| 502 | `account_store_unavailable` | The users store could not be reached |

## POST /api/auth/devices/revoke

Bearer-authenticated the same way as the list route.

Request body:

```json
{ "device_id": "dev_..." }
```

### 200 response

```json
{ "device_id": "dev_...", "revoked_at": "<ISO 8601 UTC>" }
```

### Errors

| Status | Code | When |
| --- | --- | --- |
| 400 | `bad_request` | Missing or non-string `device_id` |
| 401 | `unauthorized` | Missing, malformed, wrong-secret or expired Bearer token |
| 403 | `device_token_not_allowed` | The Bearer token is a device token |
| 404 | `device_not_found` | No paired device with that id on this account |
| 405 | `method_not_allowed` | Any method but POST |
| 502 | `account_store_unavailable` | The users store could not be written |

Revoking does not itself disconnect a live relay connection; it takes effect
the next time that device's token is checked (see the relay decision in
zeroagent's `docs/ACCOUNT.md`).

## Storage

- `pairingTokens` collection (new, ZA-224): `_id` is the sha256 hex of the
  pairing token, never the token itself. `githubId`, `createdAt`,
  `expiresAt`, `usedAt` (null until claimed). See
  `api/_lib/pairing-store.js`.
- `users.pairedDevices` (ZA-130's field, now written to): each entry is
  `{deviceId, tokenHash, name, createdAt, revokedAt}`. `tokenHash` is the
  sha256 hex of the device JWT, never the token; it is stripped from every
  API response. See `api/_lib/users-store.js`.
