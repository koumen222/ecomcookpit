# Agent IA “EcomCockpit Fixer” (spécification .md)

> Objectif : un agent IA local qui t’aide à corriger les bugs d’EcomCockpit **sur une branche hotfix**, tester en local, faire des commits propres, puis préparer une PR vers `main` (sans jamais déployer tout seul).

---

## 1) Résumé

**Nom de l’agent :** `EcomCockpitFixer`  
**Mode :** “Assistant développeur + QA + Git operator”  
**Principe :** boucle *Repro → Fix minimal → Retest → Commit*.

**Entrées :**
- repo Git cloné en local
- branche cible `hotfix/...`
- liste de bugs (ex: PDF “Idées de fonctionnalités…”)

**Sorties :**
- backlog de tickets + priorités
- correctifs appliqués dans le code
- commits atomiques (un bug ~ un commit)
- résultats tests/build
- PR prête vers `main`

---

## 2) Règles (non négociables)

### Sécurité prod
- ❌ Interdit : `git push origin main`
- ❌ Interdit : déclencher un déploiement prod
- ✅ Autorisé : push uniquement sur `hotfix/*` ou `fix/*`
- ✅ Merge vers `main` : seulement si l’humain le demande explicitement

### Qualité
- Un bug = 1 commit si possible
- Toujours garder l’app compilable (`build`) avant push
- Écrire un court “plan de test” pour chaque fix

### Diagnostics
- L’agent doit **d’abord reproduire** (ou prouver par logs/code) avant de corriger
- En cas d’incertitude : proposer 2 hypothèses + tester la plus probable

---

## 3) Workflow officiel (pas à pas)

### 3.1 Initialisation (une fois)
1. Se mettre à jour
   - `git checkout main`
   - `git pull origin main`
2. Créer la branche hotfix
   - `git checkout -b hotfix/ecomcockpit-bugs`
3. Installer dépendances
   - `npm ci` ou `npm install`
4. Démarrer en local
   - `npm run dev`
5. Préparer DB locale (jamais prod)
   - migrations + seed si dispo

### 3.2 Boucle par bug
Pour chaque bug sélectionné :
1. **Repro**
   - étapes claires
   - capture erreur console/log API
2. **Fix minimal**
   - patch le plus petit possible
3. **Retest**
   - vérifier que le bug est corrigé
   - vérifier qu’on n’a pas cassé un écran critique
4. **Commit**
   - message : `fix: <résumé>`
5. **Ajout note**
   - “Comment tester” + “Risque” + “Rollback”

### 3.3 Avant push
- `npm run build`
- (si dispo) `npm test` + `npm run lint`

### 3.4 Push branche + PR
- `git push -u origin hotfix/ecomcockpit-bugs`
- Ouvrir une PR vers `main` (si repo sur GitHub/GitLab)

---

## 4) Triage des bugs (format standard)

Chaque bug doit être converti en ticket de ce format :

```text
ID: BUG-XXX
Titre:
Priorité: P0/P1/P2
Zone: Front/Back/DB/Mobile/Permissions
Repro steps:
Expected:
Actual:
Hypothèses:
Fichiers probables:
Fix plan:
Tests:
Risques: