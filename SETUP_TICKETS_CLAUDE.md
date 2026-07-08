# Tickets → « ton Claude » (résolution auto des bugs)

Quand un ticket **bug technique** est créé (ou via le bouton **« Envoyer à Claude Code »**
dans l'interface super admin), le backend déclenche un workflow GitHub qui lance **ton
Claude Code** (ton abonnement Claude Max, pas une clé API) sur le repo. Claude crée une branche `fix/ticket-{id}`,
code le correctif, puis **commit + push sur cette branche** (aucune PR ni déploiement
automatiques) et rappelle le backend. **Toi** tu ouvres/merges la PR quand tu veux.

```
Ticket bug ──► POST /repos/OWNER/REPO/dispatches (event: ticket_fix)
            └► GitHub Action: Claude Code (abonnement Max via CLAUDE_CODE_OAUTH_TOKEN)
               ├─ branche fix/ticket-{id} depuis dev
               ├─ correctif + tests
               ├─ commit + push (PAS de PR, PAS de deploy)
               └► callback POST /api/ecom/tickets/{id}/analysis  ──► statut en_review
```

## 1) Secrets GitHub (repo `koumen222/ecomcookpit` → Settings → Secrets → Actions)

| Secret | Valeur |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Jeton OAuth de **ton abonnement Claude Max** (voir génération ci-dessous). **C'est « ton Claude», sans facturation API.** |
| `TICKET_CALLBACK_SECRET` | Une chaîne aléatoire (ex. `openssl rand -hex 24`). Doit être **identique** côté backend. |

`GITHUB_TOKEN` est fourni automatiquement par Actions (pas à créer) — il sert à ouvrir la PR.

### Générer `CLAUDE_CODE_OAUTH_TOKEN` (abonnement Max, pas d'API)

Sur ta machine, connecté à ton compte Claude Max :

```bash
npm install -g @anthropic-ai/claude-code   # si pas déjà installé
claude setup-token
```

Cela ouvre une connexion à ton compte **Claude Max** et génère un **jeton OAuth
longue durée** pour l'usage headless (CI). Copie ce jeton dans le secret GitHub
`CLAUDE_CODE_OAUTH_TOKEN`. Le workflow exporte ce jeton en variable d'environnement ;
le CLI `claude` l'utilise et consomme **ton quota d'abonnement**, sans facturation à l'API.

> À savoir : l'usage passe par les **limites de ton abonnement Max** (quota par fenêtre).
> Si beaucoup de tickets partent en même temps, tu peux atteindre ces limites. Le jeton
> peut expirer / être révoqué : régénère-le avec `claude setup-token` si besoin.
> Ne mets **jamais** ce jeton en clair dans le code — uniquement dans les secrets GitHub.

## 2) Variables d'environnement backend (`.env`)

```bash
# Token GitHub (fine-grained ou PAT classique) avec accès au repo :
#   - fine-grained : repo koumen222/ecomcookpit → Contents: RW, Metadata: R, + "Dispatch" (Actions)
#   - classique    : scope `repo` (et `workflow`)
GITHUB_DISPATCH_TOKEN=

# Repo cible du workflow
GITHUB_DISPATCH_REPO=koumen222/ecomcookpit

# URL publique du backend (pour que le workflow rappelle le ticket)
PUBLIC_BACKEND_URL=https://api.scalor.net

# Même valeur que le secret GitHub TICKET_CALLBACK_SECRET
TICKET_CALLBACK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Branche cible des PR (défaut: dev)
TICKET_PR_BASE=dev
```

> La branche `dev` doit exister sur le remote (c'est déjà le cas).

## 3) Tester

1. Interface super admin → `/ecom/super-admin/tickets` → **Nouveau ticket**, catégorie
   *Bug technique*. Le dispatch part automatiquement (statut → *Analyse en cours*).
   Ou ouvre un ticket existant → **Envoyer à Claude Code**.
2. Onglet **Actions** du repo GitHub → le run *Ticket fix (Claude Code)* démarre.
3. À la fin : la branche **fix/ticket-{id}** est poussée (aucune PR, aucun déploiement),
   et le ticket passe en **En review** (branche visible dans le détail).
4. Quand tu veux : tu ouvres la PR sur GitHub, tu relis, tu merges vers `dev`.
   Le **déploiement ne part que sur `main`** — donc rien ne se déploie tant que tu ne le fais pas.

## 4) Réglages Claude Code (si besoin)

Le workflow utilise le CLI headless, authentifié par `CLAUDE_CODE_OAUTH_TOKEN` (ton abonnement Max) :

```bash
claude -p "<prompt>" --permission-mode acceptEdits --allowedTools "Edit,Write,Read,Bash"
```

Selon la version de `@anthropic-ai/claude-code`, il peut falloir ajuster
`--permission-mode` / `--allowedTools` (voir `claude --help`). Si Claude ne doit éditer
que certains dossiers, restreins les outils Bash ou ajoute des règles.

## 5) Garde-fous

- Claude ne pousse que des branches **`fix/*`** : **aucune PR ni déploiement automatiques**.
- Le déploiement (`deploy-vps.yml`) ne se déclenche **que sur push vers `main`**.
- Ouverture de PR et merge restent **100% manuels**.
- L'endpoint de callback est protégé par `TICKET_CALLBACK_SECRET` (header `x-ticket-secret`).
- Le prompt interdit à Claude de toucher aux secrets/.env/CI.
- Côté modèle, `approve-patch` reste bloqué si `riskLevel = high` ou liste noire.

## 6) Frontend (scalornext)

Ce workflow vit dans le repo backend. Pour faire résoudre des bugs **frontend**, dupliquer
`.github/workflows/ticket-fix.yml` dans `koumen222/scalornext` (adapter le dossier des tests)
et router le dispatch vers ce repo selon la nature du ticket (champ à ajouter si besoin).
