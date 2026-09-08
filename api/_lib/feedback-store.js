/*
 * ZA-222 / esfoobar/zeroagent#363. Storage for feedback submissions, kept
 * behind save() and listRecent() so a later switch to Atlas is a one-file
 * change: both the write path (api/feedback.js's POST) and the read path
 * (its token-gated GET) only ever call into this module.
 *
 * `vercel env ls production` on mvp-lean-canvas turned up no MONGODB_URI or
 * similar, and ZA-136 (the Atlas users collection) is unbuilt, so this
 * ships on Vercel Blob, the same store api/download-stats.js already reads.
 * When Jorge adds the Atlas connection string, this file is the only thing
 * that needs to change to write/read a `feedback` collection instead.
 */

import { put, list, get } from '@vercel/blob';

const PREFIX = 'feedback/';

function pathFor(doc) {
	// createdAt is kept as a real ISO string on the document itself; ':' is
	// sanitized out of the pathname only, so a Blob URL never carries one.
	const safeCreatedAt = doc.createdAt.replace(/:/g, '-');
	return `${PREFIX}${safeCreatedAt}-${doc.id}.json`;
}

export async function save(doc) {
	await put(pathFor(doc), JSON.stringify(doc), {
		access: 'private',
		contentType: 'application/json',
	});
}

export async function listRecent(limit) {
	const blobs = [];
	let cursor;
	do {
		const result = await list({ prefix: PREFIX, cursor, limit: 1000 });
		blobs.push(...result.blobs);
		cursor = result.hasMore ? result.cursor : undefined;
	} while (cursor);

	blobs.sort((a, b) => b.uploadedAt - a.uploadedAt);

	const docs = [];
	for (const blob of blobs.slice(0, limit)) {
		try {
			const result = await get(blob.pathname, { access: 'private' });
			if (!result || result.statusCode !== 200) continue;
			docs.push(JSON.parse(await new Response(result.stream).text()));
		} catch (err) {
			// Skip a blob that fails to read rather than failing the whole list.
		}
	}
	return docs;
}
