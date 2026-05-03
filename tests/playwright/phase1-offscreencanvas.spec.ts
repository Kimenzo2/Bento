import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test';

const HOME_PATH = '/';
const EXPECTED_LANDING_PATH = '/welcome';
const VALID_COEP_VALUES = new Set(['require-corp', 'credentialless']);

type RenderMode = 'offscreen' | 'main-thread' | 'not-mounted';

type MainThreadMetrics = {
  frameCount: number;
  avgFPS: number;
  minFPS: number;
  longTaskCount: number;
  totalBlockingTime: number;
  maxLongTaskDuration: number;
  interactionLatency: number;
};

type ChromiumPerformanceClient = {
  send(method: 'Performance.getMetrics'): Promise<{
    metrics: Array<{ name: string; value: number }>;
  }>;
};

type ChromiumBrowserContext = ReturnType<Page['context']> & {
  newCDPSession(target: Page): Promise<ChromiumPerformanceClient>;
};

async function gotoGenesis(page: Page): Promise<Response | null> {
  const response = await page.goto(HOME_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: 'Genesis should land on the public welcome route in production.',
    })
    .toBe(EXPECTED_LANDING_PATH);
  return response;
}

async function waitForGenMount(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const container = document.getElementById('gen-container');
      return Boolean(container && container.querySelector('canvas'));
    },
    { timeout: timeoutMs }
  );
}

async function getGenRenderMode(page: Page): Promise<RenderMode> {
  return page.evaluate(() => {
    const container = document.getElementById('gen-container');
    const canvas = container?.querySelector('canvas');

    if (!container || !canvas) {
      return 'not-mounted';
    }

    try {
      return canvas.getContext('2d') === null ? 'offscreen' : 'main-thread';
    } catch {
      return 'offscreen';
    }
  });
}

async function getGenContainerState(page: Page) {
  return page.evaluate(() => {
    const container = document.getElementById('gen-container');
    const canvas = container?.querySelector('canvas');
    const styles = container ? window.getComputedStyle(container) : null;
    const rect = container?.getBoundingClientRect();

    return {
      exists: Boolean(container),
      hasCanvas: Boolean(canvas),
      childCount: container?.children.length ?? 0,
      crossOriginIsolated: window.crossOriginIsolated ?? false,
      sharedArrayBufferAvailable: (() => {
        try {
          new SharedArrayBuffer(8);
          return true;
        } catch {
          return false;
        }
      })(),
      styles: styles
        ? {
            position: styles.position,
            zIndex: styles.zIndex,
            pointerEvents: styles.pointerEvents,
            display: styles.display,
            visibility: styles.visibility,
          }
        : null,
      rect: rect
        ? {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          }
        : null,
    };
  });
}

async function collectMainThreadMetrics(
  page: Page,
  sampleFrames = 180
): Promise<MainThreadMetrics> {
  return page.evaluate(async (frameBudget: number) => {
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          longTasks.push(entry.duration);
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    const frameTimes = await new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      let lastTimestamp: number | null = null;

      const step = (timestamp: number) => {
        if (lastTimestamp !== null) {
          samples.push(timestamp - lastTimestamp);
        }
        lastTimestamp = timestamp;

        if (samples.length >= frameBudget) {
          resolve(samples);
          return;
        }

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });

    const interactionLatency = await new Promise<number>((resolve) => {
      const start = performance.now();
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve(performance.now() - start);
        });
      });
    });

    observer.disconnect();

    const avgFrameTime =
      frameTimes.reduce((total, frameTime) => total + frameTime, 0) / frameTimes.length;
    const maxFrameTime = Math.max(...frameTimes);
    const totalBlockingTime = longTasks.reduce(
      (total, duration) => total + Math.max(duration - 50, 0),
      0
    );

    return {
      frameCount: frameTimes.length,
      avgFPS: 1000 / avgFrameTime,
      minFPS: 1000 / maxFrameTime,
      longTaskCount: longTasks.length,
      totalBlockingTime,
      maxLongTaskDuration: longTasks.length ? Math.max(...longTasks) : 0,
      interactionLatency,
    };
  }, sampleFrames);
}

function projectArtifactPath(testInfo: TestInfo, name: string): string {
  return `tests/playwright/results/${testInfo.project.name}-${name}`;
}

test.describe('Q1: OffscreenCanvas path activation', () => {
  test('uses the expected render path for the current browser', async ({ page }, testInfo) => {
    await gotoGenesis(page);
    await waitForGenMount(page);

    const renderMode = await getGenRenderMode(page);
    const projectName = testInfo.project.name;

    if (
      ['chrome-desktop', 'edge-desktop', 'chrome-mobile', 'firefox-desktop'].includes(projectName)
    ) {
      expect(renderMode).toBe('offscreen');
    } else {
      expect(['offscreen', 'main-thread']).toContain(renderMode);
    }

    await page.screenshot({ path: projectArtifactPath(testInfo, 'q1-render-mode.png') });
  });
});

test.describe('Q2: SharedArrayBuffer works with COOP/COEP headers', () => {
  test('production headers produce an isolated browsing context', async ({ page }) => {
    const response = await gotoGenesis(page);
    const coopHeader = response?.headers()['cross-origin-opener-policy'] ?? null;
    const coepHeader = response?.headers()['cross-origin-embedder-policy'] ?? null;
    const state = await getGenContainerState(page);

    expect(coopHeader).toBe('same-origin');
    // WHY: both "require-corp" and "credentialless" can produce cross-origin isolation.
    expect(VALID_COEP_VALUES.has(coepHeader ?? '')).toBe(true);
    expect(state.crossOriginIsolated).toBe(true);
    expect(state.sharedArrayBufferAvailable).toBe(true);
  });
});

