/*
 * ZA-130 / esfoobar/zeroagent#229. Storage for the `users` collection:
 * keyed by GitHub's numeric id (the JWT's `sub`/`gh`), one document per
 * account, carrying the plan field the entitlement model runs on. Same
 * cached-connection shape as api/_lib/feedback-store.js: the client
 * connect promise lives at module scope so a warm invocation reuses it.
 *
 * The *WithCollection functions take a MongoDB collection as their first
 * argument and hold the actual upsert/read logic; the plain functions below
 * them just supply the real collection. That split is what lets
 * test/users-store.test.js exercise the upsert semantics (creates on first
 * sign-in, refreshes login without resetting trialEnds on a later one)
 * against a fake in-memory collection, with no Atlas connection needed.
 */

import { MongoClient } from 'mongodb';
import { trialEndsFrom } from './entitlement.js';

const COLLECTION = 'users';

let clientPromise;

function getClientPromise() {
	if (!clientPromise) {
		const uri = process.env.MONGODB_URI;
		if (!uri) {
			throw new Error('MONGODB_URI is not set');
		}
		clientPromise = new MongoClient(uri).connect();
	}
	return clientPromise;
}

async function getCollection() {
	const dbName = process.env.MONGODB_DB;
	if (!dbName) {
		throw new Error('MONGODB_DB is not set');
	}
	const client = await getClientPromise();
	return client.db(dbName).collection(COLLECTION);
}

function normalize(doc) {
	if (!doc) return null;
	const { _id, ...rest } = doc;
	return { githubId: _id, ...rest };
}

// Looks the account up by GitHub id or creates it. login is refreshed every
// call, since a user can rename on GitHub; plan, createdAt, trialEnds,
// planUntil and pairedDevices are set once, on insert, and never touched on
// a later sign-in, so a returning user keeps their plan and trial clock.
export async function upsertOnSignInWithCollection(collection, { githubId, login, now = new Date() }) {
	const doc = await collection.findOneAndUpdate(
		{ _id: githubId },
		{
			$set: { login },
			$setOnInsert: {
				plan: 'free',
				createdAt: now.toISOString(),
				trialEnds: trialEndsFrom(now),
				planUntil: null,
				pairedDevices: [],
			},
		},
		{ upsert: true, returnDocument: 'after' }
	);
	// Driver versions before v6 wrap the result in { value }; v6+ (this repo
	// runs 7.x) returns the document itself. Handled here so a driver bump
	// doesn't silently break every caller.
	return normalize(doc && 'value' in doc ? doc.value : doc);
}

export async function getUserWithCollection(collection, githubId) {
	const doc = await collection.findOne({ _id: githubId });
	return normalize(doc);
}

export async function upsertOnSignIn({ githubId, login, now }) {
	const collection = await getCollection();
	return upsertOnSignInWithCollection(collection, { githubId, login, now });
}

export async function getUser(githubId) {
	const collection = await getCollection();
	return getUserWithCollection(collection, githubId);
}
