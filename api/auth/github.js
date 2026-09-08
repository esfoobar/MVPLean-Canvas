/*
 * ZA-129 / esfoobar/zeroagent#228. The desktop's GitHub device flow ends with
 * a GitHub access token, not a ZeroAgent account. This route verifies that
 * token against GitHub's own API and mints the ZeroAgent account JWT the
 * relay protocol expects at connect (ZA-209 reads it back, ZA-130 gives it a
 * real store).
 *
 * The account id is deterministic from GitHub's numeric id (acct_gh<id>), so
 * there is no store yet and none is needed: ZA-130 can add real storage
 * later against the same ids without a migration. Plan is always "free"
 * until ZA-130 exists.
 *
 * HS256 is hand-rolled with node:crypto rather than pulling in a JWT
 * library: jose only reaches this project today as a transitive dependency
 * of @vercel/oidc, and a signer this small is not worth an explicit
 * dependency.
 */

import { createHmac } from 'node:crypto';

const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_TIMEOUT_MS = 10_000;
const JWT_TTL_SECONDS = 30 * 24 * 60 * 60;
const ISSUER = 'https://mvplean.com';

function base64url(input) {
	return Buffer.from(input).toString('base64url');
}

function signJwtHs256(claims, secret) {
	const header = { alg: 'HS256', typ: 'JWT' };
	const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
	const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
	return `${signingInput}.${signature}`;
}

function sendError(res, status, error) {
	res.statusCode = status;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Cache-Control', 'no-store');
	res.end(JSON.stringify({ error }));
}

async function fetchGithubUser(githubToken) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
	try {
		return await fetch(GITHUB_USER_URL, {
			headers: {
				Authorization: `Bearer ${githubToken}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'ZeroAgent-SignIn (+https://mvplean.com)',
			},
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
}

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		sendError(res, 405, 'method_not_allowed');
		return;
	}

	// req.body is a Vercel getter: absent Content-Type it is undefined, and
	// malformed JSON throws when the getter runs rather than returning null.
	let body;
	try {
		body = req.body;
	} catch (err) {
		sendError(res, 400, 'bad_request');
		return;
	}

	const githubToken = body && typeof body === 'object' ? body.github_token : undefined;
	if (typeof githubToken !== 'string' || githubToken.length === 0) {
		sendError(res, 400, 'bad_request');
		return;
	}

	let githubRes;
	try {
		githubRes = await fetchGithubUser(githubToken);
	} catch (err) {
		// Network error, DNS failure, or the 10s timeout aborting the request.
		sendError(res, 502, 'github_unavailable');
		return;
	}

	if (!githubRes.ok) {
		if (githubRes.status === 401 || githubRes.status === 403) {
			sendError(res, 401, 'github_token_invalid');
		} else {
			sendError(res, 502, 'github_unavailable');
		}
		return;
	}

	let user;
	try {
		user = await githubRes.json();
	} catch (err) {
		sendError(res, 502, 'github_unavailable');
		return;
	}

	if (!user || typeof user.id !== 'number' || typeof user.login !== 'string') {
		sendError(res, 502, 'github_unavailable');
		return;
	}

	const secret = process.env.ZEROAGENT_JWT_SECRET;
	if (!secret) {
		sendError(res, 502, 'github_unavailable');
		return;
	}

	const account = `acct_gh${user.id}`;
	const plan = 'free';
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + JWT_TTL_SECONDS;

	const token = signJwtHs256(
		{
			iss: ISSUER,
			sub: account,
			gh: user.id,
			login: user.login,
			plan,
			iat,
			exp,
		},
		secret
	);

	res.statusCode = 200;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Cache-Control', 'no-store');
	res.end(
		JSON.stringify({
			token,
			account,
			login: user.login,
			plan,
			expires_at: new Date(exp * 1000).toISOString(),
		})
	);
}
