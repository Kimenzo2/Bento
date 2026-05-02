import { render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@lorenzootieno/gen-bridge', () => {
  throw new Error('gen-bridge should not be imported by GenContext');
});

import { GenProvider, useGen } from './GenContext';

const env = import.meta.env as Record<string, string | boolean | undefined>;
const originalRuntimeFlag = env.VITE_ENABLE_GEN_RUNTIME;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function Probe() {
  const { isMounted, isReady, publishContext, fireTrigger } = useGen();

  return (
    <button
      type="button"
      data-testid="probe"
      data-mounted={String(isMounted)}
      data-ready={String(isReady)}
      onClick={() => {
        publishContext({ realm: 'kingdom' });
        fireTrigger('page_change');
      }}
    >
      probe
    </button>
  );
}

describe('GenProvider', () => {
  beforeAll(() => {
    env.VITE_ENABLE_GEN_RUNTIME = 'true';
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'requestIdleCallback',
      (callback: (deadline: IdleDeadline) => void) => {
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        } as IdleDeadline);
        return 1 as unknown as number;
      }
    );
    vi.stubGlobal('cancelIdleCallback', (id: number) => {
      clearTimeout(id);
    });
  });

  afterAll(() => {
    env.VITE_ENABLE_GEN_RUNTIME = originalRuntimeFlag;
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders without importing the external Gen bridge package', async () => {
    render(
      <GenProvider>
        <Probe />
      </GenProvider>
    );

    expect(screen.getByTestId('probe')).toBeInTheDocument();

    await waitFor(() => {
      const genContextBridgeFailure = consoleErrorSpy.mock.calls.some(
        ([firstArg]) =>
          typeof firstArg === 'string' &&
          firstArg.includes('[GenContext] Mount failed:')
      );

      expect(genContextBridgeFailure).toBe(false);
    });
  });
});
