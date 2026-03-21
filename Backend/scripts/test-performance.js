#!/usr/bin/env node

/**
 * Performance Testing Guide
 * Vérifiez les améliorations avant/après optimisation
 */

import http from 'http';

const BASE_URL = 'http://localhost:8080';

async function testEndpoint(path, iterations = 10) {
  console.log(`\n🧪 Testing: GET ${path}`);
  console.log('─'.repeat(50));

  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const start = Date.now();
      
      await new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}${path}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            const duration = Date.now() - start;
            times.push(duration);
            console.log(`  ✅ Iteration ${i + 1}: ${duration}ms (${(data.length / 1024).toFixed(1)}KB)`);
            resolve();
          });
        });
        req.on('error', reject);
      });
    } catch (error) {
      console.log(`  ❌ Iteration ${i + 1}: ${error.message}`);
    }
  }

  if (times.length === 0) return null;

  const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n📊 Results:`);
  console.log(`  Average: ${avg}ms`);
  console.log(`  Min: ${min}ms`);
  console.log(`  Max: ${max}ms`);
  console.log(`  Variance: ${(max - min).toFixed(0)}ms`);

  // Cache detection
  if (max < min * 1.5) {
    console.log('  💡 Caching detected! Responses are consistent.');
  }

  return { avg, min, max };
}

async function compareEndpoints(endpoint, cached = false) {
  const label = cached ? '(with cache)' : '(without cache)';
  console.log(`\n\n🔍 ${endpoint} ${label}`);
  console.log('═'.repeat(50));

  // First request (cache miss)
  console.log('\n1️⃣  First request (cold cache):');
  const cold = await testEndpoint(endpoint, 1);

  // Wait a bit
  await new Promise(r => setTimeout(r, 100));

  // Subsequent requests (cache hits)
  console.log('\n2️⃣  Subsequent requests (warm cache):');
  const warm = await testEndpoint(endpoint, 5);

  if (cold && warm) {
    const improvement = ((cold.avg - warm.avg) / cold.avg * 100).toFixed(1);
    console.log(`\n🎯 Improvement: ${improvement}% faster with cache`);
  }
}

async function loadTest() {
  console.log('\n\n⚡ Load Test (concurrent requests)');
  console.log('═'.repeat(50));

  const concurrent = 10;
  const endpoint = '/api/ecom/orders';

  console.log(`Testing ${concurrent} concurrent requests to ${endpoint}...`);

  const start = Date.now();
  const promises = [];

  for (let i = 0; i < concurrent; i++) {
    promises.push(
      new Promise((resolve) => {
        const req = http.get(`${BASE_URL}${endpoint}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              size: data.length,
              time: Date.now() - start
            });
          });
        });
        req.on('error', () => resolve({ error: true, time: Date.now() - start }));
      })
    );
  }

  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;
  const avgTime = results.reduce((a, r) => a + r.time, 0) / results.length;

  console.log(`\n📊 Results:`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Average response time: ${avgTime.toFixed(0)}ms`);
  console.log(`  Throughput: ${(concurrent / (totalTime / 1000)).toFixed(1)} req/s`);

  const errors = results.filter(r => r.error).length;
  if (errors === 0) {
    console.log(`  ✅ No errors`);
  } else {
    console.log(`  ⚠️  ${errors} errors`);
  }
}

async function runTests() {
  console.log('\n\n╔════════════════════════════════════════════════╗');
  console.log('║        EcomCookpit Performance Tests           ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`\n🎯 Target: ${BASE_URL}`);
  console.log('📌 Make sure the server is running\n');

  try {
    // Test basic connectivity
    await new Promise((resolve, reject) => {
      http.get(`${BASE_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Server is responding\n');
          resolve();
        } else {
          reject(new Error(`Server returned ${res.statusCode}`));
        }
      }).on('error', reject);
    });

    // Test endpoints
    await compareEndpoints('/api/ecom/orders');
    await compareEndpoints('/api/ecom/clients');
    
    // Load test
    await loadTest();

    // Summary
    console.log('\n\n📋 Summary');
    console.log('═'.repeat(50));
    console.log(`✅ Tests completed at ${new Date().toLocaleTimeString()}`);
    console.log('\n💡 Tips:');
    console.log('  1. Run this test multiple times to see cache warming');
    console.log('  2. Check Redis: redis-cli INFO stats');
    console.log('  3. Monitor logs in another terminal');
    console.log('  4. Restart Redis to test cold cache: redis-cli FLUSHALL\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('  1. The server is running on ' + BASE_URL);
    console.error('  2. Redis is running (redis-cli ping)');
    console.error('  3. Database is accessible\n');
    process.exit(1);
  }
}

runTests();

// CSV export helper
function exportToCSV(results) {
  const csv = 'endpoint,avg_ms,min_ms,max_ms,iterations\n';
  const data = Object.entries(results)
    .map(([endpoint, result]) => 
      `${endpoint},${result.avg},${result.min},${result.max},${result.iterations}`
    )
    .join('\n');
  
  console.log('\n\nExport to CSV:');
  console.log(csv + data);
}
