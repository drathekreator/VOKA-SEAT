import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, screen } from '@testing-library/react'
import { SeatIndicator } from '../../src/components/SeatIndicator'

/**
 * Feature: voka-seat-system, Property 5: Seat Indicator Color Mapping
 *
 * For any seat with status = 1 (occupied), the UI SHALL render the indicator
 * with background color #D81B60 and white text. For any seat with status = 0
 * (available), the UI SHALL render the indicator with background color #F3F4F6
 * and a 1px solid #E5E7EB border.
 *
 * Validates: Requirements 6.3, 6.4, 11.5
 */
describe('Feature: voka-seat-system, Property 5: Seat Indicator Color Mapping', () => {
  it('occupied seats (status=1) render with bg-[#D81B60] and text-white', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        (seatId) => {
          const { unmount } = render(<SeatIndicator seatId={seatId} status={1} />)
          const element = screen.getByTestId(`seat-indicator-${seatId}`)

          expect(element.className).toContain('bg-[#D81B60]')
          expect(element.className).toContain('text-white')

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('available seats (status=0) render with bg-[#F3F4F6] and border-[#E5E7EB]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        (seatId) => {
          const { unmount } = render(<SeatIndicator seatId={seatId} status={0} />)
          const element = screen.getByTestId(`seat-indicator-${seatId}`)

          expect(element.className).toContain('bg-[#F3F4F6]')
          expect(element.className).toContain('border-[#E5E7EB]')

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('seat number is displayed as text content for any seat id and status', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        fc.constantFrom(0 as const, 1 as const),
        (seatId, status) => {
          const { unmount } = render(<SeatIndicator seatId={seatId} status={status} />)
          const element = screen.getByTestId(`seat-indicator-${seatId}`)

          expect(element.textContent).toBe(String(seatId))

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})
