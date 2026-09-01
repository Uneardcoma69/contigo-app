import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ProgressRing from './ProgressRing.jsx'

function circunferencia(size, strokeWidth) {
  const r = (size - strokeWidth) / 2
  return 2 * Math.PI * r
}

describe('ProgressRing', () => {
  it('calcula el stroke-dasharray según el pct', () => {
    const { container } = render(<ProgressRing pct={50} size={100} strokeWidth={10} />)
    const circ = circunferencia(100, 10)
    const relleno = container.querySelectorAll('circle')[1]
    expect(relleno.getAttribute('stroke-dasharray')).toBe(`${(circ / 2).toFixed(1)} ${circ.toFixed(1)}`)
  })

  it('clampa a 100 cuando pct se pasa', () => {
    const { container } = render(<ProgressRing pct={150} size={100} strokeWidth={10} />)
    const circ = circunferencia(100, 10).toFixed(1)
    const relleno = container.querySelectorAll('circle')[1]
    expect(relleno.getAttribute('stroke-dasharray')).toBe(`${circ} ${circ}`)
  })

  it('clampa a 0 cuando pct es negativo', () => {
    const { container } = render(<ProgressRing pct={-20} size={100} strokeWidth={10} />)
    const circ = circunferencia(100, 10).toFixed(1)
    const relleno = container.querySelectorAll('circle')[1]
    expect(relleno.getAttribute('stroke-dasharray')).toBe(`0.0 ${circ}`)
  })

  it('renderiza los children centrados encima del anillo', () => {
    const { getByText } = render(<ProgressRing pct={30}><span>30%</span></ProgressRing>)
    expect(getByText('30%')).toBeInTheDocument()
  })
})
