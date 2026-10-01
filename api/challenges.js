import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400000;
const MAX_PHOTO_BYTES = 750 * 1024;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round1 = n => Math.round(n * 10) / 10;
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const dateMs = value => Date.parse(value + 'T00:00:00Z');
const clean = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

function todayInZone(timeZone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return now.toISOString().slice(0, 10); }
}

function validZone(value) {
  const zone = clean(value, 80) || 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone; }
  catch { return 'UTC'; }
}

function latestWeight(state) {
  return [...(Array.isArray(state?.bodyweight) ? state.bodyweight : [])]
    .filter(x => isoDate(x?.d) && Number.isFinite(+x.w))
    .sort((a, b) => a.d.localeCompare(b.d)).at(-1)?.w;
}

function weekIndex(start, day) {
  return Math.floor((dateMs(day) - dateMs(start)) / (7 * DAY));
}

export function scoreParticipant(challenge, participant, state, today) {
  const start = challenge.startDate;
  const end = challenge.endDate;
  const totalWeeks = Math.max(1, Math.ceil((dateMs(end) - dateMs(start) + DAY) / (7 * DAY)));
  const current = clamp(weekIndex(start, today), 0, totalWeeks - 1);
  const active = today >= start;
  const finished = today > end;
  const lastWeek = finished ? totalWeeks - 1 : current;
  const workouts = (Array.isArray(state?.workouts) ? state.workouts : [])
    .filter(x => isoDate(x?.d) && x.d >= start && x.d <= end && x.d <= today);
  const weekly = Array.from({ length: lastWeek + 1 }, (_, index) => {
    const count = workouts.filter(w => weekIndex(start, w.d) === index).length;
    return { index, count, target: challenge.workoutsPerWeek, score: clamp(count / challenge.workoutsPerWeek, 0, 1) * 100 };
  });
  const consistency = active && weekly.length
    ? weekly.reduce((sum, w) => sum + w.score, 0) / weekly.length
    : 0;

  const weighIns = (Array.isArray(state?.bodyweight) ? state.bodyweight : [])
    .filter(x => isoDate(x?.d) && Number.isFinite(+x.w) && x.d >= start && x.d <= end && x.d <= today)
    .sort((a, b) => a.d.localeCompare(b.d));
  const currentWeekWeighIns = weighIns.filter(x => weekIndex(start, x.d) === current);
  const weighMissing = active && currentWeekWeighIns.length === 0;
  const weighDue = weighMissing && !finished;
  const recent = weighIns.slice(-3);
  const trendWeight = recent.length ? recent.reduce((sum, x) => sum + +x.w, 0) / recent.length : participant.startWeight;
  const span = participant.targetWeight - participant.startWeight;
  const actualProgress = Math.abs(span) < 0.05
    ? (Math.abs(trendWeight - participant.targetWeight) <= Math.max(.5, participant.startWeight * .02) ? 1 : 0)
    : clamp((trendWeight - participant.startWeight) / span, 0, 1);
  const elapsedDays = clamp(Math.floor((dateMs(today) - dateMs(start)) / DAY) + 1, 0, Math.floor((dateMs(end) - dateMs(start)) / DAY) + 1);
  const totalDays = Math.max(1, Math.floor((dateMs(end) - dateMs(start)) / DAY) + 1);
  const expectedProgress = clamp(elapsedDays / totalDays, 1 / totalDays, 1);
  const weightScore = active && !weighMissing ? clamp(actualProgress / expectedProgress, 0, 1) * 100 : 0;
  const total = round1(consistency * .75 + weightScore * .25);

  return {
    total,
    consistency: round1(consistency),
    weightScore: round1(weightScore),
    workouts: workouts.length,
    currentWeek: weekly.at(-1) || { index: 0, count: 0, target: challenge.workoutsPerWeek, score: 0 },
    completedWeeks: weekly.filter(w => w.count >= w.target).length,
    elapsedWeeks: weekly.length,
    weighIns: weighIns.length,
    weighDue,
    weighMissing,
    trendWeight: round1(trendWeight),
    progress: round1(actualProgress * 100),
    active,
    finished
  };
}

