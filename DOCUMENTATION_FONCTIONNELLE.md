# SCALOR — Documentation Fonctionnelle Complète

> Rédigée pour une compréhension métier complète, indépendante de toute connaissance technique.  
> Version : Mars 2026

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Les 5 profils utilisateurs](#2-les-5-profils-utilisateurs)
3. [Espaces de travail (Workspaces)](#3-espaces-de-travail-workspaces)
4. [Authentification & Compte](#4-authentification--compte)
5. [Commandes](#5-commandes)
6. [Clients (CRM)](#6-clients-crm)
7. [Produits](#7-produits)
8. [Rapports journaliers](#8-rapports-journaliers)
9. [Objectifs](#9-objectifs)
10. [Commissions](#10-commissions)
11. [Affectations](#11-affectations)
12. [Finances & Comptabilité](#12-finances--comptabilité)
13. [Stock & Fournisseurs](#13-stock--fournisseurs)
14. [Recherche produits](#14-recherche-produits)
15. [Sourcing Alibaba (IA)](#15-sourcing-alibaba-ia)
16. [Campagnes WhatsApp](#16-campagnes-whatsapp)
17. [Intégration WhatsApp](#17-intégration-whatsapp)
18. [Agent IA de livraison](#18-agent-ia-de-livraison)
19. [Boutique publique](#19-boutique-publique)
20. [Import Google Sheets](#20-import-google-sheets)
21. [Intégration Shopify](#21-intégration-shopify)
22. [Chat d'équipe](#22-chat-déquipe)
23. [Notifications](#23-notifications)
24. [Analytics](#24-analytics)
25. [Tableaux de bord par rôle](#25-tableaux-de-bord-par-rôle)
26. [Panneau Super Admin](#26-panneau-super-admin)
27. [Paramètres](#27-paramètres)
28. [Relations entre modules](#28-relations-entre-modules)
29. [Principes de conception](#29-principes-de-conception)

---

## 1. Vue d'ensemble

**Scalor** est une plateforme SaaS de gestion e-commerce pensée pour les marchés africains francophones (Cameroun, Côte d'Ivoire, Sénégal, etc.).

Elle centralise tout le cycle de vie d'une activité e-commerce :

- Réception et suivi des commandes (depuis Google Sheets, Shopify, webhook, boutique publique ou saisie manuelle)
- Pilotage de l'équipe commerciale (closeuses, comptables, livreurs)
- Gestion financière (transactions, budgets, rentabilité)
- Communication client via WhatsApp (envoi manuel, campagnes de masse, agent conversationnel IA)
- Boutique publique déployée automatiquement, accessible par les clients
- Pilotage global par un Super Admin de la plateforme

La plateforme est **multi-espaces** : chaque organisation possède son propre espace de travail isolé. Plusieurs organisations peuvent utiliser Scalor simultanément, sans jamais voir les données des autres.

---

## 2. Les 5 profils utilisateurs

Chaque utilisateur a un rôle qui définit exactement ce qu'il peut voir et faire.

---

### Super Admin
**Qui :** L'équipe Scalor (opérateur de la plateforme).  
**Voit :** Tous les espaces de travail de toutes les organisations.  
**Peut faire :**
- Accéder à la liste de tous les utilisateurs de la plateforme
- Activer, suspendre, supprimer un compte
- Changer le rôle d'un utilisateur
- Activer ou désactiver un espace de travail entier
- Envoyer des notifications push à tous les utilisateurs (ou à un espace ciblé)
- Planifier des notifications automatiques
- Consulter les logs d'audit de toute action effectuée sur la plateforme
- Approuver les demandes d'accès WhatsApp des organisations
- Voir les statistiques d'usage de la plateforme (géographie, appareils, événements)
- Envoyer des emails marketing à tous les utilisateurs

**N'a pas accès aux données métier des organisations** (commandes, rapports, finances d'un espace).

---

### Admin (ecom_admin)
**Qui :** Le responsable/propriétaire d'une organisation e-commerce.  
**Voit :** Toutes les données de son propre espace de travail.  
**Peut faire :** Tout dans son espace — créer des produits, importer des commandes, gérer l'équipe, configurer la boutique, lancer des campagnes, consulter les finances, voir les performances, etc.

---

### Closeuse (ecom_closeuse)
**Qui :** La commerciale en charge du suivi et de la relance des commandes.  
**Voit :** Uniquement les commandes, clients et rapports qui lui sont **affectés** par l'admin (selon les sources, produits ou villes configurés).  
**Peut faire :** Traiter les commandes, soumettre les rapports journaliers, envoyer des messages WhatsApp aux clients, lancer des campagnes ciblées, voir ses commissions et ses objectifs.

---

### Comptable (ecom_compta)
**Qui :** Le/la responsable financier(e) de l'organisation.  
**Voit :** Les transactions, les rapports financiers, les produits (en lecture).  
**Peut faire :** Saisir et consulter les transactions, analyser la rentabilité, exporter les données financières.

---

### Livreur (ecom_livreur)
**Qui :** L'agent de livraison.  
**Voit :** Uniquement les commandes qui lui sont assignées pour livraison.  
**Peut faire :** Consulter la liste de ses livraisons, changer le statut d'une commande (ex : marquer comme livré).

---

## 3. Espaces de travail (Workspaces)

Un **espace de travail** est le conteneur principal d'une organisation sur Scalor. Toutes les données (commandes, clients, produits, finances) appartiennent à un espace.

### Création
- L'admin crée son espace en renseignant : nom de l'organisation, type d'activité, devise principale.
- Un **code d'invitation unique** est généré pour permettre aux membres de rejoindre l'espace.
- Un **sous-domaine** peut être attribué (ex : `koumen`) → crée automatiquement la boutique publique sur `koumen.scalor.net`.

### Multi-espaces pour un utilisateur
- Un utilisateur peut appartenir à **plusieurs espaces** avec des rôles différents dans chacun.
- Il peut basculer d'un espace à l'autre via un sélecteur d'espace dans la navigation.

### Isolation totale
- Aucune donnée ne traverse les frontières d'un espace.
- Deux admins d'organisations différentes ne voient jamais les données de l'autre.

---

## 4. Authentification & Compte

### Connexion
- Email + mot de passe, ou **connexion Google** (OAuth)
- Option "Se souvenir de moi" → jeton permanent 365 jours, aucune reconnexion nécessaire
- Réinitialisation du mot de passe par e-mail

### Profil utilisateur
- Nom, prénom, téléphone, photo de profil
- Devise préférée (parmi 50+ devises africaines et internationales)
- Gestion des sessions actives (voir et révoquer)

### Invitation d'un membre
- L'admin génère un lien d'invitation → l'envoi par WhatsApp ou email est libre
- Le nouveau membre clique sur le lien, crée son compte, et intègre directement l'espace avec le rôle préassigné

---

## 5. Commandes

C'est **le module central** de Scalor. Toute l'activité opérationnelle tourne autour des commandes.

### Ce qu'est une commande
Chaque commande représente un achat client et contient :
- Informations client : nom, téléphone, ville, adresse
- Produit commandé, quantité, prix
- Statut (ex : en attente, confirmé, livré, annulé, injoignable…)
- Source d'entrée (Google Sheets, boutique, Shopify, saisie manuelle, webhook)
- Livreur assigné
- Date de création, notes

### Comment les commandes entrent dans Scalor

| Source | Mécanisme |
|--------|-----------|
| **Saisie manuelle** | L'admin ou la closeuse crée la commande dans le formulaire |
| **Google Sheets** | Import en un clic ou synchronisation automatique planifiée |
| **Shopify** | Connexion OAuth → les nouvelles commandes Shopify arrivent automatiquement |
| **Webhook** | N'importe quel système externe peut envoyer des commandes via une URL dédiée |
| **Boutique publique** | Le client passe commande sur `{sous-domaine}.scalor.net` |

### Ce qu'on peut faire avec une commande
- **Lister et filtrer** : par statut, produit, ville, source, closeuse, date
- **Voir le détail** : historique des statuts, données client, notes
- **Changer le statut** : déclenche une notification équipe + WhatsApp optionnel au client
- **Assigner à un livreur** : le livreur voit alors la commande dans son tableau
- **Envoyer un message WhatsApp** directement depuis la commande
- **Exporter** : téléchargement CSV de toutes les commandes filtrées
- **Supprimer**

### Système de statuts flexible
Les statuts sont libres — une commande peut avoir le statut "reporté", "rappeler demain", ou n'importe quel statut personnalisé provenant de Google Sheets. Scalor normalise intelligemment ces statuts pour les rapports et les graphiques.

### Accès par rôle
- **Admin** : toutes les commandes de l'espace
- **Closeuse** : uniquement les commandes de son périmètre d'affectation
- **Livreur** : uniquement les commandes qui lui sont assignées
- **Comptable** : lecture seule

---

## 6. Clients (CRM)

Un module de gestion de la relation client — chaque client est une fiche qui se construit automatiquement à partir des commandes.

### La fiche client contient
- Nom, téléphone, email, ville, adresse
- Source d'acquisition : Facebook, Instagram, TikTok, WhatsApp, site web, bouche-à-oreille
- Statut client : prospect, actif, VIP, inactif, etc.
- **Historique complet** : toutes les commandes passées, total dépensé
- Produits achetés
- Closeuse assignée
- Dernière date de contact, notes
- Tags personnalisables

### Ce qu'on peut faire
- Créer, modifier, supprimer des fiches clients
- Chercher et filtrer par statut, ville, produit, source, tag
- Assigner un client à une closeuse
- **Envoyer un message WhatsApp** directement depuis la fiche
- Utiliser les clients comme cibles pour une **campagne WhatsApp**
- Voir les statistiques d'acquisition par source

---

## 7. Produits

Le catalogue interne de produits — distinct de la boutique publique — sert principalement à l'analyse de performance et au suivi des stocks.

### Informations d'un produit
- Nom, statut de cycle de vie
- **Prix de vente** client
- **Prix de revient** (coût produit, coût livraison, coût publicité moyen)
- **Calculs automatiques** : marge, ROI, bénéfice par unité
- Niveau de stock actuel, seuil de réapprovisionnement

### Cycle de vie d'un produit

```
Test → Stable → Winner
         ↓         ↓
       Pause     Stop
```

- **Test** : en phase de test marché
- **Stable** : performant régulièrement
- **Winner** : produit phare
- **Pause** : mis en pause temporairement
- **Stop** : abandonné

### Ce qu'on peut suivre
- Nombre de commandes, livraisons, retours par produit
- CA généré, profit net, taux de livraison
- Alertes de stock bas (en dessous du seuil)

---

## 8. Rapports journaliers

**L'outil de pilotage quotidien** de l'activité. Chaque closeuse soumet un rapport par jour et par produit pour tracer la performance réelle.

### Ce qu'un rapport capture
- Date, produit concerné
- **Commandes reçues** dans la journée
- **Commandes livrées** dans la journée (avec ventilation par agence de livraison si besoin)
- **Dépense publicitaire** du jour
- Exceptions de prix (si le prix diffère de la normale)

### Calculs automatiques
- **CA** = livraisons × prix de vente
- **Coût total** = (coût produit + coût livraison) × livraisons + pub
- **Bénéfice** = CA − Coût total
- **Taux de livraison** = livraisons / commandes reçues

### Ce qu'on peut analyser
- Vue par produit sur n'importe quelle période
- Totaux cumulés : livraisons, CA, profit, taux de livraison
- Comparaison entre produits
- Évolution dans le temps (graphiques)
- L'admin et le comptable voient tous les rapports ; la closeuse voit les siens

---

## 9. Objectifs

Système de fixation d'objectifs de performance pour l'équipe.

### Types d'objectifs
- **Chiffre d'affaires** : atteindre X FCFA de revenus
- **Nombre de commandes** : traiter X commandes
- **Taux de livraison** : atteindre X% de livraisons réussies

### Granularité
- Période : journalier, hebdomadaire, mensuel
- Périmètre : pour tout l'espace, ou pour un produit spécifique, ou pour une closeuse spécifique

### Suivi
- Barre de progression en temps réel
- Statut auto-mis à jour : En cours / Atteint / Échoué
- Système de badges pour les closeuses :  
  🌱 Débutante → ⭐ Performante → 💎 Excellente → 🏆 Champion

---

## 10. Commissions

Gestion automatisée des commissions des closeuses.

### Comment ça fonctionne
- L'admin configure le taux de commission de chaque closeuse dans ses affectations
- Deux modes : pourcentage (%) du montant de la commande, ou montant fixe par livraison
- Le module aggrège automatiquement toutes les commandes **livrées** de la closeuse

### Ce que la closeuse voit
- Commission gagnée : aujourd'hui, cette semaine, ce mois, cette année
- Liste détaillée des livraisons qui ont généré la commission
- Graphique historique mensuel

---

## 11. Affectations

**Le moteur de filtrage des closeuses.** Ce module définit exactement quelles données chaque closeuse voit et gère.

### Trois dimensions d'affectation

| Dimension | Exemple |
|-----------|---------|
| **Sources** | Cette closeuse gère les commandes venant du Sheet "Facebook Ads" |
| **Produits** | Elle est responsable du produit "Crème Éclat" et "Sérum Anti-âge" |
| **Villes** | Elle couvre Douala et Yaoundé |

### Impact concret
Dès qu'une closeuse est affectée, la plateforme filtre automatiquement et en temps réel :
- Ses commandes (elle ne voit que celles dans son périmètre)
- Ses clients
- Ses rapports
- Les destinataires de ses campagnes

L'admin peut configurer plusieurs affectations par closeuse et ajuster à tout moment.

---

## 12. Finances & Comptabilité

Module de comptabilité simple pour suivre les revenus et dépenses de l'organisation.

### Transactions
Chaque transaction est catégorisée :

**Entrées :** Vente, remboursement client, investissement, autre  
**Sorties :** Publicité, produit, livraison, salaire, abonnement, matériel, transport, autre

On peut rattacher une transaction à un produit spécifique pour analyser la rentabilité par produit.

### Budgets
- Créer un budget par catégorie (ex : budget pub mensuel = 500 000 FCFA)
- Comparer les dépenses réelles au budget
- Alertes automatiques quand un budget est dépassé ou sur le point de l'être

### Tableau de bord financier
- Résumé : total revenus, total dépenses, bénéfice net
- Ventilation par catégorie avec tendances
- Graphique mensuel du résultat
- **Prévisions financières IA** (analyse des tendances pour anticiper)
- Alertes pour les transactions au-dessus d'un seuil critique
- Export CSV/Excel

### Accès
Admin et Comptable uniquement.

---

## 13. Stock & Fournisseurs

Gestion des approvisionnements et des niveaux de stock.

### Commandes fournisseurs (Stock Orders)
Chaque commande passée à un fournisseur est tracée :
- Produit, quantité, poids (kg), prix d'achat, prix de vente prévu
- Type : sourcing local ou Chine
- Statut : En transit / Réceptionné / Annulé
- Dates d'arrivée prévue et réelle, numéro de suivi
- Statut paiement (achat payé / transport payé)

Quand une commande est marquée "Réceptionné", le stock du produit correspondant se met à jour automatiquement.

### Emplacements de stock
Gestion de plusieurs entrepôts ou emplacements physiques.

### Annuaire fournisseurs
Fiche par fournisseur : nom, téléphone, lien Alibaba, email, notes.

### Alertes
Si le stock d'un produit passe sous son seuil de réapprovisionnement, une alerte est déclenchée.

---

## 14. Recherche produits

Un **pipeline de découverte et de validation** de nouveaux produits avant de s'y engager.

### Les étapes du pipeline
```
Idée → En recherche → Validé → En test → Actif
                  ↓
               Rejeté
```

### Ce qu'on évalue pour chaque produit
- Lien Alibaba, lien de recherche, URL du site
- Prix de sourcing, coût de livraison, prix de vente envisagé
- **Calculs automatiques** : marge, profit par unité
- Analyse marché : demande (faible/moyenne/forte), concurrence, tendance (croissance/stable/déclin)
- Score d'opportunité, nombre de fournisseurs répértoriés, notes

### Actions disponibles
- Filtrer par statut, score minimum, marge minimum
- **Promouvoir** : transformer une recherche validée en produit actif dans le catalogue
- Importer des produits directement depuis Alibaba via l'outil IA (voir section suivante)

---

## 15. Sourcing Alibaba (IA)

Un outil qui automatise la création d'une fiche produit à partir d'un lien Alibaba ou AliExpress.

### Comment ça fonctionne
1. L'utilisateur colle l'URL d'un produit Alibaba/AliExpress
2. La plateforme **analyse automatiquement** la page (titre, description, images, prix, spécifications)
3. Une **IA génère** : description marketing en français, suggestion de prix, catégorie, tags
4. Des **visuels marketing** sont créés automatiquement
5. Les images sont uploadées dans le stockage de la plateforme
6. Le résultat est une **fiche produit pré-remplie**, prête à être sauvegardée

La progression est visible en temps réel. L'utilisateur valide ou ajuste avant de sauvegarder.

---

## 16. Campagnes WhatsApp

Le canal marketing principal — envoi de messages WhatsApp en masse à une liste de clients ciblée.

### Types de campagnes

| Type | Usage |
|------|-------|
| **Relance** | Re-contacter des leads en attente, non-répondants, annulés, reportés |
| **Promo** | Promotion ciblée par ville ou par produit acheté |
| **Suivi livraison** | Confirmation de livraison, rappel de réachat |
| **Personnalisée** | Ciblage libre avec filtres au choix |

### Ciblage des destinataires
**Depuis la base clients :**
- Filtrer par statut client, ville, produit acheté, tag, nombre de commandes, date du dernier contact

**Depuis les commandes :**
- Filtrer par statut de commande, ville, produit, source, plage de dates, fourchette de prix

**Filtre pays :** On peut inclure ou exclure certains pays (détection automatique par préfixe téléphonique).

### Personnalisation des messages
Les messages peuvent contenir des variables dynamiques : `{prénom}`, `{ville}`, `{produit}`, `{montant}`, `{statut}`, etc. Chaque destinataire reçoit un message personnalisé.

### Envoi intelligent (anti-blocage)
- Analyse du risque de spam avant envoi
- Délais aléatoires simulant un comportement humain entre les messages
- Limites journalières et mensuelles selon le plan WhatsApp (gratuit : 50/jour ; premium : illimité)
- **Pause / Reprise** de l'envoi en cours
- Suivi en temps réel : envoyés, échoués, ignorés, total ciblé

### Statuts d'une campagne
Brouillon → Planifiée → En cours d'envoi → Envoyée / Pausée / Échouée / Interrompue

---

## 17. Intégration WhatsApp

Scalor se connecte à WhatsApp via un service tiers (Evolution API). Chaque organisation peut connecter un ou plusieurs numéros WhatsApp.

### Connexion d'un numéro
1. L'admin saisit les identifiants de son instance WhatsApp
2. Il scanne le QR code affiché dans la plateforme
3. Le numéro est actif et peut envoyer des messages

### Plans d'accès
- **Gratuit** : 50 messages/jour, 100/mois
- **Premium** : limites augmentées
- **Illimité** : sans limite

### Usages du numéro connecté
- Envoi de campagnes de masse
- Notification automatique au client lors d'une nouvelle commande Shopify
- Agent IA de confirmation de livraison
- Envoi manuel depuis une fiche commande ou client

### Demande d'accès
Pour activer WhatsApp, une **demande d'accès** est soumise et examinée par le Super Admin.

---

## 18. Agent IA de livraison

Un **bot WhatsApp autonome** qui conduit des conversations de confirmation de livraison avec les clients.

### Scénario type
1. Une commande est créée → l'agent envoie automatiquement un premier message WhatsApp
2. Le client répond → l'IA analyse le ton (positif / neutre / négatif)
3. L'agent négocie l'horaire ou la date de livraison
4. Après confirmation : statut → **Confirmé**
5. Si le client refuse ou ne répond plus après 3 relances → escalade vers un humain

### Indicateurs suivis par conversation
- Score de confiance (0–100)
- Niveau de persuasion (0–3)
- Nombre de refus, nombre de relances
- Temps de confirmation ou d'annulation
- Lien direct vers la commande

---

## 19. Boutique publique

Chaque organisation peut publier une **boutique e-commerce publique** accessible aux clients à l'adresse `{sous-domaine}.scalor.net`.

### Configuration de la boutique

**Informations générales**
- Nom de la boutique, description, logo, bannière
- Téléphone, numéro WhatsApp, devise

**Thème visuel**
- Couleurs (primaire, secondaire, fond, texte)
- Typographie
- Rayon des boutons (carré à arrondi)
- Modèle de mise en page (Template 1, 2, 3…)
- Activation/désactivation de sections

**Constructeur de pages**
- Éditeur visuel par glisser-déposer : hero, catalogue produits, témoignages, FAQ, contact, etc.
- Chaque section est personnalisable (textes, images, couleurs)

**Pixels de tracking**
- Facebook Pixel, TikTok Pixel, Google Analytics — configurables sans code

**Paiements**
- Configuration des moyens de paiement acceptés (Mobile Money, etc.)

**Domaine personnalisé**
- L'organisation peut brancher son propre nom de domaine (ex : `www.koumen.com`) comme alias de son sous-domaine Scalor

### Catalogue de produits boutique
- Produits distincts du catalogue interne (gestion séparée : images riches, descriptions longues, SEO, badges)
- Gestion du prix, prix barré, stock, catégorie, tags
- Possibilité de lier un produit boutique à un produit interne pour la synchronisation du stock

### Parcours client
1. Le client visite la boutique
2. Il parcourt le catalogue
3. Il ajoute au panier
4. Il remplit le formulaire de commande (nom, téléphone, ville, adresse)
5. La commande est créée → visible dans l'espace de travail de l'admin
6. L'admin reçoit une notification push et/ou WhatsApp

### Tableau de bord boutique
Vue dédiée pour analyser les commandes provenant spécifiquement de la boutique.

---

## 20. Import Google Sheets

La majorité des vendeurs africains gèrent leurs commandes dans Google Sheets. Ce module permet d'importer et synchroniser ces données sans effort.

### Import ponctuel
1. Coller l'URL du Google Sheet
2. Prévisualiser les colonnes du tableau
3. Mapper les colonnes : "Nom client" → champ `Nom`, "Tel" → champ `Téléphone`, etc.
4. Lancer l'import → les commandes sont créées
5. L'historique des imports est conservé

### Synchronisation automatique
- Configurer une URL de sheet + intervalle de synchronisation
- Le système importe automatiquement les nouvelles lignes ajoutées au sheet
- Seules les **nouvelles lignes** sont importées (pas de doublons)

### Multi-sources
Un espace peut avoir plusieurs sources Google Sheets (ex : un sheet par réseau publicitaire : Facebook, TikTok), chacune assignée à une closeuse différente.

---

## 21. Intégration Shopify

Pour les organisations qui utilisent Shopify comme plateforme de vente principale.

### Comment connecter Shopify
1. L'admin clique "Connecter Shopify" → redirigé vers l'autorisation Shopify
2. Après validation : les commandes Shopify existantes sont importées
3. Un webhook Shopify est enregistré → chaque **nouvelle commande Shopify** arrive automatiquement dans Scalor en temps réel

### Ce qui se passe après la connexion
- L'admin voit ses commandes Shopify dans la liste des commandes comme les autres
- Option : envoi automatique d'un message WhatsApp au client à chaque nouvelle commande Shopify

---

## 22. Chat d'équipe

Communication interne entre les membres de l'espace de travail.

### Deux modes de communication

**Canal d'équipe**
- Fil de discussion partagé visible par tous les membres de l'espace
- Idéal pour les annonces, le partage d'informations générales

**Messages directs (DM)**
- Conversations privées entre deux membres
- Accessible depuis un widget flottant présent sur toutes les pages de l'application

### Fonctionnalités
- Envoi de texte et de médias (images, fichiers)
- Compteur de messages non lus dans la barre de navigation
- Temps réel (les messages apparaissent instantanément)

---

## 23. Notifications

### Notifications in-app
Des alertes apparaissent dans la cloche de notification pour tous les événements importants :

| Catégorie | Exemples d'événements |
|-----------|----------------------|
| Commandes | Nouvelle commande reçue, statut changé, commande assignée |
| Stock | Stock bas, commande fournisseur réceptionnée |
| Équipe | Nouveau membre, rapport créé, campagne envoyée |
| Messages | Nouveau DM, nouveau message canal |
| Système | Import terminé, action admin |

Chaque utilisateur peut **configurer ses préférences** : activer ou désactiver chaque type de notification.

### Notifications push (navigateur)
- L'utilisateur autorise les notifications push dans son navigateur
- Il reçoit des alertes même quand l'application est fermée
- Configurables par type d'événement

---

## 24. Analytics

### Analytics de la boutique
- Trafic de la boutique publique : visiteurs, conversions, taux de transformation
- Suivi des événements Facebook Pixel, TikTok Pixel, Google Analytics

### Analytics de la plateforme (Super Admin uniquement)
- Nombre total d'utilisateurs, actifs, nouveaux inscriptions
- Nombre d'espaces de travail, de commandes sur toute la plateforme
- Répartition géographique des utilisateurs (pays, ville)
- Appareils et navigateurs utilisés
- Courbes d'utilisation dans le temps

---

## 25. Tableaux de bord par rôle

Chaque rôle arrive sur un tableau de bord personnalisé qui lui présente ce qui est pertinent pour lui.

### Tableau de bord Admin
- KPIs : CA, commandes, taux de livraison, bénéfice — avec graphique sur la période choisie
- Dernières commandes
- Performance des produits
- Progression des objectifs
- Activité de l'équipe
- Raccourcis vers toutes les fonctionnalités

### Tableau de bord Closeuse
- Mes performances : aujourd'hui / cette semaine / ce mois
- Décomposition des statuts de mes commandes avec pourcentages
- Badge de performance (🌱 à 🏆)
- Résumé de mes commissions
- Ma progression vers mon objectif
- Mes commandes récentes

### Tableau de bord Comptable
- Aperçu financier : revenus, dépenses, bénéfice, ROAS
- Performance des produits par statut
- Dernières transactions
- Sélecteur de période personnalisé

### Tableau de bord Livreur
- Liste de mes livraisons en attente
- Action rapide pour marquer une commande comme livrée

---

## 26. Panneau Super Admin

Interface de pilotage de **toute la plateforme** Scalor, accessible uniquement au Super Admin.

| Section | Ce qu'elle offre |
|---------|-----------------|
| **Dashboard** | KPIs globaux de la plateforme, carte géographique des utilisateurs, graphiques d'usage |
| **Utilisateurs** | Liste de tous les comptes ; filtrer, activer/suspendre/supprimer, changer de rôle |
| **Espaces** | Liste de tous les espaces avec leurs membres ; activer/désactiver |
| **Analytics** | Courbes d'usage, rétention, événements, répartition appareils |
| **Push Center** | Envoyer une notification à tous les utilisateurs ou à un espace ciblé ; planifications ; automatisations ; templates |
| **Activité** | Journal d'audit complet : qui a fait quoi, quand, sur quelle ressource |
| **WhatsApp Postulations** | Approuver ou refuser les demandes d'accès WhatsApp des organisations |
| **Logs WhatsApp** | Historique de tous les messages WhatsApp envoyés via la plateforme |
| **Sécurité** | Logs d'audit, activités suspectes, événements de sécurité |
| **Paramètres** | Configuration de niveau plateforme |

---

## 27. Paramètres

### Paramètres de l'espace (Admin)
- Gestion des **sources Google Sheets** : ajouter, nommer, configurer les colonnes de mapping
- **Modèles de messages WhatsApp** par défaut (pour les nouvelles commandes)
- Devise de l'espace
- Configuration de la synchronisation automatique (auto-sync)

### Paramètres personnels (tous rôles)
- Informations de profil
- Devise préférée d'affichage
- Préférences de notifications (quoi me notifier)
- Appareils enregistrés ("Se souvenir de moi")

---

## 28. Relations entre modules

Voici comment les modules s'alimentent et se connectent :

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ESPACE DE TRAVAIL                           │
│                                                                      │
│  SOURCES ──────────────────────► COMMANDES ◄────── BOUTIQUE         │
│  (G.Sheets, Shopify, webhook,                        publique        │
│   saisie manuelle)                   │                               │
│                                      │                               │
│                                      ▼                               │
│  AFFECTATIONS ──────────────► CLOSEUSES ──────► RAPPORTS JOURNALIERS│
│  (sources + produits + villes)   │                     │             │
│                                  │                     │             │
│                                  ▼                     ▼             │
│  CLIENTS ◄──────────────────────────────────── OBJECTIFS            │
│      │                                                               │
│      ▼                                                               │
│  CAMPAGNES WHATSAPP                                                  │
│                                                                      │
│  PRODUITS ──────────────────► STOCK ◄────────── FOURNISSEURS        │
│      │                                                               │
│      ▼                                                               │
│  FINANCES (transactions liées aux produits)                          │
│                                                                      │
│  COMMISSIONS (calculées depuis les commandes livrées)                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Flux clé : de la commande à la commission
```
Commande reçue (G.Sheets / boutique / Shopify)
    ↓
Affectation → assignée à la bonne closeuse
    ↓
Closeuse traite la commande (suivi statut, WhatsApp client)
    ↓
Commande livrée → comptée dans le rapport journalier
    ↓
Rapport → calcul du bénéfice du jour
    ↓
Livraison → calcul de la commission de la closeuse
    ↓
Objectif → progression mise à jour en temps réel
```

### Flux clé : de la boutique à la notification
```
Client visite {sous-domaine}.scalor.net
    ↓
Passe commande sur la boutique
    ↓
Commande créée dans l'espace de travail
    ↓
Notification push à l'admin
    ↓ (optionnel)
WhatsApp automatique envoyé au client
    ↓ (optionnel)
Agent IA démarre une conversation de confirmation de livraison
```

---

## 29. Principes de conception

### Pensé pour l'Afrique
- **WhatsApp est le canal principal**, pas l'email — les clients sont contactés majoritairement par WhatsApp
- Les numéros de téléphone africains sont normalisés automatiquement (préfixes pays, variantes de format)
- Les devises par défaut sont XAF et XOF ; 50+ autres devises disponibles
- Interface en **français**
- Données hébergées de manière à minimiser la latence depuis l'Afrique de l'Ouest et Centrale

### Isolation totale des données
- Chaque organisation est totalement isolée
- Aucune donnée d'une organisation n'est visible par une autre
- Le Super Admin supervise la plateforme sans accéder aux données métier des organisations

### Flexibilité des statuts
- Les statuts des commandes ne sont pas figés
- Les équipes qui travaillent avec Google Sheets et ont leurs propres intitulés de statuts continuent à les utiliser
- Scalor traduit ces statuts libres pour ses propres calculs et rapports

### Multi-sources unifiées
- Peu importe d'où vient la commande (Shopify, Google Sheets, boutique, webhook), elle est traitée, analysée et pilotée de la même façon dans l'interface

### Temps réel
- Les nouveaux messages de chat apparaissent instantanément
- Les campagnes WhatsApp montrent leur progression en direct
- L'import Alibaba IA progresse en temps réel à l'écran

### Accès mobile natif (PWA)
- La plateforme est installable sur téléphone comme une application native
- Navigation mobile optimisée avec barre de navigation basse (tabs)
- Interface prévue pour une utilisation sur smartphones Android et iOS

---

*Document fonctionnel Scalor — Mars 2026*  
*À destination des équipes produit, commerciales, onboarding et support.*
