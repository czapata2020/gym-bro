import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createChallengeRoutes, scoreParticipant } from '../challenges.js';

const challenge = {
  startDate: '2026-09-01',
  endDate: '2026-10-26',
  workoutsPerWeek: 3
};
const participant = { startWeight: 100, targetWeight: 92 };

test('challenge score weights consistency at 75 percent and weight trajectory at 25 percent', () => {
  const state = {
    workouts: [
      { d: '2026-09-01' }, { d: '2026-09-03' }, { d: '2026-09-05' },
      { d: '2026-09-08' }, { d: '2026-09-10' }, { d: '2026-09-12' }
    ],
    bodyweight: [{ d: '2026-09-05', w: 99 }, { d: '2026-09-12', w: 98 }]
  };
  const score = scoreParticipant(challenge, participant, state, '2026-09-12');
  assert.equal(score.consistency, 100);
  assert.equal(score.weightScore, 87.5);
  assert.equal(score.total, 96.9);
  assert.equal(score.weighDue, false);
});

test('a missing weigh-in in the current challenge week makes weight evidence provisional', () => {
  const state = {
    workouts: [
      { d: '2026-09-01' }, { d: '2026-09-03' }, { d: '2026-09-05' },
      { d: '2026-09-08' }, { d: '2026-09-10' }, { d: '2026-09-12' }
    ],
    bodyweight: [{ d: '2026-09-05', w: 99 }]
  };
  const score = scoreParticipant(challenge, participant, state, '2026-09-12');
  assert.equal(score.consistency, 100);
  assert.equal(score.weighDue, true);
  assert.equal(score.weightScore, 0);
  assert.equal(score.total, 75);
});

test('sessions over the weekly target do not inflate consistency above 100 percent', () => {
  const state = {
    workouts: [
      { d: '2026-09-01' }, { d: '2026-09-02' }, { d: '2026-09-03' }, { d: '2026-09-04' },
      { d: '2026-09-08' }, { d: '2026-09-09' }, { d: '2026-09-10' }
    ],
    bodyweight: [{ d: '2026-09-03', w: 99.5 }, { d: '2026-09-10', w: 99 }]
  };
  const score = scoreParticipant(challenge, participant, state, '2026-09-10');
  assert.equal(score.consistency, 100);
  assert.equal(score.completedWeeks, 2);
});

test('moving away from the personal target earns no trajectory points', () => {
  const state = {
    workouts: [{ d: '2026-09-08' }],
    bodyweight: [{ d: '2026-09-10', w: 101 }]
  };
  const score = scoreParticipant(challenge, participant, state, '2026-09-10');
  assert.equal(score.progress, 0);
  assert.equal(score.weightScore, 0);
});

test('a missed final weigh-in cannot validate the weight component after the challenge ends', () => {
  const state = {
    workouts: [{ d: '2026-10-20' }, { d: '2026-10-22' }, { d: '2026-10-24' }],
    bodyweight: [{ d: '2026-10-12', w: 93 }]
  };
  const score = scoreParticipant(challenge, participant, state, '2026-10-30');
  assert.equal(score.finished, true);
  assert.equal(score.weighMissing, true);
  assert.equal(score.weighDue, false, 'a finished challenge should not ask for an impossible late entry');
  assert.equal(score.weightScore, 0);
});

test('two signed-in profiles can create and join a persistent challenge without sharing exact weights', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-challenge-'));
  const states = {
    u1: { unit: 'kg', workouts: [], bodyweight: [{ d: '2026-09-29', w: 70 }] },
    u2: { unit: 'kg', workouts: [], bodyweight: [{ d: '2026-09-29', w: 91 }] }
  };
  const routes = createChallengeRoutes({
    dataDir,
    users: () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Luis' }],
    readState: uid => states[uid],
    readSession: req => ({ id: req.uid, name: req.uid === 'u1' ? 'Ana' : 'Luis' }),
    readBody: async req => req.body,
    json: (res, status, body) => Object.assign(res, { status, body }),
    atomicWrite: (file, content) => fs.writeFileSync(file, content)
  });
  const call = async (route, uid, body = {}, url = route.split(' ')[1]) => {
    const res = {};
    await routes[route]({ uid, body, url }, res);
    return res;
  };

  const created = await call('POST /api/challenges', 'u1', {
    name: 'Wedding 2026', startDate: '2026-09-01', endDate: '2026-12-01',
    workoutsPerWeek: 3, stake: 'Cook dinner', startWeight: 70, targetWeight: 65, unit: 'kg'
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.challenge.participants.length, 1);
  const { id, inviteCode } = created.body.challenge;

  const joined = await call('POST /api/challenges/join', 'u2', { code: inviteCode, startWeight: 91, targetWeight: 84, unit: 'kg' });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.challenge.participants.length, 2);

  const detail = await call('GET /api/challenges/detail', 'u1', {}, `/api/challenges/detail?id=${id}`);
  assert.equal(detail.status, 200);
  const self = detail.body.challenge.participants.find(p => p.userId === 'u1');
  const rival = detail.body.challenge.participants.find(p => p.userId === 'u2');
  assert.equal(self.startWeight, 70);
  assert.equal(rival.startWeight, undefined);
  assert.equal(rival.targetWeight, undefined);
  assert.equal(detail.body.challenge.inviteCode, null, 'the code closes once the duel is full');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'challenges.json'))).challenges.length, 1);
});
