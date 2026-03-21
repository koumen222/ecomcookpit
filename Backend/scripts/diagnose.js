#!/usr/bin/env node

/**
 * Performance Diagnosis Script
 * Identify slow endpoints and optimization opportunities
 * 
 * Usage: node Backend/scripts/diagnose.js
 */

import http from 'http';
import https from 'https';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// Endpoints to test (add your actual endpoints)
const ENDPOINTS = [
  { path: '/health', method: 'GET' },
  { path: '/api/ecom/orders', method: 'GET' },
  { path: '/api/ecom/clients', method: 'GET' },
  { path: '/api/ecom/products', method: 'GET' },
  { path: '/api/ecom/analytics', method: 'GET' },
  { path: '/api/ecom/campaigns', method: 'GET' },
];

const ITERATIONS = 5;
const THRESHOLD_MS = 500; // Alert if slower than 500ms

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const startTime = Date.now();

    const req = client.get(url, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          duration,
          size: data.length,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function diagnoseEndpoint(endpoint) {
  console.log(`\n📊 Testing: ${endpoint.method} ${endpoint.path}`);
  console.log('─'.repeat(60));

  const durations = [];
  const errors = [];

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const url = `${BASE_URL}${endpoint.path}`;
      const result = await makeRequest(url);

      durations.push(result.duration);
      
      const status = result.status === 200 ? '✅' : `⚠️ (${result.status})`;
      console.log(
        `  ${i + 1}. ${result.duration}ms ${status} (${(result.size / 1024).toFixed(2)}KB)`
      );
    } catch (error) {
      errors.push(error.message);
      console.log(`  ${i + 1}. ❌ ${error.message}`);
    }
  }

  // Calculate stats
  if (durations.length === 0) {
    console.log('\n❌ All requests failed');
    return null;
  }

  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const p95 = durations.sort((a, b) => a - b)[Math.ceil(durations.length * 0.95)];

  console.log(`\n📈 Statistics:`);
  console.log(`  Average: ${avg}ms`);
  console.log(`  Min: ${min}ms`);
  console.log(`  Max: ${max}ms`);
  console.log(`  P95: ${p95}ms`);

  // Performance assessment
  let performance = '✅ Good';
  let color = '\x1b[32m'; // Green

  if (avg > THRESHOLD_MS) {
    performance = '⚠️ Slow';
    color = '\x1b[33m'; // Yellow
  }

  if (avg > THRESHOLD_MS * 2) {
    performance = '❌ Very Slow';
    color = '\x1b[31m'; // Red
  }

  console.log(`\n${color}Assessment: ${performance}\x1b[0m`);

  if (avg > THRESHOLD_MS) {
    console.log('\n💡 Recommendations:');
    
    if (avg > 1000) {
      console.log('   • Add caching (Redis)');
    }
    if (avg > 500) {
      console.log('   • Optimize database queries (indexes, selections)');
    }
    if (max > avg * 2) {
      console.log('   • Check for N+1 queries or missing indexes');
    }
    if (errors.length > 0) {
      console.log('   • Endpoint is unstable, check error logs');
    }
  }

  return {
    endpoint: endpoint.path,
    avg,
    min,
    max,
    p95,
    performance,
    errors: errors.length > 0 ? errors : null
  };
}

async function diagnoseDatabase() {
  console.log(`\n\n🗄️  Database Analysis`);
  console.log('═'.repeat(60));
  
  try {
    // This would require database access
    console.log('❌ Database diagnostics not implemented in script');
    console.log('   Run these manually in MongoDB:');
    console.log('   db.Order.explain("executionStats").find({})');
    console.log('   db.Order.getIndexes()');
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

async function diagnoseNetwork() {
  console.log(`\n\n🌐 Network Analysis`);
  console.log('═'.repeat(60));
  
  try {
    const url = `${BASE_URL}/health`;
    const result = await makeRequest(url);
    
    console.log(`\n✅ Server is responding`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Response time: ${result.duration}ms`);
    console.log(`  Content-Type: ${result.headers['content-type']}`);
    console.log(`  Compression: ${result.headers['content-encoding'] || 'None'}`);
  } catch (error) {
    console.log(`\n❌ Server not responding: ${error.message}`);
    console.log('   Make sure the server is running on ' + BASE_URL);
  }
}

function summary(results) {
  console.log(`\n\n📋 Summary`);
  console.log('═'.repeat(60));

  const slowEndpoints = results.filter(r => r && r.avg > THRESHOLD_MS);
  const fastEndpoints = results.filter(r => r && r.avg <= THRESHOLD_MS);

  console.log(`\n✅ Fast endpoints (${fastEndpoints.length}):`);
  fastEndpoints.forEach(r => {
    console.log(`   ${r.endpoint}: ${r.avg}ms`);
  });

  if (slowEndpoints.length > 0) {
    console.log(`\n⚠️  Slow endpoints (${slowEndpoints.length}):`);
    slowEndpoints.forEach(r => {
      const color = r.avg > THRESHOLD_MS * 2 ? '\x1b[31m' : '\x1b[33m';
      console.log(`   ${color}${r.endpoint}: ${r.avg}ms\x1b[0m`);
    });

    console.log(`\n🔧 Optimization Priority:`);
    console.log('   1. Implement Redis caching for slow endpoints');
    console.log('   2. Add database indexes');
    console.log('   3. Optimize Prisma queries');
    console.log('   4. Enable compression');
    console.log('   5. Consider worker threads for heavy operations');
  }
}

async function main() {
  console.log('\n🚀 EcomCookpit Performance Diagnostics');
  console.log('═'.repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Iterations per endpoint: ${ITERATIONS}`);
  console.log(`Performance threshold: ${THRESHOLD_MS}ms\n`);

  // Check network first
  await diagnoseNetwork();

  // Test endpoints
  const results = [];
  for (const endpoint of ENDPOINTS) {
    const result = await diagnoseEndpoint(endpoint);
    results.push(result);
    await new Promise(r => setTimeout(r, 100)); // Wait between requests
  }

  // Database analysis
  await diagnoseDatabase();

  // Summary
  summary(results);

  console.log('\n💡 Next Steps:');
  console.log('   1. Review the OPTIMIZATION_GUIDE.md');
  console.log('   2. Install and configure Redis');
  console.log('   3. Add caching to slow endpoints');
  console.log('   4. Re-run this script to verify improvements\n');
}

main().catch(console.error);
