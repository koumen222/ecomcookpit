# Deploiement automatique sur VPS

Ce repo deploie l'application automatiquement sur le VPS a chaque push sur `main`.

## Principe

1. GitHub Actions installe les dependances et lance `npm run build`.
2. Une image Docker est construite puis poussee dans GitHub Container Registry.
3. Le workflow se connecte au VPS en SSH.
4. Le VPS fait `docker compose pull app` puis `docker compose up -d`.
5. Le workflow verifie `http://127.0.0.1:8080/health`.

## Secrets GitHub obligatoires

Dans GitHub: `Settings -> Secrets and variables -> Actions -> Repository secrets`.

| Secret | Exemple |
| --- | --- |
| `VPS_HOST` | `123.123.123.123` ou `vps.example.com` |
| `VPS_USER` | `deploy` ou `root` |
| `VPS_SSH_KEY` | cle privee SSH autorisee sur le VPS |

Secrets optionnels:

| Secret | Defaut |
| --- | --- |
| `VPS_SSH_PORT` | `22` |
| `VPS_APP_DIR` | `/opt/ecomcookpit` |

## Variables GitHub conseillees

Dans `Settings -> Secrets and variables -> Actions -> Variables`.

| Variable | Defaut |
| --- | --- |
| `VITE_BACKEND_URL` | `https://api.scalor.net` |
| `VITE_API_BASE_URL` | `https://api.scalor.net` |
| `VITE_API_URL` | vide |
| `VITE_STORE_API_URL` | vide |
| `VITE_GOOGLE_CLIENT_ID` | vide |
| `VITE_POSTHOG_KEY` | vide |
| `VITE_POSTHOG_HOST` | `https://app.posthog.com` |

Les variables `VITE_*` sont publiques cote navigateur. Ne pas y mettre de secret.

## Preparation du VPS

Installer Docker et le plugin Compose:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Creer le dossier de l'application:

```bash
sudo mkdir -p /opt/ecomcookpit
sudo chown -R "$USER":"$USER" /opt/ecomcookpit
```

Creer `/opt/ecomcookpit/.env` avec les variables backend de production.
Tu peux partir de `Backend/.env.example`. Minimum attendu:

```bash
MONGO_URI=...
ECOM_JWT_SECRET=...
PORT=8080
NODE_ENV=production
```

Pour que les codes OTP n'utilisent pas l'IP du SMTP auto-hébergé, ajouter aussi :

```bash
OTP_EMAIL_PROVIDER=resend
RESEND_API_KEY=...
OTP_EMAIL_FROM="Scalor <auth@auth.scalor.net>"
OTP_REPLY_TO=support@scalor.net
```

`OTP_EMAIL_FROM` doit appartenir à un domaine vérifié dans Resend. La procédure
et les correctifs DNS du SMTP sont détaillés dans
`Backend/docs/EMAIL_DELIVERABILITY.md`.

## Premier deploiement

Une fois les secrets GitHub et le `.env` VPS en place:

1. Va dans l'onglet `Actions` du repo GitHub.
2. Lance `Deploy to VPS` avec `Run workflow`.
3. Choisis `target_environment: production`.

Pour une V2 / staging separee, lis aussi `docs/STAGING.md`. Le meme workflow peut deployer `staging`, avec un dossier VPS different comme `/opt/ecomcookpit-staging`, un `APP_PORT` different et une base MongoDB separee.

## Notes Caddy / reverse proxy

L'app ecoute sur le port hote `8080` par defaut. Ton reverse proxy doit pointer vers:

```text
http://127.0.0.1:8080
```

Si Caddy est installe directement sur le VPS, mets par exemple:

```bash
RAILWAY_BACKEND=http://127.0.0.1:8080
```

dans sa configuration d'environnement.

Si tu utilises le Caddy Docker du dossier `caddy-proxy`, `127.0.0.1` pointe vers le
container Caddy. Utilise plutot:

```bash
RAILWAY_BACKEND=http://host.docker.internal:8080
```

et ajoute ceci au service Caddy si necessaire:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```
