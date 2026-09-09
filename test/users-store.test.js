// ZA-130 / esfoobar/zeroagent#229. The upsert semantics against a fake
// MongoDB collection: no Atlas connection, no MONGODB_URI needed. Mimics the
// mongodb 7.x driver, where findOneAndUpdate returns the document itself
// (not wrapped in { value }).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertOnSignInWithCollection, getUserWithCollection } from '../api/_lib/users-store.js';
import { trialEndsFrom } from '../api/_lib/entitlement.js';

function fakeCollection(seed = []) {
	const docs = new Map(seed.map((doc) => [doc._id, { ...doc }]));
	return {
		async findOneAndUpdate(filter, update, options) {
			assert.equal(options.upsert, true);
			assert.equal(options.returnDocument, 'after');
			let doc = docs.get(filter._id);
			if (!doc) {
				doc = { _id: filter._id, ...(update.$setOnInsert || {}) };
			}
			Object.assign(doc, update.$set || {});
			docs.set(filter._id, doc);
			return { ...doc };
		},
		async findOne(filter) {
			const doc = docs.get(filter._id);
			return doc ? { ...doc } : null;
		},
	};
}

test('upsertOnSignInWithCollection creates a free account with a thirty-day trial on first sign-in', async () => {
	const now = new Date('2026-09-08T12:00:00.000Z');
	const collection = fakeCollection();
	const user = await upsertOnSignInWithCollection(collection, { githubId: 1234567, login: 'octocat', now });

	assert.deepEqual(user, {
		githubId: 1234567,
		login: 'octocat',
		plan: 'free',
		createdAt: now.toISOString(),
		trialEnds: trialEndsFrom(now),
		planUntil: null,
		pairedDevices: [],
	});
});

test('upsertOnSignInWithCollection on a returning user refreshes login without resetting plan or trialEnds', async () => {
	const collection = fakeCollection([
		{
			_id: 1234567,
			login: 'old-login',
			plan: 'premium',
			createdAt: '2026-01-01T00:00:00.000Z',
			trialEnds: '2026-01-31T00:00:00.000Z',
			planUntil: '2027-01-01T00:00:00.000Z',
			pairedDevices: [],
		},
	]);

	const secondSignIn = new Date('2026-09-08T12:00:00.000Z');
	const user = await upsertOnSignInWithCollection(collection, {
		githubId: 1234567,
		login: 'new-login',
		now: secondSignIn,
	});

	assert.equal(user.login, 'new-login');
	assert.equal(user.plan, 'premium');
	assert.equal(user.createdAt, '2026-01-01T00:00:00.000Z');
	assert.equal(user.trialEnds, '2026-01-31T00:00:00.000Z');
	assert.equal(user.planUntil, '2027-01-01T00:00:00.000Z');
});

test('upsertOnSignInWithCollection renaming on GitHub is reflected on the next sign-in', async () => {
	const collection = fakeCollection([
		{ _id: 42, login: 'first-name', plan: 'free', createdAt: 'x', trialEnds: 'y', planUntil: null, pairedDevices: [] },
	]);
	const user = await upsertOnSignInWithCollection(collection, { githubId: 42, login: 'renamed', now: new Date() });
	assert.equal(user.login, 'renamed');
});

test('getUserWithCollection returns null for an account that has never signed in', async () => {
	const collection = fakeCollection();
	const user = await getUserWithCollection(collection, 999);
	assert.equal(user, null);
});

test('getUserWithCollection normalizes _id back to githubId', async () => {
	const collection = fakeCollection([
		{ _id: 7, login: 'octocat', plan: 'platinum', createdAt: 'x', trialEnds: null, planUntil: null, pairedDevices: [] },
	]);
	const user = await getUserWithCollection(collection, 7);
	assert.equal(user.githubId, 7);
	assert.equal('_id' in user, false);
	assert.equal(user.plan, 'platinum');
});