export function createChallengeRoutes({ dataDir, users, readState, readSession, readBody, json, atomicWrite }) {
  const file = path.join(dataDir, 'challenges.json');
  const photoDir = path.join(dataDir, 'challenge-media');
  const load = () => {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { version: 1, challenges: Array.isArray(value?.challenges) ? value.challenges : [] };
    } catch { return { version: 1, challenges: [] }; }
  };
  const save = value => atomicWrite(file, JSON.stringify(value, null, 2), 0o600);
  const find = (data, id) => data.challenges.find(c => c.id === id);
  const userName = id => users().find(u => u.id === id)?.name || 'Gym Bro';
  const member = (challenge, uid) => challenge?.participants?.find(p => p.userId === uid);
  const photoUrl = (challenge, participant) => participant.photo
    ? `/api/challenges/photo?id=${encodeURIComponent(challenge.id)}&user=${encodeURIComponent(participant.userId)}&v=${participant.photo.v}`
    : null;

  const present = (challenge, caller, detail = true) => {
    const today = todayInZone(challenge.timeZone);
    const participants = challenge.participants.map(p => {
      const score = scoreParticipant(challenge, p, readState(p.userId), today);
      return {
        userId: p.userId,
        name: userName(p.userId),
        isSelf: p.userId === caller.id,
        joinedAt: p.joinedAt,
        photoUrl: photoUrl(challenge, p),
        score,
        ...(p.userId === caller.id ? {
          startWeight: p.startWeight,
          targetWeight: p.targetWeight,
          unit: p.unit || 'kg'
        } : {})
      };
    });
    const ordered = [...participants].sort((a, b) => b.score.total - a.score.total);
    const leaderId = ordered.length === 2 && ordered[0].score.total - ordered[1].score.total >= .1 ? ordered[0].userId : null;
    return {
      id: challenge.id,
      name: challenge.name,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      workoutsPerWeek: challenge.workoutsPerWeek,
      stake: challenge.stake,
      status: today < challenge.startDate ? 'upcoming' : today > challenge.endDate ? 'finished' : 'active',
      leaderId,
      participants,
      ...(detail ? { inviteCode: challenge.participants.length < 2 ? challenge.inviteCode : null, timeZone: challenge.timeZone } : {})
    };
  };

  const requireUser = (req, res) => {
    const user = readSession(req);
    if (!user) json(res, 401, { error: 'not signed in' });
    return user;
  };
  const number = (value, min, max) => {
    const n = +value;
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const participantInput = (body, state) => {
    const startWeight = number(body.startWeight ?? latestWeight(state), 25, 400);
    const targetWeight = number(body.targetWeight, 25, 400);
    if (startWeight == null || targetWeight == null) return null;
    return { startWeight, targetWeight, unit: clean(body.unit || state?.unit || 'kg', 8) };
  };

  return {
    'GET /api/challenges': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const data = load();
      json(res, 200, { challenges: data.challenges.filter(c => member(c, user.id)).map(c => present(c, user, false)) });
    },
    'GET /api/challenges/detail': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      const challenge = find(load(), id);
      if (!challenge || !member(challenge, user.id)) return json(res, 404, { error: 'challenge not found' });
      json(res, 200, { challenge: present(challenge, user) });
    },
    'POST /api/challenges': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const body = await readBody(req);
      const name = clean(body.name, 60), stake = clean(body.stake, 160);
      const startDate = isoDate(body.startDate), endDate = isoDate(body.endDate);
      const workoutsPerWeek = number(body.workoutsPerWeek, 1, 14);
      const input = participantInput(body, readState(user.id));
      if (!name || !startDate || !endDate || endDate <= startDate || workoutsPerWeek == null || !input) {
        return json(res, 400, { error: 'invalid challenge' });
      }
      const data = load();
      let inviteCode;
      do { inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); }
      while (data.challenges.some(c => c.inviteCode === inviteCode));
      const now = Date.now();
      const challenge = {
        id: crypto.randomUUID(), name, stake, startDate, endDate, workoutsPerWeek,
        timeZone: validZone(body.timeZone), inviteCode, createdBy: user.id, createdAt: now,
        participants: [{ userId: user.id, ...input, joinedAt: now }]
      };
      data.challenges.push(challenge); save(data);
      json(res, 201, { challenge: present(challenge, user) });
    },
    'POST /api/challenges/join': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const body = await readBody(req);
      const code = clean(body.code, 20).toUpperCase();
      const data = load();
      const challenge = data.challenges.find(c => c.inviteCode === code);
      if (!challenge) return json(res, 404, { error: 'invite code not found' });
      if (member(challenge, user.id)) return json(res, 409, { error: 'already joined', challengeId: challenge.id });
      if (challenge.participants.length >= 2) return json(res, 409, { error: 'challenge is full' });
      const input = participantInput(body, readState(user.id));
      if (!input) return json(res, 400, { error: 'invalid weights' });
      challenge.participants.push({ userId: user.id, ...input, joinedAt: Date.now() });
      save(data);
      json(res, 200, { challenge: present(challenge, user) });
    },
    'POST /api/challenges/photo': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const body = await readBody(req);
      const data = load(), challenge = find(data, clean(body.id, 80));
      const participant = member(challenge, user.id);
      if (!challenge || !participant) return json(res, 404, { error: 'challenge not found' });
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.photo || ''));
      if (!match) return json(res, 400, { error: 'invalid photo' });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return json(res, 413, { error: 'photo too large' });
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const valid = ext === 'jpg' ? bytes[0] === 0xff && bytes[1] === 0xd8
        : ext === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      if (!valid) return json(res, 400, { error: 'invalid photo' });
      const dir = path.join(photoDir, challenge.id); fs.mkdirSync(dir, { recursive: true });
      for (const old of ['jpg', 'png', 'webp']) { try { fs.unlinkSync(path.join(dir, `${user.id}.${old}`)); } catch {} }
      const target = path.join(dir, `${user.id}.${ext}`);
      atomicWrite(target, bytes, 0o600);
      participant.photo = { ext, v: Date.now() };
      save(data);
      json(res, 200, { photoUrl: photoUrl(challenge, participant) });
    },
    'GET /api/challenges/photo': async (req, res) => {
      const user = requireUser(req, res); if (!user) return;
      const query = new URL(req.url, 'http://x').searchParams;
      const data = load(), challenge = find(data, query.get('id'));
      if (!challenge || !member(challenge, user.id)) return json(res, 404, { error: 'challenge not found' });
      const participant = member(challenge, query.get('user'));
      if (!participant?.photo) return json(res, 404, { error: 'photo not found' });
      const target = path.join(photoDir, challenge.id, `${participant.userId}.${participant.photo.ext}`);
      let stat; try { stat = fs.statSync(target); } catch { return json(res, 404, { error: 'photo not found' }); }
      const mime = participant.photo.ext === 'jpg' ? 'image/jpeg' : `image/${participant.photo.ext}`;
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(target).pipe(res);
    }
  };
}
