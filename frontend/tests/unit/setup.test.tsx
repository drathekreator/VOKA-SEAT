import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('Frontend testing infrastructure', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2)
  })

  it('jsdom environment is available', () => {
    expect(document).toBeDefined()
    expect(window).toBeDefined()
  })

  it('React Testing Library renders components', () => {
    function Greeting() {
      return <p>Hello, VOKA-SEAT</p>
    }

    render(<Greeting />)
    expect(screen.getByText('Hello, VOKA-SEAT')).toBeInTheDocument()
  })
})
