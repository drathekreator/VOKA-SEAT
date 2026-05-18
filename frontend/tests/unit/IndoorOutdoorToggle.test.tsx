import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import IndoorOutdoorToggle, {
  type IndoorOutdoorMode,
} from '../../src/customer/components/IndoorOutdoorToggle';

/**
 * Unit tests for IndoorOutdoorToggle (task 18.1).
 *
 * Spec references:
 *   - Requirement 11.10 (Indoor default; Outdoor placeholder)
 *   - design.md "Tables view enhancements"
 */
describe('IndoorOutdoorToggle', () => {
  it('renders both Indoor and Outdoor segments', () => {
    render(<IndoorOutdoorToggle active="indoor" onChange={() => {}} />);
    expect(screen.getByTestId('indoor-outdoor-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('indoor-outdoor-segment-indoor')).toBeInTheDocument();
    expect(screen.getByTestId('indoor-outdoor-segment-outdoor')).toBeInTheDocument();
    expect(screen.getByText('Indoor')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
  });

  it('marks Indoor as active when active="indoor" (default state)', () => {
    render(<IndoorOutdoorToggle active="indoor" onChange={() => {}} />);
    const indoor = screen.getByTestId('indoor-outdoor-segment-indoor');
    const outdoor = screen.getByTestId('indoor-outdoor-segment-outdoor');
    expect(indoor.getAttribute('data-active')).toBe('true');
    expect(indoor.getAttribute('aria-selected')).toBe('true');
    expect(outdoor.getAttribute('data-active')).toBe('false');
    expect(outdoor.getAttribute('aria-selected')).toBe('false');
  });

  it('marks Outdoor as active when active="outdoor"', () => {
    render(<IndoorOutdoorToggle active="outdoor" onChange={() => {}} />);
    const indoor = screen.getByTestId('indoor-outdoor-segment-indoor');
    const outdoor = screen.getByTestId('indoor-outdoor-segment-outdoor');
    expect(indoor.getAttribute('data-active')).toBe('false');
    expect(outdoor.getAttribute('data-active')).toBe('true');
  });

  it('renders the active segment with surface-container-lowest background and primary text', () => {
    render(<IndoorOutdoorToggle active="indoor" onChange={() => {}} />);
    const indoor = screen.getByTestId('indoor-outdoor-segment-indoor');
    expect(indoor.className).toContain('bg-surface-container-lowest');
    expect(indoor.className).toContain('text-primary');
    expect(indoor.className).toContain('shadow-sm');
  });

  it('renders the inactive segment with on-surface-variant text', () => {
    render(<IndoorOutdoorToggle active="indoor" onChange={() => {}} />);
    const outdoor = screen.getByTestId('indoor-outdoor-segment-outdoor');
    expect(outdoor.className).toContain('text-on-surface-variant');
    // Inactive segment should NOT carry the active background.
    expect(outdoor.className).not.toContain('bg-surface-container-lowest');
  });

  it('uses bg-surface-container for the track', () => {
    render(<IndoorOutdoorToggle active="indoor" onChange={() => {}} />);
    const track = screen.getByTestId('indoor-outdoor-toggle');
    expect(track.className).toContain('bg-surface-container');
  });

  it('calls onChange("outdoor") when the inactive Outdoor segment is tapped', () => {
    const onChange = vi.fn();
    render(<IndoorOutdoorToggle active="indoor" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-outdoor'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('outdoor');
  });

  it('calls onChange("indoor") when the inactive Indoor segment is tapped', () => {
    const onChange = vi.fn();
    render(<IndoorOutdoorToggle active="outdoor" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-indoor'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('indoor');
  });

  it('does NOT fire onChange when the already-active segment is tapped', () => {
    const onChange = vi.fn();
    render(<IndoorOutdoorToggle active="indoor" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-indoor'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches active segment when wired to controlling state', () => {
    function Harness() {
      const [active, setActive] = useState<IndoorOutdoorMode>('indoor');
      return <IndoorOutdoorToggle active={active} onChange={setActive} />;
    }

    render(<Harness />);
    const outdoor = screen.getByTestId('indoor-outdoor-segment-outdoor');
    expect(outdoor.getAttribute('data-active')).toBe('false');

    fireEvent.click(outdoor);
    expect(outdoor.getAttribute('data-active')).toBe('true');
    expect(
      screen.getByTestId('indoor-outdoor-segment-indoor').getAttribute('data-active')
    ).toBe('false');
  });
});
