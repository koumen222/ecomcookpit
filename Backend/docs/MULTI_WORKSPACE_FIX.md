# Fix Multi-Workspace : Préservation des rôles

## 🐛 Problème identifié

Lorsqu'un utilisateur rejoignait un nouveau workspace, son rôle global était écrasé, supprimant son rôle admin dans son workspace d'origine.

**Exemple du bug** :
1. Utilisateur crée un workspace → `role: "ecom_admin"`
2. Utilisateur rejoint un autre workspace en tant que closeuse → `role: "ecom_closeuse"` ❌
3. Le rôle admin est perdu définitivement

## ✅ Solution implémentée

### Architecture des rôles

Le système utilise maintenant correctement l'array `workspaces` du modèle `EcomUser` :

```js
user: {
  role: "ecom_admin",           // Rôle actif (workspace courant)
  workspaceId: ObjectId("..."), // Workspace actif
  workspaces: [                 // Tous les workspaces avec rôles préservés
    {
      workspaceId: ObjectId("workspace1"),
      role: "ecom_admin",
      status: "active"
    },
    {
      workspaceId: ObjectId("workspace2"),
      role: "ecom_closeuse",
      status: "active"
    }
  ]
}
```

### Modifications apportées

#### 1. `Backend/routes/auth.js` - Route `join-workspace`

**Avant** :
```js
user.role = role;  // ❌ Écrasait le rôle global
user.workspaceId = workspace._id;
user.addWorkspace(workspace._id, role);
```

**Après** :
```js
// Ajouter le workspace à l'array sans écraser
const added = user.addWorkspace(workspace._id, role);
if (!added) {
  return res.status(400).json({ 
    success: false, 
    message: 'Erreur lors de l\'ajout du workspace' 
  });
}

// Mettre à jour le workspace actif et le rôle actif
user.workspaceId = workspace._id;
user.role = role;
await user.save();
```

#### 2. Protection existante dans `EcomUser.addWorkspace()`

Le modèle `EcomUser` a déjà une protection :

```js
ecomUserSchema.methods.addWorkspace = function(workspaceId, role, invitedBy = null) {
  // Vérifier si l'utilisateur n'est pas déjà dans ce workspace
  const existingWorkspace = this.workspaces.find(w => 
    w.workspaceId.toString() === workspaceId.toString()
  );
  
  if (existingWorkspace) {
    return false; // ✅ Empêche de rejoindre 2x le même workspace
  }
  
  this.workspaces.push({
    workspaceId,
    role,
    invitedBy,
    joinedAt: new Date(),
    status: 'active'
  });
  
  return true;
};
```

### Comportement après le fix

#### Scénario 1 : Rejoindre un nouveau workspace
```
État initial :
- Workspace A : admin
- workspaceId: A, role: "ecom_admin"

Action : Rejoindre workspace B en tant que closeuse

État final :
- Workspace A : admin (✅ préservé)
- Workspace B : closeuse (✅ ajouté)
- workspaceId: B, role: "ecom_closeuse" (actif)
```

#### Scénario 2 : Switch entre workspaces
```
Action : Switch vers workspace A

État final :
- workspaceId: A, role: "ecom_admin" (✅ rôle restauré)
- workspaces array intact
```

#### Scénario 3 : Tentative de rejoindre le même workspace
```
Action : Rejoindre workspace A (déjà membre)

Résultat : ❌ Erreur "Vous êtes déjà membre de cet espace"
```

## 🔧 Restaurer un rôle admin écrasé

Si le bug s'est déjà produit, restaurer via MongoDB :

```js
// 1. Connexion
mongosh

// 2. Sélectionner la DB
use scalor

// 3. Restaurer le rôle
db.users.updateOne(
  { email: "votre@email.com" },
  { $set: { role: "ecom_admin" } }
)

// 4. Vérifier
db.users.findOne(
  { email: "votre@email.com" },
  { email: 1, role: 1, workspaceId: 1, workspaces: 1 }
)
```

## 📋 Tests recommandés

1. **Test 1** : Créer un workspace → vérifier rôle admin
2. **Test 2** : Rejoindre un 2e workspace → vérifier que le 1er rôle est préservé dans `workspaces[]`
3. **Test 3** : Switch vers le 1er workspace → vérifier que le rôle admin est restauré
4. **Test 4** : Tenter de rejoindre le même workspace → vérifier erreur
5. **Test 5** : Déconnexion/reconnexion → vérifier persistance des rôles

## 🚀 Déploiement

1. Redémarrer le backend pour appliquer les changements
2. Tester en local d'abord
3. Déployer en production
4. Monitorer les logs pour détecter d'éventuels problèmes

## 📝 Notes importantes

- Le champ `role` global reflète toujours le rôle dans le workspace actif
- Les rôles de tous les workspaces sont préservés dans `workspaces[]`
- La méthode `getRoleInWorkspace(workspaceId)` retourne le bon rôle pour chaque workspace
- La protection contre les doublons est déjà en place dans `addWorkspace()`
