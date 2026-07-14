# Staging / sandbox Scalor

Le but est simple: tester la V2 en ligne sans toucher aux vrais clients, aux vraies commandes, ni a la vraie base.

## Architecture conseillee

```text
Production frontend: https://scalor.net
Production API:      https://api.scalor.net
Production DB:       plateforme

Staging frontend:    https://staging.scalor.net
Staging API:         https://api-staging.scalor.net
Staging DB:          plateforme_staging
```

## Variables GitHub

Le workflow `Deploy to VPS` demande maintenant un choix:

```text
production
staging
```

Cree deux environnements GitHub dans `Settings -> Environments`:

```text
production
staging
```

Dans l'environnement `staging`, mets au minimum:

```text
VITE_BACKEND_URL=https://api-staging.scalor.net
VITE_API_BASE_URL=https://api-staging.scalor.net
VITE_STORE_API_URL=https://api-staging.scalor.net
VITE_SCALOR_API_URL=https://api-staging.scalor.net
VITE_SOCKET_URL=https://api-staging.scalor.net
```

Les secrets VPS peuvent etre les memes si staging et production sont sur le meme serveur, mais mets un dossier different:

```text
VPS_APP_DIR=/opt/ecomcookpit-staging
```

## Variables sur le VPS

Sur le VPS, cree:

```bash
sudo mkdir -p /opt/ecomcookpit-staging
sudo nano /opt/ecomcookpit-staging/.env
```

Pars de `.env.staging.example`.

Points importants:

```env
APP_ENV=staging
APP_PORT=8081
APP_CONTAINER_NAME=ecomcookpit-staging
ENABLE_BACKGROUND_JOBS=false
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/plateforme_staging?retryWrites=true&w=majority
FRONTEND_URL=https://staging.scalor.net
BACKEND_URL=https://api-staging.scalor.net
PUBLIC_BACKEND_URL=https://api-staging.scalor.net
CORS_ORIGINS=https://staging.scalor.net,https://api-staging.scalor.net
```

`ENABLE_BACKGROUND_JOBS=false` empêche le staging de lancer les crons, relances,
synchronisations WhatsApp, emails planifiés et récupérations de paiement.

Le backend refuse de demarrer en `APP_ENV=staging` si la base ressemble a une base production, par exemple `plateforme` ou un nom contenant `prod`.

## Caddy

Seule l'API staging passe par Caddy. Le frontend Next est servi par le Worker
Cloudflare `scalornext-staging` et ne doit jamais pointer vers le conteneur React.

Exemple si l'API staging ecoute sur le port hote `8081` :

```caddy
api-staging.scalor.net {
    reverse_proxy 127.0.0.1:8081
}
```

Dans Cloudflare, rattache `staging.scalor.net` au Worker
`scalornext-staging`. La production React et `api.scalor.net` restent inchangés.

## Deploiement

Dans GitHub Actions:

```text
Deploy to VPS -> Run workflow -> target_environment: staging
```

Apres deploiement:

```bash
curl https://api-staging.scalor.net/health
```

La reponse doit contenir:

```json
{
  "status": "ok",
  "environment": "staging"
}
```

Puis, depuis `scalor-next` :

```bash
npm run deploy:staging
```

Cette commande utilise `wrangler.staging.jsonc`, publie un Worker distinct et
compile toutes les URLs publiques vers `https://api-staging.scalor.net`.

## Regle d'or

Ne mets jamais dans staging:

- la base MongoDB de production;
- les vraies cles de paiement;
- les memes buckets R2/uploads que production;
- les vrais tokens WhatsApp/SMS si tu fais des tests d'envoi.
