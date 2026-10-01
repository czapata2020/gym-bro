import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { dateLocale } from '../lib/i18n.js'
import { ct } from '../lib/challenge-copy.js'
import { todayISO } from '../lib/format.js'
import { bwSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

const addDays = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
const messageFor = error => {
  const known = {
    'invite code not found': ct('That invitation code does not exist.'),
    'challenge is full': ct('This challenge already has two participants.'),
    'already joined': ct('You already joined this challenge.'),
    'invalid weights': ct('Enter a valid starting and target weight.'),
    'invalid challenge': ct('Check the dates, weekly goal and weights.')
  }
  return known[error?.message] || error?.message || ct('Something went wrong. Try again.')
}

async function squarePhoto(file) {
  const src = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512)
    return canvas.toDataURL('image/jpeg', .82)
  } finally { URL.revokeObjectURL(src) }
}

function PageHead({ title }) {
  const nav = useNavigate()
  return <div className="hdr challenge-head">
    <button className="iconbtn" onClick={() => nav(-1)} aria-label={ct('Back')}><Icon name="chevronLeft" /></button>
    <div><h1>{title}</h1><div className="sub">{ct('Consistency wins. Weight confirms the result.')}</div></div>
  </div>
}

function EmptyAvatar({ name }) {
  const initial = name && name !== '?' ? name.slice(0, 1).toUpperCase() : ''
  return <div className="challenge-avatar-fallback">{initial ? <span>{initial}</span> : <Icon name="person" />}</div>
}

function ChallengeList() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [items, setItems] = useState([])
  const [mode, setMode] = useState('list')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const start = todayISO()
  const latest = S.bodyweight?.at(-1)?.w || ''
  const [form, setForm] = useState({
    name: '', startDate: start, endDate: addDays(start, 83), workoutsPerWeek: 3,
    stake: '', startWeight: latest, targetWeight: S.targetW || '', code: ''
  })
  const load = useCallback(() => api('/api/challenges').then(x => setItems(x.challenges)), [])
  useEffect(() => { load().catch(e => setError(messageFor(e))) }, [load])
  const set = (key, value) => setForm(x => ({ ...x, [key]: value }))
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const body = {
        ...form,
        workoutsPerWeek: +form.workoutsPerWeek,
        startWeight: +form.startWeight,
        targetWeight: +form.targetWeight,
        unit: S.unit,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
      const result = mode === 'create'
        ? await post('/api/challenges', body)
        : await post('/api/challenges/join', body)
      nav('/challenges/' + result.challenge.id)
    } catch (e) {
      if (e.status === 409 && e.data?.challengeId) nav('/challenges/' + e.data.challengeId)
      else setError(messageFor(e))
    } finally { setBusy(false) }
  }

  return <div className="narrow challenge-page">
    <PageHead title={ct('Challenges')} />
    {mode === 'list' ? <>
      <div className="challenge-actions">
        <Button variant="primary" icon="plus" onClick={() => setMode('create')}>{ct('Create challenge')}</Button>
        <Button icon="link" onClick={() => setMode('join')}>{ct('Join with code')}</Button>
      </div>
      {error && <div className="challenge-error">{error}</div>}
      {items.length ? <div className="challenge-list">{items.map(challenge => {
        const rival = challenge.participants.find(p => !p.isSelf)
        const me = challenge.participants.find(p => p.isSelf)
        return <button className="challenge-list-item" key={challenge.id} onClick={() => nav('/challenges/' + challenge.id)}>
          <span className="challenge-list-icon"><Icon name="trophy" /></span>
          <span className="challenge-list-copy"><b>{challenge.name}</b><small>{rival ? ct('vs {0}', rival.name) : ct('Waiting for a rival')}</small></span>
          <span className="challenge-list-score">{Math.round(me?.score.total || 0)}<small>/100</small></span>
          <Icon name="chevronRight" className="chev" />
        </button>
      })}</div> : !error && <div className="challenge-empty">
        <Icon name="trophy" />
        <h2>{ct('Your first challenge starts here')}</h2>
        <p>{ct('Invite one person and compete through weekly consistency, with weight as supporting evidence.')}</p>
      </div>}
    </> : <form className="challenge-form" onSubmit={submit}>
      <div className="challenge-mode"><button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>{ct('Create')}</button><button type="button" className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>{ct('Join')}</button></div>
      {mode === 'create' && <>
        <label className="challenge-field"><span>{ct('Challenge name')}</span><input required maxLength="60" value={form.name} onChange={e => set('name', e.target.value)} placeholder={ct('Wedding 2026')} /></label>
        <div className="challenge-form-grid">
          <label className="challenge-field"><span>{ct('Starts')}</span><input type="date" required value={form.startDate} onChange={e => set('startDate', e.target.value)} /></label>
          <label className="challenge-field"><span>{ct('Ends')}</span><input type="date" required value={form.endDate} onChange={e => set('endDate', e.target.value)} /></label>
        </div>
        <label className="challenge-field"><span>{ct('Workouts per week')}</span><input type="number" min="1" max="14" required value={form.workoutsPerWeek} onChange={e => set('workoutsPerWeek', e.target.value)} /></label>
        <label className="challenge-field"><span>{ct('The stake')}</span><textarea maxLength="160" value={form.stake} onChange={e => set('stake', e.target.value)} placeholder={ct('The loser cooks dinner for a week')} /></label>
      </>}
      {mode === 'join' && <label className="challenge-field"><span>{ct('Invitation code')}</span><input required maxLength="20" autoCapitalize="characters" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="A1B2C3D4" /></label>}
      <div className="challenge-form-grid">
        <label className="challenge-field"><span>{ct('Starting weight')} ({S.unit})</span><input type="number" min="25" max="400" step="0.1" required value={form.startWeight} onChange={e => set('startWeight', e.target.value)} /></label>
        <label className="challenge-field"><span>{ct('Target weight')} ({S.unit})</span><input type="number" min="25" max="400" step="0.1" required value={form.targetWeight} onChange={e => set('targetWeight', e.target.value)} /></label>
      </div>
      <p className="challenge-note"><Icon name="info" />{ct('Your exact weight stays private. Your rival only sees progress percentages.')}</p>
      {error && <div className="challenge-error">{error}</div>}
      <Button type="submit" variant="primary" disabled={busy} icon={mode === 'create' ? 'trophy' : 'link'}>{busy ? ct('Saving…') : mode === 'create' ? ct('Create challenge') : ct('Join challenge')}</Button>
      <Button type="button" variant="ghost" onClick={() => { setMode('list'); setError('') }}>{ct('Cancel')}</Button>
    </form>}
  </div>
}

