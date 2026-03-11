const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture LCP via PerformanceObserver before page load
  await page.addInitScript(() => {
    window.__lcpValue = -1;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcpValue = entry.startTime;
      }
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto('http://localhost:3000/welcome', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(7000);

  const metrics = await page.evaluate(() => {
    const results = {};

    // FCP
    const fcpEntries = performance.getEntriesByName('first-contentful-paint');
    results.fcp = fcpEntries.length > 0 ? Math.round(fcpEntries[0].startTime) : -1;

    // LCP (from observer injected before navigation)
    results.lcp = Math.round(window.__lcpValue || -1);

    // Navigation timing
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      results.ttfb = Math.round(nav.responseStart - nav.requestStart);
      results.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      results.loadEvent = Math.round(nav.loadEventEnd - nav.startTime);
      results.domInteractive = Math.round(nav.domInteractive - nav.startTime);
      results.transferSizeKB = Math.round(nav.transferSize / 1024);
    }

    // Resource breakdown
    const resources = performance.getEntriesByType('resource');
    let totalJS = 0, totalCSS = 0, totalImg = 0, totalFont = 0, totalOther = 0;
    let jsCount = 0, cssCount = 0, imgCount = 0, fontCount = 0;
    const slowResources = [];

    for (const r of resources) {
      const size = r.transferSize || 0;
      const duration = Math.round(r.duration);
      if (r.initiatorType === 'script') { totalJS += size; jsCount++; }
      else if (r.initiatorType === 'css' || r.name.includes('.css')) { totalCSS += size; cssCount++; }
      else if (r.initiatorType === 'img' || r.name.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)/)) { totalImg += size; imgCount++; }
      else if (r.name.match(/\.(woff2|ttf|otf)/)) { totalFont += size; fontCount++; }
      else { totalOther += size; }

      if (duration > 500) {
        slowResources.push({
          name: r.name.split('/').pop().substring(0, 50),
          durationMs: duration,
          sizeKB: Math.round(size / 1024),
        });
      }
    }

    results.resources = {
      js: { count: jsCount, sizeKB: Math.round(totalJS / 1024) },
      css: { count: cssCount, sizeKB: Math.round(totalCSS / 1024) },
      images: { count: imgCount, sizeKB: Math.round(totalImg / 1024) },
      fonts: { count: fontCount, sizeKB: Math.round(totalFont / 1024) },
      other: { sizeKB: Math.round(totalOther / 1024) },
      totalKB: Math.round((totalJS + totalCSS + totalImg + totalFont + totalOther) / 1024),
    };

    results.totalRequests = resources.length;
    results.slowResources = slowResources.sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);

    // DOM stats
    results.domNodes = document.querySelectorAll('*').length;
    results.totalImages = document.querySelectorAll('img').length;
    results.lazyImages = document.querySelectorAll('img[loading="lazy"]').length;
    results.eagerImages = document.querySelectorAll('img[loading="eager"]').length;
    results.imagesWithoutDimensions = 0;
    document.querySelectorAll('img').forEach(function(img) {
      if (!img.getAttribute('width') || !img.getAttribute('height')) {
        results.imagesWithoutDimensions++;
      }
    });

    return results;
  });

  // Print formatted report
  console.log('\n========================================');
  console.log('  GENESIS LANDING PAGE PERFORMANCE AUDIT');
  console.log('  (Dev Server — localhost:3000/welcome)');
  console.log('========================================\n');

  console.log('CORE WEB VITALS');
  console.log('───────────────────────────────────');
  console.log(`  FCP  (First Contentful Paint):  ${metrics.fcp}ms`);
  console.log(`  LCP  (Largest Contentful Paint): ${metrics.lcp}ms`);
  console.log(`  TTFB (Time to First Byte):       ${metrics.ttfb}ms`);
  console.log('');

  console.log('LOAD TIMELINE');
  console.log('───────────────────────────────────');
  console.log(`  DOM Interactive:     ${metrics.domInteractive}ms`);
  console.log(`  DOMContentLoaded:    ${metrics.domContentLoaded}ms`);
  console.log(`  Load Event:          ${metrics.loadEvent}ms`);
  console.log('');

  console.log('RESOURCE BREAKDOWN');
  console.log('───────────────────────────────────');
  console.log(`  JavaScript:  ${metrics.resources.js.count} files, ${metrics.resources.js.sizeKB}KB`);
  console.log(`  CSS:         ${metrics.resources.css.count} files, ${metrics.resources.css.sizeKB}KB`);
  console.log(`  Images:      ${metrics.resources.images.count} files, ${metrics.resources.images.sizeKB}KB`);
  console.log(`  Fonts:       ${metrics.resources.fonts.count} files, ${metrics.resources.fonts.sizeKB}KB`);
  console.log(`  Other:       ${metrics.resources.other.sizeKB}KB`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL:       ${metrics.totalRequests} requests, ${metrics.resources.totalKB}KB`);
  console.log('');

  console.log('DOM & IMAGE STATS');
  console.log('───────────────────────────────────');
  console.log(`  DOM Nodes:              ${metrics.domNodes}`);
  console.log(`  Total Images:           ${metrics.totalImages}`);
  console.log(`  Lazy-loaded:            ${metrics.lazyImages}`);
  console.log(`  Eager-loaded:           ${metrics.eagerImages}`);
  console.log(`  Missing width/height:   ${metrics.imagesWithoutDimensions}`);
  console.log('');

  if (metrics.slowResources.length > 0) {
    console.log('SLOWEST RESOURCES (>500ms)');
    console.log('───────────────────────────────────');
    for (const r of metrics.slowResources) {
      console.log(`  ${r.durationMs}ms  ${r.sizeKB}KB  ${r.name}`);
    }
    console.log('');
  }

  // Grading
  console.log('GRADE CARD (vs Google "Good" thresholds)');
  console.log('───────────────────────────────────');
  const grade = (val, good, ok) => val <= good ? 'GOOD' : val <= ok ? 'NEEDS WORK' : 'POOR';
  // Note: these are dev-server numbers; prod will be significantly better
  console.log(`  FCP:  ${metrics.fcp}ms — ${grade(metrics.fcp, 1800, 3000)} (good < 1.8s, ok < 3s)`);
  console.log(`  LCP:  ${metrics.lcp}ms — ${grade(metrics.lcp, 2500, 4000)} (good < 2.5s, ok < 4s)`);
  console.log(`  TTFB: ${metrics.ttfb}ms — ${grade(metrics.ttfb, 800, 1800)} (good < 800ms, ok < 1.8s)`);
  console.log(`  CLS risk (imgs w/o dims): ${metrics.imagesWithoutDimensions} — ${metrics.imagesWithoutDimensions === 0 ? 'GOOD' : 'POOR'}`);
  console.log('');
  console.log('NOTE: These are DEV SERVER numbers. Production (Vercel)');
  console.log('will be significantly faster due to minification, gzip,');
  console.log('CDN edge caching, and HTTP/2 multiplexing.');

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