test.describe('Q3: COOP/COEP did not break cross-origin resources', () => {
  test('bootstrap does not produce CORS or blocked-resource failures', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    });

    await gotoGenesis(page);
    await waitForGenMount(page);
    await page.waitForLoadState('networkidle');

    const unexpectedErrors = consoleErrors.filter((entry) => {
      const lowered = entry.toLowerCase();
      if (lowered.includes('err_blocked_by_client') || lowered.includes('favicon')) {
        return false;
      }

      return (
        lowered.includes('cors') ||
        lowered.includes('cross-origin') ||
        lowered.includes('blocked by cross-origin') ||
        lowered.includes('coep')
      );
    });

    const unexpectedFailures = failedRequests.filter((entry) => {
      const lowered = entry.toLowerCase();
      return !(
        lowered.includes('favicon') ||
        lowered.includes('analytics') ||
        lowered.includes('err_blocked_by_client')
      );
    });

    expect(unexpectedErrors).toHaveLength(0);
    expect(unexpectedFailures).toHaveLength(0);
  });
});

test.describe('Q4: Main thread stays responsive while Gen renders', () => {
  test('keeps long tasks, interaction latency, and fps within budget', async ({
    page,
  }, testInfo) => {
    await gotoGenesis(page);
    await waitForGenMount(page);

    const metrics = await collectMainThreadMetrics(page);

    testInfo.annotations.push({
      type: 'metrics',
      description: JSON.stringify(metrics),
    });

    expect(metrics.totalBlockingTime).toBeLessThan(100);
    expect(metrics.maxLongTaskDuration).toBeLessThan(100);
    expect(metrics.interactionLatency).toBeLessThan(50);
    expect(metrics.avgFPS).toBeGreaterThan(45);
    expect(metrics.minFPS).toBeGreaterThan(20);
  });
});

test.describe('Q5: Gen renders correctly on all devices', () => {
  test('Gen container is visible, mounted, and kept out of the primary content lane', async ({
    page,
  }, testInfo) => {
    await gotoGenesis(page);
    await waitForGenMount(page);

    const container = page.locator('#gen-container');
    await expect(container).toBeVisible();

    const state = await getGenContainerState(page);
    const viewport = page.viewportSize();

    expect(state.exists).toBe(true);
    expect(state.hasCanvas).toBe(true);
    expect(state.styles?.position).toBe('fixed');
    expect(Number.parseInt(state.styles?.zIndex ?? '0', 10)).toBeGreaterThanOrEqual(9000);
    expect(state.styles?.pointerEvents).toBe('none');

    if (viewport && state.rect) {
      expect(state.rect.left).toBeGreaterThan(viewport.width * 0.45);
      expect(state.rect.top).toBeGreaterThan(viewport.height * 0.45);
      expect(state.rect.right).toBeLessThanOrEqual(viewport.width + 10);
      expect(state.rect.bottom).toBeLessThanOrEqual(viewport.height + 10);
    }

    await container.screenshot({ path: projectArtifactPath(testInfo, 'q5-gen-container.png') });
  });
});

test.describe('Q6: CPU impact of OffscreenCanvas vs main thread', () => {
  test('records main-thread task deltas over an animation window', async ({ page }) => {
    test.skip(
      page.context().browser()?.browserType().name() !== 'chromium',
      'CDP metrics are Chromium-only.'
    );

    await gotoGenesis(page);
    await waitForGenMount(page);

    const context = page.context() as ChromiumBrowserContext;
    const client = await context.newCDPSession(page);

    const before = await client.send('Performance.getMetrics');
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let frames = 0;

        const step = () => {
          frames += 1;
          if (frames >= 180) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      });
    });
    const after = await client.send('Performance.getMetrics');

    const beforeTask = before.metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
    const afterTask = after.metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
    const beforeScript =
      before.metrics.find((metric) => metric.name === 'ScriptDuration')?.value ?? 0;
    const afterScript =
      after.metrics.find((metric) => metric.name === 'ScriptDuration')?.value ?? 0;

    expect(afterTask - beforeTask).toBeLessThan(0.5);
    expect(afterScript - beforeScript).toBeLessThan(0.5);
  });
});

test('generate phase 1 summary report', async ({ page }, testInfo) => {
  await gotoGenesis(page);

  let renderMode: RenderMode = 'not-mounted';
  try {
    await waitForGenMount(page, 20_000);
    renderMode = await getGenRenderMode(page);
  } catch {
    renderMode = 'not-mounted';
  }

  const state = await getGenContainerState(page);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PHASE 1 REPORT — ${testInfo.project.name}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Route:                  ${new URL(page.url()).pathname}`);
  console.log(`Render Mode:            ${renderMode}`);
  console.log(`SharedArrayBuffer:      ${state.sharedArrayBufferAvailable ? 'yes' : 'no'}`);
  console.log(`Cross-Origin Isolated:  ${state.crossOriginIsolated ? 'yes' : 'no'}`);
  console.log(`Gen Visible:            ${state.hasCanvas ? 'yes' : 'no'}`);
  console.log(`${'═'.repeat(60)}\n`);

  expect(state.exists).toBe(true);
});
