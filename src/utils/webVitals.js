/**
 * webVitals.js — Core Web Vitals reporter using the native PerformanceObserver API.
 *
 * Captures:
 *  - LCP (Largest Contentful Paint)
 *  - FID (First Input Delay)
 *  - CLS (Cumulative Layout Shift)
 *  - TTFB (Time to First Byte)
 *  - FCP (First Contentful Paint)
 *
 * In development: logs to console.
 * In production: could be sent to an analytics endpoint.
 */

const isDev = import.meta.env.DEV;

function sendToAnalytics(metric) {
  if (isDev) {
    const color = metric.rating === 'good' ? '#22c55e' : metric.rating === 'needs-improvement' ? '#f59e0b' : '#ef4444';
    console.log(
      `%c[Web Vitals] %c${metric.name}: %c${Math.round(metric.value)}ms %c(${metric.rating})`,
      'color:#6366f1;font-weight:bold',
      'color:#334155',
      'color:#1e40af;font-weight:bold',
      `color:${color};font-weight:bold`,
    );
  }
  // Production: uncomment to send to your analytics API
  // if (!isDev) {
  //   navigator.sendBeacon('/api/metrics', JSON.stringify({
  //     name: metric.name,
  //     value: metric.value,
  //     rating: metric.rating,
  //     navigationType: metric.navigationType,
  //   }));
  // }
}

function getRating(name, value) {
  const thresholds = {
    LCP:  [2500, 4000],  // good < 2500ms, needs-improvement < 4000ms
    FID:  [100,  300],
    CLS:  [0.1,  0.25],  // unitless score
    TTFB: [800,  1800],
    FCP:  [1800, 3000],
  };
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function observe(type, callback) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry);
      }
    });
    observer.observe({ type, buffered: true });
  } catch {
    // PerformanceObserver may not be available in all environments
  }
}

export function reportWebVitals() {
  // TTFB — from Navigation Timing
  observe('navigation', (entry) => {
    const value = entry.responseStart - entry.requestStart;
    sendToAnalytics({ name: 'TTFB', value, rating: getRating('TTFB', value) });
  });

  // FCP — First Contentful Paint
  observe('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      sendToAnalytics({ name: 'FCP', value: entry.startTime, rating: getRating('FCP', entry.startTime) });
    }
  });

  // LCP — Largest Contentful Paint
  observe('largest-contentful-paint', (entry) => {
    sendToAnalytics({ name: 'LCP', value: entry.startTime, rating: getRating('LCP', entry.startTime) });
  });

  // FID — First Input Delay
  observe('first-input', (entry) => {
    const value = entry.processingStart - entry.startTime;
    sendToAnalytics({ name: 'FID', value, rating: getRating('FID', value) });
  });

  // CLS — Cumulative Layout Shift
  let clsValue = 0;
  let clsEntries = [];
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) {
      clsEntries.push(entry);
      clsValue += entry.value;
      sendToAnalytics({ name: 'CLS', value: clsValue, rating: getRating('CLS', clsValue) });
    }
  });
}
