# Délivrabilité des emails OTP

## Décision

Le backend reste en mode SMTP, mais les messages transactionnels ne doivent plus
dépendre de la réputation de l'IP du VPS. Le staging utilise donc un relais SMTP
authentifié :

```env
OTP_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=... # clé SMTP/API du relais
EMAIL_FROM="auth@auth.scalor.net"
EMAIL_FROM_NAME="Scalor"
OTP_REPLY_TO=support@scalor.net
```

Le protocole applicatif reste SMTP. Le relais apporte une IP d'envoi réputée,
SPF/DKIM alignés, suivi des rebonds et suppression automatique des destinataires
problématiques.

Pour une activation immédiate avec le compte actuellement configuré, le domaine
`infomania.store` est déjà vérifié. La valeur temporaire peut donc être :

```env
EMAIL_FROM="auth@infomania.store"
```

La cible recommandée reste `auth.scalor.net`, sous-domaine dédié aux emails
transactionnels. Cela isole sa réputation de celle des campagnes marketing.

## Correctifs DNS du SMTP Scalor

Audit public effectué le 14 juillet 2026 :

- `mail.scalor.net` pointe vers `89.117.58.183` ;
- le PTR de `89.117.58.183` pointe vers `vmi3273483.contaboserver.net` au lieu de
  `mail.scalor.net` ;
- SPF autorise bien `89.117.58.183` ;
- DKIM `mail._domainkey.scalor.net` est publié ;
- DMARC est seulement en observation avec `p=none`.

Actions d'infrastructure :

1. Dans Contabo, définir le reverse DNS/PTR de `89.117.58.183` sur
   `mail.scalor.net`.
2. Vérifier ensuite que les deux sens correspondent :
   `mail.scalor.net -> 89.117.58.183 -> mail.scalor.net`.
3. Après vérification des rapports DMARC, passer progressivement de `p=none` à
   `p=quarantine`, puis à `p=reject`.
4. Garder les campagnes marketing séparées des OTP ; ne jamais utiliser la
   même réputation/IP pour les deux flux.

Le jail Fail2ban `postfix-sasl` est versionné dans
`Backend/deploy/fail2ban/scalor-mail.conf`. Il bloque progressivement les IP qui
échouent plusieurs authentifications SMTP afin d'éviter le vol de compte et la
destruction de la réputation d'envoi.

## Protection contre les abus

`POST /api/ecom/auth/send-otp` applique désormais :

- un délai minimum de 60 secondes entre deux OTP vers la même adresse ;
- au maximum 3 OTP par heure et par destinataire ;
- au maximum 10 OTP par heure et par IP ;
- un code généré par un générateur cryptographiquement sûr ;
- en production, la suppression du code si le fournisseur refuse l'envoi.
