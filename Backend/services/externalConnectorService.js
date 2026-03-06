import axios from 'axios';

const API_BASE = process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site';

function resolveInstanceToken(config = {}) {
  const token = config.instanceToken || config.apiKey;
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('MISSING_CREDENTIALS');
  }
  return token.trim();
}

function resolveInstanceId(config = {}) {
  if (!config.instanceId || typeof config.instanceId !== 'string') {
    throw new Error('MISSING_CREDENTIALS');
  }
  return config.instanceId.trim();
}

function buildAuthHeaders(instanceToken) {
  return {
    'Content-Type': 'application/json',
    // Token brut, sans préfixe
    Authorization: instanceToken,
    'x-instance-token': instanceToken
  };
}

function mapExternalError(error) {
  const status = error?.response?.status;
  if (status === 401) return new Error('INVALID_TOKEN');
  if (status === 404) return new Error('INSTANCE_NOT_FOUND');
  if (status === 400) return new Error('INVALID_REQUEST');
  return new Error('EXTERNAL_API_ERROR');
}

async function callExternalApi({ endpoint, payload, instanceToken, method = 'POST' }) {
  try {
    const response = await axios({
      method,
      url: `${API_BASE}${endpoint}`,
      headers: buildAuthHeaders(instanceToken),
      data: payload
    });

    return {
      success: true,
      statusCode: response.status,
      data: response.data
    };
  } catch (error) {
    throw mapExternalError(error);
  }
}

export async function checkInstanceConnection(config) {
  const instanceId = resolveInstanceId(config);
  const instanceToken = resolveInstanceToken(config);

  const result = await callExternalApi({
    endpoint: '/api/instance/status',
    payload: { instanceId },
    instanceToken,
    method: 'POST'
  });

  return {
    connected: true,
    ...result
  };
}

export async function executeInstanceAction(config, action, params = {}) {
  const instanceId = resolveInstanceId(config);
  const instanceToken = resolveInstanceToken(config);

  if (action === 'send_message') {
    return callExternalApi({
      endpoint: '/api/message/sendText',
      payload: {
        instanceId,
        number: params.number,
        text: params.text
      },
      instanceToken,
      method: 'POST'
    });
  }

  if (action === 'check_status') {
    return callExternalApi({
      endpoint: '/api/instance/status',
      payload: { instanceId },
      instanceToken,
      method: 'POST'
    });
  }

  if (action === 'get_info') {
    return callExternalApi({
      endpoint: '/api/instance/info',
      payload: { instanceId },
      instanceToken,
      method: 'POST'
    });
  }

  throw new Error('INVALID_REQUEST');
}

export async function sendInstanceMessage(config, number, text) {
  if (!number || !text) {
    throw new Error('INVALID_REQUEST');
  }

  return executeInstanceAction(config, 'send_message', { number, text });
}
