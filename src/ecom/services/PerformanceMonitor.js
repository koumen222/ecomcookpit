/**
 * Performance Monitoring Service
 * Tracks and reports key performance metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      FCP: 0,    // First Contentful Paint
      LCP: 0,    // Largest Contentful Paint
      TBT: 0,    // Total Blocking Time
      CLS: 0,    // Cumulative Layout Shift
      FID: 0,    // First Input Delay
      TTFB: 0    // Time to First Byte
    };
    this.observers = new Map();
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    // Only run in browser
    if (typeof window === 'undefined') return;

    this.measureFCP();
    this.measureLCP();
    this.measureCLS();
    this.measureFID();
    this.measureTTFB();
    this.measureTBT();

    // Report metrics after page load
    window.addEventListener('load', () => {
      setTimeout(() => this.reportMetrics(), 1000);
    });
  }

  /**
   * Measure First Contentful Paint
   */
  measureFCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.FCP = fcpEntry.startTime;
          console.log(`🎯 FCP: ${this.metrics.FCP.toFixed(0)}ms`);
        }
      });
      observer.observe({ type: 'paint', buffered: true });
      this.observers.set('fcp', observer);
    }
  }

  /**
   * Measure Largest Contentful Paint
   */
  measureLCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.LCP = lastEntry.startTime;
        console.log(`🖼️ LCP: ${this.metrics.LCP.toFixed(0)}ms`);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.set('lcp', observer);
    }
  }

  /**
   * Measure Cumulative Layout Shift
   */
  measureCLS() {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.CLS = clsValue;
        console.log(`📐 CLS: ${this.metrics.CLS.toFixed(3)}`);
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.set('cls', observer);
    }
  }

  /**
   * Measure First Input Delay
   */
  measureFID() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const firstEntry = list.getEntries()[0];
        if (firstEntry) {
          this.metrics.FID = firstEntry.processingStart - firstEntry.startTime;
          console.log(`⚡ FID: ${this.metrics.FID.toFixed(0)}ms`);
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
      this.observers.set('fid', observer);
    }
  }

  /**
   * Measure Time to First Byte
   */
  measureTTFB() {
    if ('performance' in window && 'navigation' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.metrics.TTFB = navigation.responseStart - navigation.requestStart;
        console.log(`🌐 TTFB: ${this.metrics.TTFB.toFixed(0)}ms`);
      }
    }
  }

  /**
   * Measure Total Blocking Time
   */
  measureTBT() {
    if ('PerformanceObserver' in window) {
      let tbt = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Only count long tasks
            tbt += entry.duration - 50;
          }
        }
        this.metrics.TBT = tbt;
        console.log(`🚫 TBT: ${this.metrics.TBT.toFixed(0)}ms`);
      });
      observer.observe({ type: 'longtask', buffered: true });
      this.observers.set('tbt', observer);
    }
  }

  /**
   * Get performance score (0-100)
   */
  getScore() {
    const scores = {
      FCP: this.getFCPScore(this.metrics.FCP),
      LCP: this.getLCPScore(this.metrics.LCP),
      TBT: this.getTBTScore(this.metrics.TBT),
      CLS: this.getCLSScore(this.metrics.CLS),
      FID: this.getFIDScore(this.metrics.FID),
      TTFB: this.getTTFBScore(this.metrics.TTFB)
    };

    const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    return {
      overall: Math.round(overall),
      individual: scores,
      metrics: this.metrics
    };
  }

  getFCPScore(fcp) {
    if (fcp < 1800) return 100;
    if (fcp < 3000) return 80 - ((fcp - 1800) / 1200) * 20;
    return 60 - Math.min(((fcp - 3000) / 7000) * 60, 60);
  }

  getLCPScore(lcp) {
    if (lcp < 2500) return 100;
    if (lcp < 4000) return 80 - ((lcp - 2500) / 1500) * 20;
    return 60 - Math.min(((lcp - 4000) / 6000) * 60, 60);
  }

  getTBTScore(tbt) {
    if (tbt < 200) return 100;
    if (tbt < 600) return 80 - ((tbt - 200) / 400) * 20;
    return 60 - Math.min(((tbt - 600) / 1400) * 60, 60);
  }

  getCLSScore(cls) {
    if (cls < 0.1) return 100;
    if (cls < 0.25) return 80 - ((cls - 0.1) / 0.15) * 20;
    return 60 - Math.min(((cls - 0.25) / 0.75) * 60, 60);
  }

  getFIDScore(fid) {
    if (fid < 100) return 100;
    if (fid < 300) return 80 - ((fid - 100) / 200) * 20;
    return 60 - Math.min(((fid - 300) / 700) * 60, 60);
  }

  getTTFBScore(ttfb) {
    if (ttfb < 800) return 100;
    if (ttfb < 1800) return 80 - ((ttfb - 800) / 1000) * 20;
    return 60 - Math.min(((ttfb - 1800) / 3200) * 60, 60);
  }

  /**
   * Report metrics to console and optionally to analytics
   */
  reportMetrics() {
    const score = this.getScore();
    
    console.log('🚀 Performance Report:');
    console.log(`Overall Score: ${score.overall}/100`);
    console.log('Individual Scores:', score.individual);
    console.log('Raw Metrics:', score.metrics);

    // Send to analytics if available
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture('performance_metrics', score);
    }

    return score;
  }

  /**
   * Get recommendations based on metrics
   */
  getRecommendations() {
    const recommendations = [];
    const score = this.getScore();

    if (score.metrics.FCP > 1800) {
      recommendations.push('⚡ Reduce server response time and optimize initial render');
    }
    if (score.metrics.LCP > 2500) {
      recommendations.push('🖼️ Optimize hero images and add preloading');
    }
    if (score.metrics.TBT > 200) {
      recommendations.push('🚫 Reduce JavaScript execution time and break up long tasks');
    }
    if (score.metrics.CLS > 0.1) {
      recommendations.push('📐 Ensure images have dimensions and avoid layout shifts');
    }
    if (score.metrics.FID > 100) {
      recommendations.push('⌨️ Minimize JavaScript execution on user interaction');
    }
    if (score.metrics.TTFB > 800) {
      recommendations.push('🌐 Improve server response time and enable caching');
    }

    return recommendations;
  }

  /**
   * Disconnect all observers
   */
  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

export default PerformanceMonitor;
