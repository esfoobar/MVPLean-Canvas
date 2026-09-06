// ZA-204. Plain node --test, no runner dependency: `node --test test/`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	extractClientId,
	randomClientId,
	firstForwardedIp,
	refererHost,
	buildDownloadServedPayload,
	ga4CollectUrl,
	GA4_MEASUREMENT_ID,
} from '../api/_lib/ga4.js';

test('extractClientId reads the client_id out of a real _ga cookie', () => {
	const cookie = '_ga=GA1.2.123456789.987654321; other=value';
	assert.equal(extractClientId(cookie), '123456789.987654321');
});

test('extractClientId picks the _ga pair out of several cookies', () => {
	const cookie = 'foo=bar; _ga=GA1.1.111.222; _ga_ABCDEF=GS1.1.abc';
	assert.equal(extractClientId(cookie), '111.222');
});

test('extractClientId returns null when there is no _ga cookie', () => {
	assert.equal(extractClientId('foo=bar; other=value'), null);
	assert.equal(extractClientId(''), null);
	assert.equal(extractClientId(null), null);
	assert.equal(extractClientId(undefined), null);
});

test('extractClientId returns null for a value with too few segments', () => {
	assert.equal(extractClientId('_ga=GA1.2'), null);
});

test('extractClientId decodes a URL-encoded cookie value', () => {
	const cookie = '_ga=GA1.2.111.222'.replace('.', '%2E');
	// The dot after GA1 encoded as %2E should still decode and parse.
	assert.equal(extractClientId(cookie), '111.222');
});

test('randomClientId returns a unique-looking string each call', () => {
	const a = randomClientId();
	const b = randomClientId();
	assert.equal(typeof a, 'string');
	assert.ok(a.length > 0);
	assert.notEqual(a, b);
});

test('firstForwardedIp takes the first entry of x-forwarded-for', () => {
	assert.equal(firstForwardedIp('203.0.113.5, 70.41.3.18, 150.172.238.178', null), '203.0.113.5');
});

test('firstForwardedIp falls back to x-real-ip when x-forwarded-for is absent', () => {
	assert.equal(firstForwardedIp(null, '203.0.113.9'), '203.0.113.9');
	assert.equal(firstForwardedIp(undefined, '203.0.113.9'), '203.0.113.9');
});

test('firstForwardedIp returns null when neither header is present', () => {
	assert.equal(firstForwardedIp(null, null), null);
	assert.equal(firstForwardedIp('', ''), null);
});

test('refererHost extracts just the host', () => {
	assert.equal(refererHost('https://mvplean.com/zeroagent/download/'), 'mvplean.com');
	assert.equal(refererHost('https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com');
});

test('refererHost returns "direct" when there is no referer or it is unparsable', () => {
	assert.equal(refererHost(null), 'direct');
	assert.equal(refererHost(''), 'direct');
	assert.equal(refererHost('not-a-url'), 'direct');
});

test('buildDownloadServedPayload builds a well-formed Measurement Protocol body', () => {
	const payload = buildDownloadServedPayload({
		clientId: '111.222',
		arch: 'arm64',
		version: '1.2.3',
		ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
		ip: '203.0.113.5',
		referer: 'https://mvplean.com/zeroagent/download/',
		timestampMs: 1_700_000_000_000,
	});

	assert.equal(payload.client_id, '111.222');
	assert.equal(payload.user_agent, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
	assert.equal(payload.ip_override, '203.0.113.5');
	assert.equal(payload.timestamp_micros, 1_700_000_000_000_000);
	assert.equal(payload.events.length, 1);

	const [event] = payload.events;
	assert.equal(event.name, 'download_served');
	assert.deepEqual(event.params, {
		arch: 'arm64',
		version: '1.2.3',
		source: 'redirect',
		referrer_host: 'mvplean.com',
	});
});

test('buildDownloadServedPayload omits user_agent, ip_override and timestamp_micros when absent', () => {
	const payload = buildDownloadServedPayload({
		clientId: 'random-id',
		arch: 'x64',
		version: null,
		ua: '',
		ip: null,
		referer: null,
		timestampMs: NaN,
	});

	assert.equal('user_agent' in payload, false);
	assert.equal('ip_override' in payload, false);
	assert.equal('timestamp_micros' in payload, false);
	assert.equal(payload.events[0].params.version, 'unknown');
	assert.equal(payload.events[0].params.referrer_host, 'direct');
});

test('buildDownloadServedPayload requires a clientId and an arch', () => {
	assert.throws(() => buildDownloadServedPayload({ arch: 'arm64' }));
	assert.throws(() => buildDownloadServedPayload({ clientId: 'abc' }));
});

test('ga4CollectUrl points at the real collect endpoint with measurement_id and api_secret', () => {
	const url = ga4CollectUrl({ apiSecret: 'shh' });
	assert.equal(url, `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=shh`);
});

test('ga4CollectUrl points at the debug collect endpoint when debug is true', () => {
	const url = ga4CollectUrl({ apiSecret: 'shh', debug: true });
	assert.equal(url, `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=shh`);
});
