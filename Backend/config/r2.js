import { S3Client } from '@aws-sdk/client-s3';

// Configuration Cloudflare R2 (compatible S3)
// Variables d'environnement Railway (compatibles avec les noms standards)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);

// Vérifier que toutes les variables d'environnement sont présentes
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn('⚠️ Variables R2 manquantes. Le stockage de fichiers ne fonctionnera pas.');
  console.warn('   Variables requises: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
}

// Créer le client S3 pour Cloudflare R2
export const s3Client = new S3Client({
  region: 'auto', // Cloudflare R2 utilise 'auto' comme région
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || ''
  },
  forcePathStyle: false // Cloudflare R2 utilise le style de chemin virtuel
});

export const R2_CONFIG = {
  bucket: R2_BUCKET_NAME || '',
  endpoint: R2_ENDPOINT,
  accountId: R2_ACCOUNT_ID || ''
};

// Fonction pour générer l'URL publique d'un fichier
export const getR2PublicUrl = (key) => {
  if (!R2_CONFIG.bucket || !R2_CONFIG.accountId) {
    return null;
  }

  // Cloudflare R2 public URL format: https://<bucket>.<account-id>.r2.cloudflarestorage.com/<key>
  // Ou si vous avez un custom domain/public bucket:
  //   - https://pub-xxxx.r2.dev/<key> (bucket public)
  //   - https://files.example.com/<key> (custom domain)
  const publicBase =
    process.env.R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_DOMAIN;

  if (publicBase) {
    const trimmedBase = publicBase.replace(/\/+$/, '');
    const baseWithProtocol = trimmedBase.startsWith('http://') || trimmedBase.startsWith('https://')
      ? trimmedBase
      : `https://${trimmedBase}`;
    return `${baseWithProtocol}/${key}`;
  }

  return `https://${R2_CONFIG.bucket}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;
};

