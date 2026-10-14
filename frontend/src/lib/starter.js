// The starter-plan catalog. Training data only: the chooser's plan names and descriptions are
// written as string literals inside t() calls in sheets.jsx, because check-source-strings.mjs
// only finds them there — copy parked in here would silently ship English in every language.
//
// A routine is [key, name, emoji, [[exerciseId, sets, reps], …]]. The key is what a plan's
// schedule points at, so a weekday never depends on the position of a routine in the array.
// Names stay canonical English — they become ordinary user routines, which are not translated.
import { uid } from './format.js'

const PPL = [
  ['push', 'Push Day', 'barbell', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
  ['pull', 'Pull Day', 'pullup', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
  ['legs', 'Leg Day', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]]
]

const UPPER_LOWER = [
  ['upper-a', 'Upper A', 'barbell', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
  ['lower-a', 'Lower A', 'legs', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
  ['upper-b', 'Upper B', 'barbell', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
  ['lower-b', 'Lower B', 'legs', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FULL_BODY = [
  ['fb-a', 'Full Body A', 'figureStrength', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
  ['fb-b', 'Full Body B', 'figureStrength', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
  ['fb-c', 'Full Body C', 'figureStrength', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FIVE_BY_FIVE = [
  ['5x5-a', '5×5 A', 'barbell', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
  ['5x5-b', '5×5 B', 'barbell', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
  ['5x5-c', '5×5 C', 'barbell', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]]
]

const PHASE_MAIN_NOTE = 'RIR 2-3. Semanas 1-2: 2 series. Semanas 3-4: cambia a 3 series si recuperas bien. Semanas 5-8: al completar el máximo con buena técnica, aumenta el peso mínimo disponible.'
const PHASE_ACCESSORY_NOTE = 'RIR 2-3. Mantén el movimiento controlado. Aumenta el peso solo después de completar el máximo de repeticiones en ambas series con buena técnica.'
const PHASE_WARMUP_NOTE = 'Antes de entrenar: 5-8 min de movilidad y aproximación gradual. ' + PHASE_MAIN_NOTE
const PHASE_ANKLE_NOTE = 'Sin dolor, molestia ni inestabilidad en el tobillo. Usa el banco como referencia y detén la serie si aparece cualquier síntoma.'

const phaseReps = (id, min, max, restSec, note = PHASE_ACCESSORY_NOTE, extra = {}) => ({
  id, sets: 2, mode: 'reps', reps: max, repsMin: min, weight: 0,
  prog: 'double', restSec, note, ...extra
})
const phaseHold = (id, sec, restSec, note) => ({
  id, sets: 2, mode: 'time', sec, weight: 0, bodyweight: true,
  prog: 'off', restSec, note
})

// This plan is deliberately conservative: no starting load is guessed, impact and pivots are
// absent, and the three custom movements fill genuine catalogue gaps. Per-side exercises store
// total reps, so 20-24 reads and logs as 10-12 on each side in the workout screen.
const GYM_BRO_PHASE_1 = [
  ['phase1-upper-a', 'Fase 1 · Tren superior A', 'barbell', [
    phaseReps('0289', 10, 12, 120, PHASE_WARMUP_NOTE, { warmupSets: 1 }),
    phaseReps('0292', 20, 24, 120, PHASE_MAIN_NOTE, { side: true }),
    phaseReps('0405', 8, 12, 120, PHASE_MAIN_NOTE),
    phaseReps('0334', 12, 15, 60),
    phaseReps('0294', 10, 12, 60),
    phaseReps('0351', 10, 12, 60),
  ], { prog: 'double' }],
  ['phase1-lower-a', 'Fase 1 · Tren inferior A', 'legs', [
    { id: '0291', sets: 2, mode: 'reps', reps: 10, weight: 0, prog: 'off', restSec: 120, note: PHASE_WARMUP_NOTE + ' ' + PHASE_ANKLE_NOTE },
    phaseReps('3013', 12, 15, 90),
    { id: '1459', sets: 2, mode: 'reps', reps: 10, weight: 0, prog: 'linear', restSec: 120, note: PHASE_MAIN_NOTE },
    phaseHold('gb-phase1-wall-sit', 15, 60, PHASE_ANKLE_NOTE + ' Aumenta 5 segundos por semana hasta 25 segundos.'),
    { id: '0276', sets: 2, mode: 'reps', reps: 20, weight: 0, bodyweight: true, side: true, prog: 'off', restSec: 60, note: '10 repeticiones por lado, lentas y controladas.' },
    phaseHold('gb-phase1-front-plank', 20, 60, 'Mantén costillas y pelvis alineadas. Aumenta 5 segundos cuando completes ambas series, hasta 30 segundos.'),
  ], { prog: 'double' }],
  ['phase1-upper-b', 'Fase 1 · Tren superior B', 'barbell', [
    phaseReps('0314', 10, 12, 120, PHASE_WARMUP_NOTE, { warmupSets: 1 }),
    phaseReps('0327', 10, 12, 120, PHASE_MAIN_NOTE),
    phaseReps('0493', 8, 12, 90, PHASE_ACCESSORY_NOTE, { bodyweight: true }),
    phaseReps('0383', 12, 15, 60),
    phaseReps('0313', 10, 12, 60),
    phaseReps('0351', 10, 12, 60),
  ], { prog: 'double' }],
  ['phase1-lower-b', 'Fase 1 · Tren inferior B', 'legs', [
    phaseReps('1459', 10, 12, 120, PHASE_WARMUP_NOTE, { warmupSets: 1 }),
    phaseReps('0291', 10, 12, 120, PHASE_MAIN_NOTE + ' ' + PHASE_ANKLE_NOTE),
    phaseReps('gb-phase1-bench-hip-thrust', 10, 12, 120, PHASE_MAIN_NOTE),
    phaseHold('gb-phase1-wall-sit', 20, 60, PHASE_ANKLE_NOTE + ' Mantén 20 segundos con técnica estable.'),
    phaseReps('0274', 12, 15, 60),
    { id: '0276', sets: 2, mode: 'reps', reps: 20, weight: 0, bodyweight: true, side: true, prog: 'off', restSec: 60, note: '10 repeticiones por lado, lentas y controladas.' },
  ], { prog: 'double' }],
]

const GYM_BRO_PHASE_1_CUSTOM = [
  {
    id: 'gb-phase1-wall-sit', n: 'Sentadilla isométrica en pared', bp: 'upper legs', eq: 'body weight',
    tg: 'quadriceps', primaries: ['quadriceps'], secondaries: ['gluteal'], muscleGroups: ['quadriceps', 'gluteal'],
    desc: 'Apoya la espalda en la pared y mantén una profundidad cómoda, sin dolor ni inestabilidad en el tobillo.'
  },
  {
    id: 'gb-phase1-front-plank', n: 'Plancha frontal', bp: 'waist', eq: 'body weight',
    tg: 'abs', primaries: ['abs'], secondaries: ['lower-back'], muscleGroups: ['abs', 'lower-back'],
    desc: 'Mantén el cuerpo alineado sobre antebrazos y pies, con abdomen y glúteos activos.'
  },
  {
    id: 'gb-phase1-bench-hip-thrust', n: 'Hip thrust apoyado en banco', bp: 'upper legs', eq: 'barbell',
    tg: 'gluteal', primaries: ['gluteal'], secondaries: ['hamstring'], muscleGroups: ['gluteal', 'hamstring'],
    desc: 'Apoya la parte alta de la espalda en el banco y extiende la cadera. Empieza sin carga y añade peso solo con técnica estable.'
  },
]

// [weekday, routineKey] — weekday is a DAYN index, so 1 is Monday. Fixed weeks only: every
// plan repeats the same seven days, which is all the weekly plan model can represent.
const PLANS = {
  ppl: { routines: PPL, schedule: [[1, 'push'], [3, 'pull'], [5, 'legs']] },
  'upper-lower': { routines: UPPER_LOWER, schedule: [[1, 'upper-a'], [2, 'lower-a'], [4, 'upper-b'], [5, 'lower-b']] },
  'full-body': { routines: FULL_BODY, schedule: [[1, 'fb-a'], [3, 'fb-b'], [5, 'fb-c']] },
  '5x5': { routines: FIVE_BY_FIVE, schedule: [[1, '5x5-a'], [3, '5x5-b'], [5, '5x5-c']] },
  'gym-bro-phase-1': {
    routines: GYM_BRO_PHASE_1,
    customEx: GYM_BRO_PHASE_1_CUSTOM,
    effort: 'rir',
    schedule: [[1, 'phase1-upper-a'], [2, 'phase1-lower-a'], [4, 'phase1-upper-b'], [5, 'phase1-lower-b']]
  }
}

const build = routines =>
  routines.map(([, name, emoji, list, settings]) => ({
    id: uid(), name, emoji,
    ex: list.map(entry => Array.isArray(entry)
      ? { id: entry[0], sets: entry[1], reps: entry[2], weight: 0 }
      : { ...entry }),
    ...(settings || {})
  }))

// Fresh routine objects (new ids) — [push, pull, legs]. The demo build seeds a history on
// top of exactly these three, so this entry point keeps its shape.
export const starterRoutines = () => build(PPL)

// [{ id, days }] for the chooser. The day count is read off the schedule rather than stored
// beside it, so the two can never disagree.
export const starterPlanOptions = () =>
  Object.entries(PLANS).map(([id, { schedule }]) => ({ id, days: schedule.length }))

// The weekdays a plan would claim, or null for an unknown id.
export const starterPlanDays = id => PLANS[id]?.schedule.map(([day]) => day) ?? null

// Fresh routines plus the weekdays to put them on, or null for an unknown id — a caller that
// treats null as "change nothing" can never half-apply a plan.
export const buildStarterPlan = id => {
  const plan = PLANS[id]
  if (!plan) return null
  const routines = build(plan.routines)
  // key → the id just minted for it, so the schedule below names its routine
  const byKey = Object.fromEntries(plan.routines.map(([key], i) => [key, routines[i].id]))
  return {
    routines,
    schedule: plan.schedule.map(([day, key]) => ({ day, routineId: byKey[key] })),
    customEx: (plan.customEx || []).map(ex => ({ ...ex })),
    ...(plan.effort ? { effort: plan.effort } : {})
  }
}

// Add a built plan to an existing profile without replacing routines or history. Custom
// exercises are matched by name + body part before minting an id, so loading the plan twice or
// having made the same movement already never creates duplicate catalogue entries.
export function installStarterPlan(state, plan) {
  if (!plan) return false
  state.routines = state.routines || []
  state.customEx = state.customEx || []
  state.week = state.week || {}
  const exIdMap = {}
  ;(plan.customEx || []).forEach(ex => {
    const same = state.customEx.find(cur =>
      (cur.n || '').trim().toLowerCase() === (ex.n || '').trim().toLowerCase() && cur.bp === ex.bp)
    if (same) { exIdMap[ex.id] = same.id; return }
    const id = uid()
    exIdMap[ex.id] = id
    state.customEx.push({ ...ex, id, sm: [...(ex.secondaries || [])], custom: true })
  })
  state.routines.push(...plan.routines.map(routine => ({
    ...routine,
    ex: routine.ex.map(ex => ({ ...ex, id: exIdMap[ex.id] || ex.id }))
  })))
  plan.schedule.forEach(({ day, routineId }) => { state.week[day] = [routineId] })
  if (plan.effort) state.effort = plan.effort
  return true
}