function Competitor({ participant, leader, waiting, onPhoto }) {
  if (waiting) return <div className="challenge-competitor waiting"><div className="challenge-avatar"><EmptyAvatar name="?" /></div><b>{ct('Your rival')}</b><span>{ct('Not joined yet')}</span></div>
  const losing = leader && leader !== participant.userId
  return <div className={'challenge-competitor' + (losing ? ' losing' : '') + (leader === participant.userId ? ' leading' : '')}>
    <button className="challenge-avatar" onClick={participant.isSelf ? onPhoto : undefined} aria-label={participant.isSelf ? ct('Change photo') : participant.name}>
      {participant.photoUrl ? <img src={participant.photoUrl} alt="" /> : <EmptyAvatar name={participant.name} />}
      {participant.isSelf && <span className="challenge-camera"><Icon name="camera" /></span>}
    </button>
    <b>{participant.name}</b>
    <strong>{Math.round(participant.score.total)}<small>/100</small></strong>
    <span>{leader === participant.userId ? ct('Leading') : ct('Overall score')}</span>
  </div>
}

function ScoreBar({ label, value, accent }) {
  return <div className="challenge-metric"><div><span>{label}</span><b>{Math.round(value)}%</b></div><div className="challenge-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: accent }} /></div></div>
}

function ChallengeDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const input = useRef(null)
  const [challenge, setChallenge] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const load = useCallback(() => api('/api/challenges/detail?id=' + encodeURIComponent(id)).then(x => setChallenge(x.challenge)), [id])
  useEffect(() => { load().catch(e => setError(messageFor(e))) }, [load])
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setUploading(true); setError('')
    try { await post('/api/challenges/photo', { id, photo: await squarePhoto(file) }); await load() }
    catch (e) { setError(messageFor(e)) }
    finally { setUploading(false) }
  }
  if (error && !challenge) return <div className="narrow challenge-page"><PageHead title={ct('Challenge')} /><div className="challenge-error">{error}</div><Button onClick={() => nav('/challenges')}>{ct('Back to challenges')}</Button></div>
  if (!challenge) return <div className="narrow challenge-loading"><Icon name="trophy" /></div>
  const me = challenge.participants.find(p => p.isSelf)
  const rival = challenge.participants.find(p => !p.isSelf)
  const days = Math.max(0, Math.ceil((new Date(challenge.endDate + 'T23:59:59') - Date.now()) / 86400000))
  const leader = challenge.leaderId
  const leaderName = challenge.participants.find(p => p.userId === leader)?.name
  const insight = !rival ? ct('Share the code to start the duel.')
    : !leader ? ct('The challenge is tied right now.')
      : ct('{0} is leading the challenge.', leaderName)

  return <div className="narrow challenge-page">
    <PageHead title={challenge.name} />
    <section className="challenge-versus">
      <Competitor participant={me} leader={leader} onPhoto={() => input.current?.click()} />
      <div className="challenge-vs"><span>VS</span><small>{challenge.status === 'finished' ? ct('Final') : ct('{0} days left', days)}</small></div>
      <Competitor participant={rival} leader={leader} waiting={!rival} />
    </section>
    <input ref={input} className="challenge-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
    {uploading && <div className="challenge-uploading">{ct('Processing photo…')}</div>}
    <div className="challenge-verdict"><Icon name={leader ? 'crown' : 'target'} /><span>{insight}</span></div>
    {challenge.inviteCode && <section className="challenge-invite"><span>{ct('Invitation code')}</span><button onClick={() => navigator.clipboard?.writeText(challenge.inviteCode)}>{challenge.inviteCode}<Icon name="clipboard" /></button><small>{ct('Send this code to your rival.')}</small></section>}
    <section className="challenge-scoreboard">
      <div className="challenge-section-title"><h2>{ct('Your score')}</h2><span>{ct('75% consistency · 25% weight')}</span></div>
      <ScoreBar label={ct('Consistency')} value={me.score.consistency} accent="var(--green)" />
      <ScoreBar label={ct('Weight trajectory')} value={me.score.weightScore} accent="var(--yellow)" />
      <div className="challenge-week">
        <div><Icon name="calendar" /><span><b>{me.score.currentWeek.count} / {me.score.currentWeek.target}</b>{ct('workouts this week')}</span></div>
        <div className={me.score.weighMissing ? 'due' : 'done'}><Icon name="scale" /><span><b>{me.score.weighMissing ? ct('Pending') : ct('Done')}</b>{ct('weekly weigh-in')}</span></div>
      </div>
      {me.score.weighDue && <Button variant="primary" icon="scale" onClick={() => bwSheet({ onDone: load })}>{ct('Log this week’s weight')}</Button>}
    </section>
    <section className="challenge-details">
      <div><span>{ct('Goal')}</span><b>{me.startWeight} → {me.targetWeight} {me.unit}</b></div>
      <div><span>{ct('Progress')}</span><b>{Math.round(me.score.progress)}%</b></div>
      <div><span>{ct('Weekly commitment')}</span><b>{ct('{0} workouts', challenge.workoutsPerWeek)}</b></div>
    </section>
    {challenge.stake && <section className="challenge-stake"><Icon name="bolt" /><div><span>{ct('The stake')}</span><b>{challenge.stake}</b></div></section>}
    {error && <div className="challenge-error">{error}</div>}
    <p className="challenge-privacy"><Icon name="lock" />{ct('Weights are private; only percentages and scores are shared.')}</p>
  </div>
}

export default function Challenges() {
  const { id } = useParams()
  const user = useStore(s => s.user)
  if (!user) return <div className="narrow challenge-page"><PageHead title={ct('Challenges')} /><div className="challenge-empty"><Icon name="lock" /><h2>{ct('Sign in to use shared challenges')}</h2></div></div>
  return id ? <ChallengeDetail /> : <ChallengeList />
}
