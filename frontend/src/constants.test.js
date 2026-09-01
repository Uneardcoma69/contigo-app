import { describe, it, expect } from 'vitest'
import { homeFor, tinte } from './constants.js'

describe('homeFor', () => {
  it('admin va a /admin', () => {
    expect(homeFor({ isAdmin: true, isStaff: true })).toBe('/admin')
  })
  it('staff no-admin va a /staff', () => {
    expect(homeFor({ isAdmin: false, isStaff: true })).toBe('/staff')
  })
  it('paciente va a /inicio', () => {
    expect(homeFor({ isAdmin: false, isStaff: false })).toBe('/inicio')
  })
  it('sin usuario va a /inicio', () => {
    expect(homeFor(null)).toBe('/inicio')
    expect(homeFor(undefined)).toBe('/inicio')
  })
})

describe('tinte', () => {
  it('arma un color-mix con el porcentaje pedido', () => {
    expect(tinte('var(--teal)', 20)).toBe('color-mix(in srgb, var(--teal) 20%, transparent)')
  })
  it('usa 12% por defecto', () => {
    expect(tinte('red')).toBe('color-mix(in srgb, red 12%, transparent)')
  })
})
