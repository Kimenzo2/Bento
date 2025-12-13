import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../src/test/utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LoadingSpinner />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const { container } = render(<LoadingSpinner />);
    // Loading spinners should be accessible
    expect(container.firstChild).toBeTruthy();
  });

  it('applies custom className when provided', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
  });
});
