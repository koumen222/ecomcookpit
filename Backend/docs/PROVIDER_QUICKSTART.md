# 🎯 Provider System - Quick Start

## En 5 minutes, devenez un provider! 

### ✅ Étape 1: Enregistrement

```bash
curl -X POST http://localhost:8080/api/provider/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "moi@example.com",
    "password": "MySecurePassword123!",
    "company": "My Company",
    "name": "Mon Nom",
    "phone": "+237671234567"
  }'
```

**Réponse:**
```json
{
  "success": true,
  "message": "Provider registered successfully",
  "provider": {
    "id": "507f1f77bcf86cd799439011",
    "email": "moi@example.com",
    "company": "My Company",
    "status": "pending",
    "apiToken": "prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
}
```

👉 **Sauvegardez votre token!** C'est votre clé d'accès à l'API.

---

### ✅ Étape 2: Vérifier votre Email

Vérifiez votre email et cliquez sur le lien reçu, ou utilisez:

```bash
# Remplacez TOKEN par votre token de vérification
curl -X POST http://localhost:8080/api/provider/verify-email/YOUR_VERIFICATION_TOKEN
```

---

### ✅ Étape 3: Créer votre 1ère Instance (Boutique)

```bash
curl -X POST http://localhost:8080/api/provider/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -d '{
    "name": "Ma Première Boutique",
    "subdomain": "ma-boutique",
    "settings": {
      "currency": "XAF",
      "businessType": "ecommerce"
    }
  }'
```

**Réponse:**
```json
{
  "success": true,
  "message": "Instance created successfully",
  "instance": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Ma Première Boutique",
    "subdomain": "ma-boutique",
    "createdAt": "2024-03-20T10:00:00.000Z",
    "accessUrl": "https://ma-boutique.scalor.net"
  }
}
```

🎉 **Votre boutique est maintenant en ligne!** Accédez-la sur `https://ma-boutique.scalor.net`

---

### ✅ Étape 4: Lister vos Instances

```bash
curl -X GET http://localhost:8080/api/provider/instances \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

---

### ✅ Étape 5: Mettre à jour une Instance

```bash
curl -X PUT http://localhost:8080/api/provider/instances/507f1f77bcf86cd799439012 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer prov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -d '{
    "name": "Ma Boutique Premium",
    "storeSettings": {
      "isStoreEnabled": true,
      "storeName": "Mon Extraordinary Store",
      "storeDescription": "Welcome to my store!",
      "storeThemeColor": "#FF5733",
      "storeCurrency": "XAF"
    }
  }'
```

---

## 📚 API Endpoints Importants

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/provider/register` | Créer un compte provider |
| `POST` | `/api/provider/verify-email/:token` | Vérifier l'email |
| `POST` | `/api/provider/login` | Se connecter |
| `POST` | `/api/provider/instances` | Créer une instance ➕ |
| `GET` | `/api/provider/instances` | Lister vos instances |
| `GET` | `/api/provider/instances/:id` | Detals d'une instance |
| `PUT` | `/api/provider/instances/:id` | Mettre à jour une instance |
| `DELETE` | `/api/provider/instances/:id` | Supprimer une instance ❌ |
| `GET` | `/api/provider/me` | Vos infos |

---

## 🔑 Authentification Bearer Token

Tous les endpoints (sauf register/verify-email) nécessitent:

```
Authorization: Bearer prov_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚨 Erreurs Courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Missing required fields` | Vous avez oublié un champ obligatoire | Vérifiez: email, password, company, name |
| `This email is already registered` | Vous vous êtes déjà enregistré | Utilisez une autre email ou connectez-vous |
| `Invalid credentials` | Email ou password incorrect | Vérifiez votre email et mot de passe |
| `No or invalid Authorization header` | Pas de Bearer token | Ajoutez `Authorization: Bearer prov_...` |
| `Invalid or expired token` | Token invalide ou expiré | Rafrîchissez votre token avec `/refresh-token` |
| `Instance limit reached` | Vous avez atteint le limite(généralement 10) | Contactez support ou supprimez une instance |

---

## 💡 Conseils

1. **Sauvegardez votre token** - Sans lui, vous ne pouvez pas utiliser l'API
2. **Utilisez HTTPS** - En production, utilisez toujours HTTPS
3. **Testez avec Postman** - Téléchargez Postman pour tester les endpoints
4. **Rattraîchissez régulièrement** - Votre token expire après 1 an
5. **Isolé vos instances** - Chaque instance est complètement séparée

---

## 🛠️ Outils Recommandés

### Postman
- [Télécharger](https://www.postman.com/downloads/)
- Importez les endpoints pour tester facilement

### cURL (Command Line)
- Déjà inclus sur Mac/Linux
- Parfait pour les scripts automatisés

### Insomnia
- Alternative à Postman
- Interface simplifiée

---

## 📖 Documentation Complète

Voir [PROVIDER_SYSTEM.md](./PROVIDER_SYSTEM.md) pour la documentation complète.

---

## ❓ Vous avez besoin d'aide?

- 📧 **Email**: support@scalor.net
- 📖 **Docs**: https://docs.scalor.net
- 🐛 **Issues**: https://github.com/koumen222/ecomcookpit/issues

---

**Bienvenue! 🎉 Commencez maintenant!**
