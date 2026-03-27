#!/usr/bin/env node

/**
 * Script de test complet du système Provider
 * 
 * Usage: node Backend/scripts/test-provider.js
 */

import axios from 'axios';
import chalk from 'chalk';

const API_URL = process.env.API_URL || 'http://localhost:8080/api/provider';

let token = null;
let providerId = null;
let instanceId = null;

// Helpers
const log = (msg) => console.log(chalk.blue('ℹ️  ') + msg);
const success = (msg) => console.log(chalk.green('✅ ') + msg);
const error = (msg) => console.log(chalk.red('❌ ') + msg);
const section = (title) => console.log('\n' + chalk.bold.cyan(`\n🔸 ${title}\n`));

// API Client
const api = {
  post: async (endpoint, data) => {
    try {
      const response = await axios.post(`${API_URL}${endpoint}`, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  },
  
  get: async (endpoint) => {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  },
  
  put: async (endpoint, data) => {
    try {
      const response = await axios.put(`${API_URL}${endpoint}`, data, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  },
  
  delete: async (endpoint) => {
    try {
      const response = await axios.delete(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  }
};

// Tests
async function testRegister() {
  section('1️⃣ TEST: REGISTRATION');
  
  const email = `provider-test-${Date.now()}@example.com`;
  log(`Registering provider: ${email}`);
  
  try {
    const response = await api.post('/register', {
      email,
      password: 'TestPassword123!',
      company: 'Test Company',
      name: 'Test Provider',
      phone: '+1234567890'
    });
    
    if (response.success) {
      success('Provider registered successfully');
      token = response.provider.apiToken;
      providerId = response.provider.id;
      success(`Token: ${token.substring(0, 20)}...`);
      console.log(JSON.stringify(response.provider, null, 2));
      return true;
    } else {
      error(`Registration failed: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Registration error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testLogin() {
  section('2️⃣ TEST: LOGIN');
  
  const email = `provider-test-${Date.now() - 60000}@example.com`; // Use existing email
  log(`Attempting to login (may fail if account not yet created)`);
  
  try {
    const response = await api.post('/login', {
      email,
      password: 'TestPassword123!'
    });
    
    if (response.success) {
      success('Login successful');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log(`Login not applicable for this test: ${response.message}`);
      return false;
    }
  } catch (err) {
    log(`Login test skipped (account may not be verified): ${typeof err === 'string' ? err : err?.message}`);
    return false;
  }
}

async function testGetMe() {
  section('3️⃣ TEST: GET PROVIDER INFO');
  
  log('Fetching provider information...');
  
  try {
    const response = await api.get('/me');
    
    if (response.success) {
      success('Provider info retrieved');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      error(`Failed to get info: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Get info error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testCreateInstance() {
  section('4️⃣ TEST: CREATE INSTANCE');
  
  const instanceName = `Test Instance ${Date.now()}`;
  const subdomain = `test-${Date.now()}`;
  
  log(`Creating instance: "${instanceName}" with subdomain "${subdomain}"`);
  
  try {
    const response = await api.post('/instances', {
      name: instanceName,
      subdomain: subdomain,
      settings: {
        currency: 'XAF',
        businessType: 'ecommerce'
      }
    });
    
    if (response.success) {
      success('Instance created successfully');
      instanceId = response.instance.id;
      success(`Instance ID: ${instanceId}`);
      success(`Access URL: ${response.instance.accessUrl}`);
      console.log(JSON.stringify(response.instance, null, 2));
      return true;
    } else {
      error(`Instance creation failed: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Create instance error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testListInstances() {
  section('5️⃣ TEST: LIST INSTANCES');
  
  log('Fetching all instances...');
  
  try {
    const response = await api.get('/instances');
    
    if (response.success) {
      success(`Found ${response.data.instances.length} instance(s)`);
      success(`Stats: ${response.data.stats.activeInstances} active, ${response.data.stats.totalInstances} total`);
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      error(`Failed to list instances: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`List instances error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testGetInstance() {
  section('6️⃣ TEST: GET INSTANCE DETAILS');
  
  if (!instanceId) {
    log('No instance ID available. Skipping...');
    return false;
  }
  
  log(`Fetching details for instance: ${instanceId}`);
  
  try {
    const response = await api.get(`/instances/${instanceId}`);
    
    if (response.success) {
      success('Instance details retrieved');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      error(`Failed to get instance: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Get instance error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testUpdateInstance() {
  section('7️⃣ TEST: UPDATE INSTANCE');
  
  if (!instanceId) {
    log('No instance ID available. Skipping...');
    return false;
  }
  
  log(`Updating instance: ${instanceId}`);
  
  try {
    const response = await api.put(`/instances/${instanceId}`, {
      name: 'Updated Instance Name',
      storeSettings: {
        isStoreEnabled: true,
        storeName: 'My Test Store',
        storeDescription: 'This is a test store',
        storeThemeColor: '#FF5733',
        storeCurrency: 'XAF'
      }
    });
    
    if (response.success) {
      success('Instance updated successfully');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      error(`Failed to update instance: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Update instance error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testRefreshToken() {
  section('8️⃣ TEST: REFRESH TOKEN');
  
  log('Refreshing API token...');
  
  try {
    const response = await api.post('/refresh-token', {});
    
    if (response.success) {
      success('Token refreshed successfully');
      const newToken = response.data.token;
      success(`New Token: ${newToken.substring(0, 20)}...`);
      success(`Expires: ${response.data.expiresAt}`);
      token = newToken; // Mettre à jour le token
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      error(`Failed to refresh token: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Refresh token error: ${JSON.stringify(err)}`);
    return false;
  }
}

async function testDeleteInstance() {
  section('9️⃣ TEST: DELETE INSTANCE');
  
  if (!instanceId) {
    log('No instance ID available. Skipping...');
    return false;
  }
  
  log(`Deleting instance: ${instanceId}`);
  
  try {
    const response = await api.delete(`/instances/${instanceId}`);
    
    if (response.success) {
      success('Instance deleted successfully');
      console.log(JSON.stringify(response, null, 2));
      return true;
    } else {
      error(`Failed to delete instance: ${response.message}`);
      return false;
    }
  } catch (err) {
    error(`Delete instance error: ${JSON.stringify(err)}`);
    return false;
  }
}

// Main Test Suite
async function runTests() {
  console.log(chalk.bold.cyan(`
╔════════════════════════════════════════╗
║  PROVIDER SYSTEM - TEST SUITE          ║
║  API: ${API_URL}  ║
╚════════════════════════════════════════╝
  `));
  
  const results = {};
  
  // Run tests
  results['Register'] = await testRegister();
  if (!token) {
    error('Cannot continue without valid token. Stopping tests.');
    process.exit(1);
  }
  
  results['Login'] = await testLogin();
  results['Get Provider Info'] = await testGetMe();
  results['Create Instance'] = await testCreateInstance();
  results['List Instances'] = await testListInstances();
  results['Get Instance Details'] = await testGetInstance();
  results['Update Instance'] = await testUpdateInstance();
  results['Refresh Token'] = await testRefreshToken();
  results['Delete Instance'] = await testDeleteInstance();
  
  // Summary
  section('📊 SUMMARY');
  
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    console.log(`${result ? chalk.green('✅') : chalk.red('❌')} ${test}`);
  });
  
  console.log(`\n${chalk.bold(`Result: ${passed}/${total} tests passed`)}`);
  
  if (passed === total) {
    console.log(chalk.green.bold('\n🎉 All tests passed! Provider system is working correctly.\n'));
  } else {
    console.log(chalk.yellow.bold(`\n⚠️  ${total - passed} test(s) failed. Check the output above.\n`));
  }
}

// Run
runTests().catch(err => {
  error(`Test suite failed: ${err}`);
  process.exit(1);
});
