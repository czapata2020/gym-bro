// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: mocks.api }))
vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({
    user: { id: 'u1', name: 'Ana' },
    S: { unit: 'kg', bodyweight: [{ d: '2026-09-29', w: 70 }], targetW: 65 }
  })
}))
vi.mock('../sheets.jsx', () => ({ bwSheet: vi.fn() }))

import Challenges from './Challenges.jsx'
import { ct } from '../lib/challenge-copy.js'
import { _setLangState } from '../lib/i18n-core.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  vi.clearAllMocks()
  _setLangState('en', {}, null, null)
})

const participant = (userId, name, total, isSelf = false) => ({
  userId, name, isSelf, photoUrl: `/photo-${userId}.jpg`,
  ...(isSelf ? { startWeight: 70, targetWeight: 65, unit: 'kg' } : {}),
  score: {
    total, consistency: total, weightScore: total, progress: total,
    weighDue: false, currentWeek: { count: 3, target: 3 }
  }
})

async function mount(challenge) {
  mocks.api.mockResolvedValue({ challenge })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/challenges/c1']}><Routes><Route path="/challenges/:id" element={<Challenges />} /></Routes></MemoryRouter>)
  })
}

describe('Challenges versus view', () => {
  it('ships the Gym Bro challenge experience in Spanish', () => {
    _setLangState('es', {}, null, null)
    expect(ct('Challenges')).toBe('Retos')
    expect(ct('{0} is leading the challenge.', 'Ana')).toBe('Ana va ganando el reto.')
  })

  it('keeps the leader in color and visually mutes the trailing rival', async () => {
    await mount({
      id: 'c1', name: 'Wedding 2026', startDate: '2026-09-01', endDate: '2026-12-01',
      status: 'active', workoutsPerWeek: 3, stake: 'Cook dinner', leaderId: 'u1', inviteCode: null,
      participants: [participant('u1', 'Ana', 91, true), participant('u2', 'Luis', 74)]
    })
    const competitors = host.querySelectorAll('.challenge-competitor')
    expect(competitors).toHaveLength(2)
    expect(competitors[0].classList.contains('leading')).toBe(true)
    expect(competitors[0].classList.contains('losing')).toBe(false)
    expect(competitors[1].classList.contains('losing')).toBe(true)
    expect(host.textContent).toContain('Ana is leading the challenge.')
    expect(host.textContent).toContain('75% consistency · 25% weight')
  })

  it('shows an invitation code while the second participant has not joined', async () => {
    await mount({
      id: 'c1', name: 'Summer 2027', startDate: '2026-09-01', endDate: '2026-12-01',
      status: 'active', workoutsPerWeek: 4, stake: '', leaderId: null, inviteCode: 'A1B2C3D4',
      participants: [participant('u1', 'Ana', 50, true)]
    })
    expect(host.textContent).toContain('Not joined yet')
    expect(host.textContent).toContain('A1B2C3D4')
    expect(host.textContent).toContain('Share the code to start the duel.')
  })
})
