import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Icono from './Icono.jsx'

describe('Icono', () => {
  it('un ícono conocido renderiza un svg', () => {
    const { container } = render(<Icono nombre="chat" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('un ícono desconocido no renderiza nada', () => {
    const { container } = render(<Icono nombre="no-existe-este-icono" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aplica el tamaño pedido', () => {
    const { container } = render(<Icono nombre="check" tamano={40} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '40')
    expect(svg).toHaveAttribute('height', '40')
  })
})
