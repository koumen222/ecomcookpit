const RITA_SECRET_ENV_FIELDS = {
  fishAudioApiKey: 'FISH_AUDIO_API_KEY',
  elevenlabsApiKey: 'ELEVENLABS_API_KEY',
};

function cloneConfig(config) {
  if (!config) return config;
  if (typeof config.toObject === 'function') return config.toObject();
  return { ...config };
}

export function sanitizeRitaConfigForResponse(config) {
  if (!config) return config;

  const sanitized = cloneConfig(config);

  for (const [fieldName, envName] of Object.entries(RITA_SECRET_ENV_FIELDS)) {
    sanitized[`${fieldName}Configured`] = Boolean(sanitized[fieldName] || process.env[envName]);
    delete sanitized[fieldName];
  }

  return sanitized;
}

export function preserveRitaSecretFields(previousConfig, nextConfig = {}) {
  const mergedConfig = { ...nextConfig };

  for (const fieldName of Object.keys(RITA_SECRET_ENV_FIELDS)) {
    const rawValue = mergedConfig[fieldName];
    const hasExplicitValue = typeof rawValue === 'string'
      ? rawValue.trim().length > 0
      : Boolean(rawValue);

    if (hasExplicitValue) continue;

    if (previousConfig?.[fieldName]) {
      mergedConfig[fieldName] = previousConfig[fieldName];
      continue;
    }

    delete mergedConfig[fieldName];
  }

  return mergedConfig;
}