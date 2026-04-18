# MoneyFusion Checkout Flow

## Objectif

Décrire le premier flux MoneyFusion utilisé pour payer un abonnement Scalor.

Ce flux commence côté frontend, passe par notre backend, puis crée une session de paiement chez MoneyFusion.

## Vue d'ensemble

1. Le frontend appelle `createCheckout(payload)`.
2. `createCheckout` envoie `POST /billing/checkout` à notre backend.
3. La route backend valide les données, calcule le montant et construit `paymentData`.
4. Le backend appelle MoneyFusion avec `axios.post(MF_API_URL, paymentData)`.
5. MoneyFusion renvoie un `token` et une `paymentUrl`.
6. Le frontend ouvre `paymentUrl` pour laisser le client finaliser le paiement.
7. Ensuite, le frontend ou le backend vérifie l'état du paiement via le statut et le webhook.

## Point d'entrée frontend

Fichier concerné: `src/ecom/services/billingApi.js`

Fonction:

```js
export async function createCheckout(payload) {
  const { data } = await ecomApi.post('/billing/checkout', payload);
  return data;
}
```

Payload attendu côté frontend:

```js
{
  plan,
  phone,
  clientName,
  workspaceId
}
```

Champs:

- `plan`: plan demandé, par exemple `starter_1`, `pro_1`, `ultra_1`
- `phone`: numéro Mobile Money du client
- `clientName`: nom du client à afficher côté paiement
- `workspaceId`: workspace auquel rattacher le paiement

## Point d'entrée backend

Fichier concerné: `Backend/routes/billing.js`

Route:

```js
router.post('/checkout', requireEcomAuth, async (req, res) => {
```

Cette route:

- récupère `plan`, `phone`, `clientName`, `workspaceId`, `promoCode`
- valide les entrées
- calcule le prix du plan
- applique éventuellement un code promo
- construit le payload MoneyFusion
- appelle MoneyFusion
- enregistre un `PlanPayment` en statut `pending`
- renvoie les données utiles au frontend

## Premier appel sortant vers MoneyFusion

Constante utilisée:

```js
const MF_API_URL = 'https://www.pay.moneyfusion.net/scalor/597e2cf962834532/pay/';
```

Appel HTTP:

```js
const mfResponse = await axios.post(MF_API_URL, paymentData, {
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000
});
```

## Payload envoyé à MoneyFusion

Le backend construit ce payload:

```js
const paymentData = {
  totalPrice: amount,
  article: [{ [planLabel]: amount }],
  personal_Info: [
    {
      workspaceId: workspaceId.toString(),
      userId: req.ecomUser._id.toString(),
      plan: normalizedPlan,
      durationMonths
    }
  ],
  numeroSend: String(phone).trim(),
  nomclient: String(clientName).trim(),
  return_url: `${frontendUrl}/ecom/billing/success`,
  webhook_url: `${backendUrl}/api/ecom/billing/webhook`
};
```

Signification des champs:

- `totalPrice`: montant final facturé en FCFA
- `article`: libellé commercial transmis à MoneyFusion
- `personal_Info`: contexte métier réutilisable à la confirmation
- `numeroSend`: numéro du client qui paie
- `nomclient`: nom affiché côté prestataire
- `return_url`: URL de retour frontend après redirection utilisateur
- `webhook_url`: URL backend appelée automatiquement par MoneyFusion

## Réponse attendue de MoneyFusion

Le backend lit principalement:

```js
const { statut, token: mfToken, url: paymentUrl, message } = mfResponse.data;
```

Champs utiles:

- `statut`: indique si la création de session est acceptée
- `token`: identifiant MoneyFusion du paiement
- `url`: URL de paiement à ouvrir dans le navigateur
- `message`: message de retour du prestataire

Si `statut` ou `token` sont absents, le backend renvoie une erreur `502`.

## Ce que le backend persiste

Après réponse valide, le backend crée un document `PlanPayment` avec notamment:

- `workspaceId`
- `userId`
- `plan`
- `durationMonths`
- `amount`
- `mfToken`
- `paymentUrl`
- `status: 'pending'`
- `phone`
- `clientName`
- informations promo si présentes

## Réponse renvoyée au frontend

Le backend renvoie ensuite:

```js
{
  success: true,
  mfToken,
  paymentUrl,
  message,
  amount,
  originalAmount,
  discountAmount,
  promoCode,
  plan,
  durationMonths
}
```

Le frontend utilise principalement:

- `paymentUrl` pour ouvrir la fenêtre de paiement
- `mfToken` pour suivre l'état du paiement

## Suite du flux après ce premier appel

Après création de session:

1. l'utilisateur paie sur MoneyFusion
2. MoneyFusion redirige vers `return_url`
3. MoneyFusion appelle `webhook_url`
4. notre backend met à jour le paiement
5. le frontend peut aussi poller `/billing/status/:token`

## Cas d'erreur gérés

- données d'entrée invalides: `400`
- timeout MoneyFusion: `504`
- erreur API MoneyFusion: `502`
- erreur interne backend: `500`

## Résumé court

Le premier appel MoneyFusion pour un abonnement est toujours celui-ci:

```js
axios.post(MF_API_URL, paymentData)
```

Il est déclenché indirectement par:

```js
createCheckout(payload)
```

Donc la chaîne minimale à retenir est:

```text
Frontend createCheckout -> POST /billing/checkout -> axios.post(MF_API_URL, paymentData)
```