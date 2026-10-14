import { describe, expect, it } from 'vitest'
import { EXIDX, registerCustom } from './exercises.js'
import { buildStarterPlan, installStarterPlan, starterPlanDays, starterPlanOptions, starterRoutines } from './starter.js'
import { buildPlanBundle, parsePlan } from './plan-share.js'
import { buildSessionEntries } from './session-start.js'

// The approved prescription, written out again rather than imported: a test that reads the
// same table as the code would pass no matter what that table said. [weekday, name, sets].
const APPROVED = {
  ppl: [
    [1, 'Push Day', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
    [3, 'Pull Day', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
    [5, 'Leg Day', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ],
  'upper-lower': [
    [1, 'Upper A', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
    [2, 'Lower A', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
    [4, 'Upper B', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
    [5, 'Lower B', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  'full-body': [
    [1, 'Full Body A', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
    [3, 'Full Body B', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
    [5, 'Full Body C', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  '5x5': [
    [1, '5×5 A', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
    [3, '5×5 B', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
    [5, '5×5 C', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]],
  ],
  'gym-bro-phase-1': [
    [1, 'Fase 1 · Tren superior A', [['0289', 2, 12], ['0292', 2, 24], ['0405', 2, 12], ['0334', 2, 15], ['0294', 2, 12], ['0351', 2, 12]]],
    [2, 'Fase 1 · Tren inferior A', [['0291', 2, 10], ['3013', 2, 15], ['1459', 2, 10], ['gb-phase1-wall-sit', 2, undefined], ['0276', 2, 20], ['gb-phase1-front-plank', 2, undefined]]],
    [4, 'Fase 1 · Tren superior B', [['0314', 2, 12], ['0327', 2, 12], ['0493', 2, 12], ['0383', 2, 15], ['0313', 2, 12], ['0351', 2, 12]]],
    [5, 'Fase 1 · Tren inferior B', [['1459', 2, 12], ['0291', 2, 12], ['gb-phase1-bench-hip-thrust', 2, 12], ['gb-phase1-wall-sit', 2, undefined], ['0274', 2, 15], ['0276', 2, 20]]],
  ],
}

const shape = r => r.ex.map(e => [e.id, e.sets, e.reps])

describe('starter plan catalog', () => {
  it('offers every plan, with the day count read off the schedule', () => {
    expect(starterPlanOptions()).toEqual([
      { id: 'ppl', days: 3 }, { id: 'upper-lower', days: 4 },
      { id: 'full-body', days: 3 }, { id: '5x5', days: 3 },
      { id: 'gym-bro-phase-1', days: 4 },
    ])
    for (const { id, days } of starterPlanOptions()) expect(starterPlanDays(id)).toHaveLength(days)
  })

  it('changes nothing for an unknown plan id', () => {
    expect(buildStarterPlan('nope')).toBeNull()
    expect(buildStarterPlan(undefined)).toBeNull()
    // A click handler wired straight to a loader would hand the event in as the plan.
    expect(buildStarterPlan({ type: 'click' })).toBeNull()
    expect(starterPlanDays('nope')).toBeNull()
  })
})

describe.each(Object.keys(APPROVED))('%s', planId => {
  const approved = APPROVED[planId]

  it('builds the approved exercises, sets and reps in order', () => {
    const { routines } = buildStarterPlan(planId)
    expect(routines.map(r => r.name)).toEqual(approved.map(([, name]) => name))
    routines.forEach((r, i) => expect(shape(r)).toEqual(approved[i][2]))
  })

  it('puts each routine on its approved weekday, by identity not position', () => {
    const { routines, schedule } = buildStarterPlan(planId)
    const nameOf = Object.fromEntries(routines.map(r => [r.id, r.name]))
    expect(schedule.map(({ day, routineId }) => [day, nameOf[routineId]]))
      .toEqual(approved.map(([day, name]) => [day, name]))
  })

  it('references only real exercises and starts every one at weight 0', () => {
    const plan = buildStarterPlan(planId)
    const customIds = new Set(plan.customEx.map(ex => ex.id))
    for (const r of plan.routines) {
      for (const e of r.ex) {
        expect(EXIDX[e.id] || customIds.has(e.id), e.id).toBeTruthy()
        expect(e.sets).toBeGreaterThan(0)
        if (e.mode === 'time') expect(e.sec).toBeGreaterThan(0)
        else expect(e.reps).toBeGreaterThan(0)
        expect(e.weight).toBe(0)
      }
    }
  })

  it('mints fresh ids and independent objects on every build', () => {
    const first = buildStarterPlan(planId)
    const second = buildStarterPlan(planId)
    const ids = first.routines.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(second.routines.some(r => ids.includes(r.id))).toBe(false)
    expect(first.routines[0].ex[0]).not.toBe(second.routines[0].ex[0])
    // and the static definition survives a caller mutating what it got back
    first.routines[0].ex[0].sets = 99
    expect(buildStarterPlan(planId).routines[0].ex[0].sets).toBe(approved[0][2][0][1])
  })
})

describe('Gym Bro strength and recomposition phase 1', () => {
  it('carries four six-exercise days, real rest periods, rep ranges and RIR logging', () => {
    const plan = buildStarterPlan('gym-bro-phase-1')
    expect(plan.routines).toHaveLength(4)
    expect(plan.routines.every(r => r.ex.length === 6)).toBe(true)
    expect(plan.routines.every(r => r.prog === 'double')).toBe(true)
    expect(plan.routines.flatMap(r => r.ex).every(ex => [60, 90, 120].includes(ex.restSec))).toBe(true)
    expect(plan.routines.flatMap(r => r.ex).every(ex => ex.weight === 0)).toBe(true)
    expect(plan.routines[0].ex[0]).toMatchObject({ repsMin: 10, reps: 12, prog: 'double', warmupSets: 1 })
    expect(plan.routines[0].ex[1]).toMatchObject({ repsMin: 20, reps: 24, side: true })
    expect(plan.effort).toBe('rir')
    expect(plan.customEx.map(ex => ex.n)).toEqual([
      'Sentadilla isométrica en pared', 'Plancha frontal', 'Hip thrust apoyado en banco'
    ])
  })

  it('installs without touching history and reuses an equivalent custom exercise', () => {
    const priorWallSit = { id: 'mine-wall', n: 'Sentadilla isométrica en pared', bp: 'upper legs', custom: true }
    const state = {
      routines: [{ id: 'mine', name: 'Existing', ex: [] }],
      customEx: [priorWallSit], week: { 0: ['mine'] }, workouts: [{ id: 'history-stays' }], effort: 'none'
    }
    const history = state.workouts
    expect(installStarterPlan(state, buildStarterPlan('gym-bro-phase-1'))).toBe(true)

    expect(state.routines).toHaveLength(5)
    expect(state.customEx).toHaveLength(3)
    expect(state.customEx.filter(ex => ex.n === priorWallSit.n)).toHaveLength(1)
    expect(state.routines[2].ex.find(ex => ex.mode === 'time')?.id).toBe('mine-wall')
    expect(state.week[0]).toEqual(['mine'])
    expect(Object.keys(state.week).sort()).toEqual(['0', '1', '2', '4', '5'])
    expect(state.effort).toBe('rir')
    expect(state.workouts).toBe(history)
  })

  it('round-trips through the real plan JSON and opens all four days for logging', () => {
    const state = { unit: 'kg', routines: [], customEx: [], week: {}, workouts: [], exWeights: {} }
    installStarterPlan(state, buildStarterPlan('gym-bro-phase-1'))
    registerCustom(state.customEx)
    try {
      const parsed = parsePlan(JSON.stringify(buildPlanBundle(state, 'Gym Bro Phase 1')), 'kg')
      expect(parsed.routineCount).toBe(4)
      expect(parsed.exerciseCount).toBe(24)
      expect(parsed.customEx).toHaveLength(3)
      expect(parsed.customEx[0]).toMatchObject({ primaries: ['quadriceps'], secondaries: ['gluteal'] })

      for (const routine of state.routines) {
        const entries = buildSessionEntries(state, routine)
        expect(entries).toHaveLength(6)
        expect(entries.every(entry => entry.sets.length >= 2)).toBe(true)
        expect(entries.every(entry => entry.target.weight === 0)).toBe(true)
      }
    } finally {
      registerCustom([])
    }
  })
})

describe('starterRoutines (the demo build entry point)', () => {
  it('still returns push, pull and legs unchanged', () => {
    const routines = starterRoutines()
    expect(routines.map(r => r.name)).toEqual(['Push Day', 'Pull Day', 'Leg Day'])
    routines.forEach((r, i) => expect(shape(r)).toEqual(APPROVED.ppl[i][2]))
    expect(routines.map(r => r.emoji)).toEqual(['barbell', 'pullup', 'legs'])
  })

  it('mints fresh ids on every invocation', () => {
    const first = starterRoutines().map(r => r.id)
    const second = starterRoutines().map(r => r.id)
    expect(new Set([...first, ...second]).size).toBe(6)
  })
})
