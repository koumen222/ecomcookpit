import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: '📋',
      title: '1. Introduction et champ d\'application',
      content: `**SCALOR** ("nous", "notre", "nos") exploite la plateforme scalor.net (le "Service"). Cette politique de confidentialité décrit comment nous collectons, utilisons, stockons et protégeons vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD), à la loi californienne sur la protection de la vie privée des consommateurs (CCPA) et aux autres réglementations applicables.

**Responsable du traitement des données :**
SCALOR - The Operating System for African Ecommerce
Email : privacy@scalor.net
Adresse : [À compléter]

Cette politique s'applique à tous les utilisateurs de notre plateforme, qu'ils soient situés en Afrique, en Europe, aux États-Unis ou ailleurs dans le monde.`
    },
    {
      icon: '🔒',
      title: '2. Données collectées et base légale',
      content: `**2.1 Données d'identification et d'authentification**
• Email, mot de passe (hashé), nom complet, numéro de téléphone
• Base légale : Exécution du contrat, consentement

**2.2 Données de commandes et transactions**
• Informations sur les commandes, produits, clients, montants, statuts de paiement
• Adresses de livraison et de facturation
• Base légale : Exécution du contrat, obligations légales (comptabilité)

**2.3 Données d'utilisation et techniques**
• Adresse IP, type de navigateur, système d'exploitation
• Pages consultées, durée de session, actions effectuées
• Logs de sécurité et d'erreurs
• Base légale : Intérêt légitime (sécurité, amélioration du service)

**2.4 Données analytiques (Google Analytics)**
• Nous utilisons Google Analytics pour analyser l'utilisation de notre site web public (pages marketing, landing pages)
• Google Analytics collecte des données anonymisées sur les visites, le comportement de navigation, les sources de trafic
• Nous avons activé l'anonymisation IP et désactivé le partage de données avec Google
• Vous pouvez désactiver Google Analytics via : https://tools.google.com/dlpage/gaoptout
• Base légale : Consentement (via notre bannière de cookies), intérêt légitime

**2.5 Cookies et technologies similaires**
• Cookies essentiels : authentification, sécurité, préférences (obligatoires)
• Cookies analytiques : Google Analytics (avec consentement)
• Nous n'utilisons PAS de cookies publicitaires ou de tracking tiers à des fins marketing

**Nous ne collectons JAMAIS :**
• Données biométriques, données de santé, opinions politiques
• Données bancaires complètes (nous utilisons des processeurs de paiement tiers sécurisés)
• Données de navigation en dehors de notre plateforme`
    },
    {
      icon: '🎯',
      title: '3. Finalités du traitement',
      content: `Nous utilisons vos données uniquement pour les finalités suivantes :

**3.1 Fourniture du service**
• Création et gestion de votre compte
• Traitement et suivi des commandes
• Gestion des workspaces et des équipes
• Support client et assistance technique

**3.2 Sécurité et prévention de la fraude**
• Authentification et contrôle d'accès
• Détection et prévention des activités frauduleuses
• Journalisation des accès pour audit de sécurité

**3.3 Amélioration du service**
• Analyse des performances et de l'utilisation
• Développement de nouvelles fonctionnalités
• Optimisation de l'expérience utilisateur

**3.4 Obligations légales**
• Conformité fiscale et comptable
• Réponse aux demandes des autorités compétentes
• Conservation des données pour les durées légales requises

**3.5 Communication**
• Notifications transactionnelles (confirmations de commande, alertes de sécurité)
• Mises à jour importantes du service
• Support client (uniquement si vous nous contactez)

**Nous n'utilisons JAMAIS vos données pour :**
• Publicité ciblée ou remarketing
• Vente ou location à des tiers
• Profilage automatisé sans consentement explicite`
    },
    {
      icon: '🛡️',
      title: '4. Sécurité et mesures de protection',
      content: `**4.1 Chiffrement et cryptographie**
• **Mots de passe** : hashage bcrypt avec salage (12 rounds minimum), irréversible
• **Données en transit** : HTTPS/TLS 1.3 pour toutes les communications
• **Données au repos** : chiffrement des bases de données et sauvegardes
• **Tokens d'authentification** : JWT avec expiration automatique, rotation régulière

**4.2 Architecture de sécurité**
• **Isolation des workspaces** : cloisonnement strict, aucun accès inter-espaces
• **Contrôle d'accès basé sur les rôles (RBAC)** : principe du moindre privilège
• **Pare-feu applicatif (WAF)** : protection contre les attaques courantes (SQL injection, XSS, CSRF)
• **Surveillance 24/7** : détection d'intrusion, alertes automatiques

**4.3 Protection contre les accès internes**
• Les administrateurs ne peuvent PAS voir vos mots de passe (hashés de manière irréversible)
• Journalisation complète de toutes les actions administratives
• Accès aux données de production limité et audité
• Séparation des environnements (développement, test, production)

**4.4 Sauvegardes et continuité**
• Sauvegardes chiffrées quotidiennes
• Plan de reprise d'activité (DRP) testé régulièrement
• Redondance géographique des données critiques

**4.5 Tests de sécurité**
• Audits de sécurité réguliers
• Tests d'intrusion annuels par des tiers indépendants
• Mise à jour continue des dépendances et correctifs de sécurité`
    },
    {
      icon: '🌍',
      title: '5. Partage et transferts de données',
      content: `**5.1 Nous ne vendons JAMAIS vos données personnelles.**

**5.2 Partage limité avec des prestataires de services**
Nous partageons certaines données avec des prestataires tiers de confiance, uniquement dans la mesure nécessaire :

• **Hébergement** : serveurs cloud sécurisés (AWS, Google Cloud, ou équivalent)
• **Paiements** : processeurs de paiement conformes PCI-DSS (Stripe, PayPal, etc.)
• **Email transactionnel** : services d'envoi d'emails (SendGrid, Mailgun, etc.)
• **Analytique** : Google Analytics (avec anonymisation IP et consentement)
• **Support client** : outils de ticketing (si vous nous contactez)

Tous nos prestataires sont contractuellement tenus de :
• Protéger vos données avec le même niveau de sécurité
• Utiliser vos données uniquement pour les finalités spécifiées
• Ne pas revendre ou réutiliser vos données

**5.3 Transferts internationaux**
Vos données peuvent être transférées et stockées dans des pays en dehors de votre pays de résidence, y compris vers des pays ne bénéficiant pas d'une décision d'adéquation de la Commission européenne.

Dans ce cas, nous mettons en place des garanties appropriées :
• **Clauses contractuelles types (SCC)** approuvées par la Commission européenne
• **Certifications** : Privacy Shield (si applicable), ISO 27001
• **Mesures techniques supplémentaires** : chiffrement de bout en bout

**5.4 Obligations légales**
Nous pouvons divulguer vos données si requis par la loi :
• Ordonnances judiciaires, assignations, mandats
• Demandes des autorités fiscales ou réglementaires
• Protection des droits, de la propriété ou de la sécurité de SCALOR, de nos utilisateurs ou du public

Dans la mesure permise par la loi, nous vous informerons de toute demande de ce type.`
    },
    {
      icon: '⚖️',
      title: '6. Vos droits (RGPD, CCPA et autres)',
      content: `**Vous disposez des droits suivants sur vos données personnelles :**

**6.1 Droit d'accès**
• Obtenez une copie de toutes les données que nous détenons sur vous
• Demandez des informations sur le traitement de vos données

**6.2 Droit de rectification**
• Corrigez les données inexactes ou incomplètes
• Mettez à jour vos informations directement dans votre profil

**6.3 Droit à l'effacement ("droit à l'oubli")**
• Demandez la suppression de vos données personnelles
• Exceptions : obligations légales de conservation (ex: comptabilité fiscale)

**6.4 Droit à la limitation du traitement**
• Demandez la suspension temporaire du traitement de vos données

**6.5 Droit à la portabilité**
• Recevez vos données dans un format structuré, couramment utilisé et lisible par machine (JSON, CSV)
• Transférez vos données à un autre service

**6.6 Droit d'opposition**
• Opposez-vous au traitement de vos données pour des raisons tenant à votre situation particulière
• Opposition absolue au marketing direct (nous n'en faisons pas)

**6.7 Droit de retrait du consentement**
• Retirez votre consentement à tout moment (ex: cookies analytiques)
• Cela n'affecte pas la licéité du traitement avant le retrait

**6.8 Droit de ne pas faire l'objet d'une décision automatisée**
• Nous n'utilisons pas de profilage ou de décisions automatisées ayant des effets juridiques significatifs

**6.9 Droits spécifiques CCPA (résidents de Californie)**
• Droit de savoir quelles données sont collectées et vendues (nous ne vendons pas)
• Droit de supprimer vos données
• Droit de non-discrimination pour l'exercice de vos droits

**Comment exercer vos droits :**
• Email : privacy@scalor.net
• Délai de réponse : 30 jours maximum (RGPD), 45 jours (CCPA)
• Nous pouvons vous demander une preuve d'identité pour sécuriser votre demande

**Réclamation auprès d'une autorité de contrôle :**
Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une plainte auprès de :
• **UE** : CNIL (France), ICO (UK), ou votre autorité nationale de protection des données
• **USA** : California Attorney General (résidents CA)
• **Afrique** : autorité de protection des données de votre pays (si applicable)`
    },
    {
      icon: '🔥',
      title: '7. Conservation et suppression des données',
      content: `**7.1 Durées de conservation**

• **Données de compte actif** : conservées tant que votre compte est actif
• **Données de commandes** : 10 ans (obligations comptables et fiscales)
• **Logs de sécurité** : 12 mois maximum
• **Cookies analytiques** : 26 mois maximum (Google Analytics)
• **Données de support client** : 3 ans après la dernière interaction

**7.2 Suppression de compte**
Lorsque vous supprimez votre compte :
• **Suppression immédiate** : accès révoqué, données personnelles anonymisées dans les 30 jours
• **Conservation légale** : données de commandes conservées 10 ans (anonymisées autant que possible)
• **Sauvegardes** : les données peuvent persister dans les sauvegardes jusqu'à 90 jours, puis sont définitivement effacées

**7.3 Inactivité prolongée**
• Après 3 ans d'inactivité, nous vous contactons pour confirmer si vous souhaitez conserver votre compte
• Sans réponse après 6 mois, le compte est supprimé selon la procédure ci-dessus

**7.4 Suppression sécurisée**
• Effacement cryptographique des données
• Destruction physique des supports de stockage en fin de vie
• Certificats de destruction disponibles sur demande`
    },
    {
      icon: '🍪',
      title: '8. Cookies et technologies de suivi',
      content: `**8.1 Types de cookies utilisés**

**Cookies strictement nécessaires (pas de consentement requis) :**
• **auth_token** : authentification, session sécurisée (durée : 7 jours)
• **csrf_token** : protection contre les attaques CSRF (durée : session)
• **workspace_id** : identification du workspace actif (durée : session)

**Cookies de préférences (pas de consentement requis) :**
• **theme** : thème clair/sombre (durée : 1 an)
• **language** : langue préférée (durée : 1 an)
• **currency** : devise préférée (durée : 1 an)

**Cookies analytiques (consentement requis) :**
• **Google Analytics (_ga, _gid, _gat)** : analyse du trafic et du comportement (durée : 2 ans)
  - Anonymisation IP activée
  - Partage de données avec Google désactivé
  - Utilisé uniquement sur les pages publiques (landing, marketing)

**8.2 Gestion des cookies**
• Vous pouvez refuser les cookies analytiques via notre bannière de consentement
• Vous pouvez supprimer les cookies via les paramètres de votre navigateur
• Désactivation de Google Analytics : https://tools.google.com/dlpage/gaoptout

**8.3 Autres technologies**
• **LocalStorage** : stockage local de préférences (thème, langue, devise)
• **SessionStorage** : données temporaires de session (non persistantes)
• Aucun tracking par empreinte digitale (fingerprinting)
• Aucun pixel de suivi publicitaire (Facebook Pixel, etc.)`
    },
    {
      icon: '👶',
      title: '9. Protection des mineurs',
      content: `Notre service n'est pas destiné aux personnes de moins de 18 ans (ou l'âge de la majorité dans votre juridiction).

• Nous ne collectons pas sciemment de données personnelles de mineurs
• Si nous découvrons qu'un mineur a créé un compte, nous le supprimerons immédiatement
• Si vous êtes parent/tuteur et pensez que votre enfant nous a fourni des données, contactez-nous : privacy@scalor.net`
    },
    {
      icon: '🔄',
      title: '10. Modifications de cette politique',
      content: `**10.1 Mises à jour**
Nous pouvons modifier cette politique de confidentialité pour refléter :
• Évolutions de nos pratiques
• Changements réglementaires
• Nouvelles fonctionnalités

**10.2 Notification**
• Les modifications substantielles vous seront notifiées par email et/ou via une bannière sur la plateforme
• La date de "Dernière mise à jour" en haut de cette page sera actualisée
• Nous conservons un historique des versions précédentes (disponible sur demande)

**10.3 Acceptation**
• Votre utilisation continue du service après notification constitue votre acceptation des modifications
• Si vous refusez les nouvelles conditions, vous pouvez supprimer votre compte`
    },
    {
      icon: '📬',
      title: '11. Contact et délégué à la protection des données',
      content: `**Pour toute question relative à la protection de vos données ou pour exercer vos droits :**

**Email principal :** privacy@scalor.net
**Email support :** support@scalor.net
**Adresse postale :** [À compléter]

**Délégué à la Protection des Données (DPO) :**
Email : dpo@scalor.net

**Délais de réponse :**
• Demandes d'information : 48 heures ouvrées
• Exercice des droits RGPD : 30 jours maximum
• Exercice des droits CCPA : 45 jours maximum

**Langue :**
Nous répondons en français, anglais et autres langues selon disponibilité.

**Réclamations :**
Si vous n'êtes pas satisfait de notre réponse, vous pouvez contacter :
• **France** : CNIL - 3 Place de Fontenoy, 75007 Paris - www.cnil.fr
• **UE** : votre autorité nationale de protection des données
• **Californie** : California Attorney General - oag.ca.gov`
    },
    {
      icon: '🌐',
      title: '12. Conformité internationale',
      content: `**SCALOR s'engage à respecter les réglementations suivantes :**

• **RGPD** (Règlement Général sur la Protection des Données - UE)
• **CCPA** (California Consumer Privacy Act - USA)
• **LGPD** (Lei Geral de Proteção de Dados - Brésil)
• **POPIA** (Protection of Personal Information Act - Afrique du Sud)
• **Lois nationales** sur la protection des données des pays africains où nous opérons

**Certifications et standards :**
• ISO 27001 (Sécurité de l'information) - en cours
• SOC 2 Type II - en cours
• PCI-DSS (via nos processeurs de paiement)

**Transparence :**
Nous publions un rapport de transparence annuel détaillant :
• Nombre de demandes d'accès aux données par les autorités
• Nombre de violations de données (le cas échéant)
• Statistiques sur l'exercice des droits des utilisateurs`
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F1115] text-white">
      {/* Header */}
      <nav className="w-full bg-[#0F1115]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/ecom/landing')} className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
              Retour
            </button>
            <button onClick={() => navigate('/ecom/login')} className="px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 rounded-xl transition">
              Connexion
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative py-16 sm:py-24 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-700/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Vos données sont protégées
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent leading-tight">
            Politique de Confidentialité<br />& Sécurité des Données
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Chez Scalor, la sécurité de vos données est notre priorité absolue. 
            Découvrez comment nous protégeons vos informations, vis-à-vis de nos propres administrateurs.
          </p>
          <p className="text-gray-500 text-sm mt-4">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-5xl mx-auto px-4 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '🔐', label: 'Chiffrement', desc: 'bcrypt + TLS' },
            { icon: '🏗️', label: 'Isolation', desc: 'Workspaces cloisonnés' },
            { icon: '👁️‍🗨️', label: 'Transparence', desc: 'Accès à vos données' },
            { icon: '🚫', label: 'Zéro tracking', desc: 'Aucun cookie pub' },
          ].map((badge, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition">
              <div className="text-2xl mb-2">{badge.icon}</div>
              <div className="text-sm font-semibold text-white">{badge.label}</div>
              <div className="text-xs text-gray-500 mt-1">{badge.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 pb-20 space-y-6">
        {sections.map((section, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-white/20 transition">
            <div className="flex items-start gap-4">
              <div className="text-3xl flex-shrink-0 mt-1">{section.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-4">{section.title}</h2>
                <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                  {section.content.split('**').map((part, j) => 
                    j % 2 === 1 ? <strong key={j} className="text-white font-medium">{part}</strong> : part
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Acceptation */}
        <div className="bg-gradient-to-r from-emerald-600/10 to-emerald-700/10 border border-emerald-600/20 rounded-2xl p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-white mb-3">Votre consentement</h3>
          <p className="text-gray-400 text-sm max-w-xl mx-auto mb-6">
            En créant un compte sur Scalor, vous acceptez cette politique de confidentialité. 
            Vous pouvez retirer votre consentement à tout moment en supprimant votre compte ou en nous contactant.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 rounded-xl font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
            >
              Créer un compte en toute sécurité
            </button>
            <button 
              onClick={() => navigate('/ecom/login')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-sm transition"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} Scalor. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/ecom/landing')} className="text-xs text-gray-500 hover:text-gray-300 transition">Accueil</button>
            <span className="text-gray-700">•</span>
            <span className="text-xs text-emerald-500">Politique de confidentialité</span>
            <span className="text-gray-700">•</span>
            <button onClick={() => navigate('/ecom/terms')} className="text-xs text-gray-500 hover:text-gray-300 transition">CGU</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
