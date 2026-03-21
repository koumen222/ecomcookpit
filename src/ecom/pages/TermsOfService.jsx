import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: '📜',
      title: '1. Acceptation des conditions',
      content: `En accédant et en utilisant SCALOR ("le Service", "la Plateforme"), vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation ("CGU"). Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le Service.

**Définitions :**
• **"Nous", "Notre", "SCALOR"** : SCALOR - The Operating System for African Ecommerce
• **"Vous", "Utilisateur"** : toute personne ou entité utilisant le Service
• **"Workspace"** : espace de travail dédié à une entreprise ou organisation
• **"Contenu"** : toutes les données, informations, textes, images que vous soumettez au Service

**Capacité juridique :**
Vous déclarez avoir au moins 18 ans (ou l'âge de la majorité dans votre juridiction) et avoir la capacité juridique de conclure un contrat contraignant.`
    },
    {
      icon: '🎯',
      title: '2. Description du service',
      content: `**2.1 Nature du service**
SCALOR est une plateforme SaaS (Software as a Service) de gestion e-commerce conçue pour les entreprises africaines. Le Service permet de :
• Gérer les commandes, produits et clients
• Suivre les livraisons et les paiements
• Analyser les performances commerciales
• Collaborer avec des équipes (closeuses, livreurs, comptables)
• Automatiser les processus de vente

**2.2 Disponibilité**
Nous nous efforçons de maintenir le Service disponible 24/7, mais nous ne garantissons pas une disponibilité ininterrompue. Le Service peut être temporairement indisponible pour :
• Maintenance planifiée (avec notification préalable si possible)
• Mises à jour de sécurité urgentes
• Problèmes techniques imprévus
• Cas de force majeure

**2.3 Modifications du service**
Nous nous réservons le droit de :
• Modifier, suspendre ou interrompre tout ou partie du Service
• Ajouter ou supprimer des fonctionnalités
• Changer les tarifs (avec préavis de 30 jours pour les clients payants)

Nous vous notifierons des modifications substantielles par email ou via la plateforme.`
    },
    {
      icon: '👤',
      title: '3. Compte utilisateur et sécurité',
      content: `**3.1 Création de compte**
Pour utiliser le Service, vous devez :
• Fournir des informations exactes, complètes et à jour
• Choisir un mot de passe sécurisé
• Maintenir la confidentialité de vos identifiants
• Nous informer immédiatement de tout accès non autorisé

**3.2 Responsabilité du compte**
Vous êtes entièrement responsable de :
• Toutes les activités effectuées sous votre compte
• La sécurité de vos identifiants de connexion
• Les actions de vos employés ou collaborateurs ayant accès à votre workspace

**3.3 Comptes multiples**
• Vous ne pouvez créer qu'un seul compte par adresse email
• Les comptes créés pour contourner une suspension seront supprimés
• Les comptes inactifs pendant plus de 3 ans peuvent être supprimés après notification

**3.4 Suspension ou résiliation**
Nous nous réservons le droit de suspendre ou résilier votre compte si :
• Vous violez ces CGU
• Vous utilisez le Service de manière frauduleuse ou illégale
• Vous ne payez pas les frais dus (pour les comptes payants)
• Votre compte présente un risque de sécurité`
    },
    {
      icon: '💳',
      title: '4. Tarification et paiements',
      content: `**4.1 Plans tarifaires**
SCALOR propose différents plans tarifaires :
• **Plan gratuit** : fonctionnalités de base avec limitations
• **Plans payants** : fonctionnalités avancées, support prioritaire, limites étendues

Les tarifs actuels sont disponibles sur notre site web et peuvent être modifiés avec un préavis de 30 jours.

**4.2 Facturation**
• La facturation est mensuelle ou annuelle selon votre choix
• Les paiements sont prélevés automatiquement à chaque période de facturation
• Toutes les factures sont envoyées par email
• Les prix sont indiqués hors taxes (TVA ou taxes locales applicables en sus)

**4.3 Modes de paiement**
Nous acceptons :
• Cartes bancaires (Visa, Mastercard, American Express)
• Mobile Money (selon disponibilité dans votre pays)
• Virements bancaires (pour les contrats annuels)

**4.4 Remboursements**
• **Période d'essai** : annulation gratuite pendant les 14 premiers jours avec remboursement intégral
• **Après la période d'essai** : aucun remboursement pour les mois non utilisés
• **Exceptions** : remboursement au cas par cas en cas de dysfonctionnement majeur du Service

**4.5 Retard de paiement**
En cas de retard de paiement :
• Votre compte sera suspendu après 7 jours de retard
• Vous conservez l'accès en lecture seule pendant 30 jours
• Après 30 jours, votre compte peut être supprimé (avec notification préalable)

**4.6 Résiliation**
• Vous pouvez résilier votre abonnement à tout moment
• La résiliation prend effet à la fin de la période de facturation en cours
• Aucun remboursement au prorata pour les jours non utilisés`
    },
    {
      icon: '📊',
      title: '5. Propriété intellectuelle',
      content: `**5.1 Propriété de SCALOR**
Le Service, incluant mais sans s'y limiter :
• Le code source, l'interface utilisateur, le design
• Les logos, marques, noms commerciaux
• La documentation, les tutoriels, les contenus marketing

...sont la propriété exclusive de SCALOR et sont protégés par les lois sur la propriété intellectuelle.

**5.2 Licence d'utilisation**
Nous vous accordons une licence limitée, non exclusive, non transférable, révocable pour :
• Accéder et utiliser le Service conformément à ces CGU
• Utiliser le Service uniquement à des fins commerciales légitimes

**Vous ne pouvez PAS :**
• Copier, modifier, distribuer ou vendre le Service
• Effectuer de l'ingénierie inverse (reverse engineering)
• Créer des œuvres dérivées du Service
• Utiliser le Service pour créer un produit concurrent
• Retirer les mentions de copyright ou de propriété

**5.3 Vos données et contenus**
• **Vous conservez la propriété** de toutes les données que vous soumettez au Service
• Vous nous accordez une licence mondiale, non exclusive pour héberger, stocker, traiter et afficher vos données uniquement dans le but de fournir le Service
• Nous ne revendiquons AUCUN droit de propriété sur vos données
• Vous pouvez exporter vos données à tout moment

**5.4 Retour d'expérience (Feedback)**
Si vous nous fournissez des suggestions, idées ou commentaires sur le Service :
• Nous pouvons les utiliser librement sans obligation de compensation
• Vous renoncez à tout droit de propriété intellectuelle sur ces suggestions`
    },
    {
      icon: '✅',
      title: '6. Utilisation acceptable',
      content: `**6.1 Utilisations autorisées**
Vous pouvez utiliser le Service pour :
• Gérer votre activité e-commerce de manière légale
• Collaborer avec votre équipe
• Analyser vos performances commerciales
• Automatiser vos processus de vente

**6.2 Utilisations interdites**
Vous vous engagez à NE PAS :

**Activités illégales :**
• Vendre des produits illégaux, contrefaits ou volés
• Blanchir de l'argent ou financer des activités illégales
• Violer les lois sur l'exportation, les sanctions ou embargos
• Enfreindre les droits de propriété intellectuelle de tiers

**Abus techniques :**
• Tenter d'accéder à des comptes ou données d'autres utilisateurs
• Effectuer des attaques (DDoS, injection SQL, XSS, etc.)
• Utiliser des bots, scrapers ou outils automatisés non autorisés
• Surcharger intentionnellement le Service
• Contourner les limitations de votre plan tarifaire

**Contenus interdits :**
• Contenus haineux, discriminatoires, violents ou pornographiques
• Spam, phishing ou contenus trompeurs
• Malwares, virus ou codes malveillants
• Contenus violant la vie privée de tiers

**Manipulation :**
• Créer de faux comptes ou de fausses identités
• Manipuler les statistiques ou les données analytiques
• Usurper l'identité d'une autre personne ou entité

**6.3 Conséquences**
En cas de violation de ces règles :
• Suspension immédiate de votre compte
• Résiliation définitive sans remboursement
• Signalement aux autorités compétentes si nécessaire
• Poursuites judiciaires pour récupération des dommages`
    },
    {
      icon: '🔒',
      title: '7. Confidentialité et protection des données',
      content: `**7.1 Politique de confidentialité**
L'utilisation de vos données personnelles est régie par notre Politique de Confidentialité, disponible à l'adresse : https://scalor.net/ecom/privacy

En utilisant le Service, vous acceptez également notre Politique de Confidentialité.

**7.2 Vos obligations**
Si vous collectez des données personnelles de vos clients via le Service, vous devez :
• Respecter les lois applicables (RGPD, CCPA, POPIA, etc.)
• Obtenir les consentements nécessaires
• Informer vos clients de vos pratiques de collecte de données
• Sécuriser les données de vos clients

**7.3 Traitement des données**
• SCALOR agit en tant que **sous-traitant** pour les données de vos clients
• Vous agissez en tant que **responsable du traitement**
• Nous traitons vos données uniquement selon vos instructions et conformément à notre Politique de Confidentialité

**7.4 Violations de données**
En cas de violation de données affectant vos informations :
• Nous vous notifierons dans les 72 heures
• Nous prendrons des mesures correctives immédiates
• Nous coopérerons avec les autorités compétentes`
    },
    {
      icon: '⚠️',
      title: '8. Limitation de responsabilité',
      content: `**8.1 Service fourni "en l'état"**
Le Service est fourni "EN L'ÉTAT" et "SELON DISPONIBILITÉ", sans garantie d'aucune sorte, expresse ou implicite.

**Nous ne garantissons PAS :**
• Que le Service sera ininterrompu, sans erreur ou sécurisé à 100%
• Que les résultats obtenus seront exacts ou fiables
• Que tous les bugs seront corrigés
• Que le Service répondra à vos besoins spécifiques

**8.2 Exclusion de garanties**
Dans la mesure permise par la loi, nous excluons toutes garanties, y compris :
• Garanties de qualité marchande
• Garanties d'adéquation à un usage particulier
• Garanties de non-contrefaçon
• Garanties découlant de l'usage ou du commerce

**8.3 Limitation de responsabilité**
Dans la mesure maximale permise par la loi :

• Notre responsabilité totale envers vous ne dépassera PAS le montant que vous nous avez payé au cours des 12 derniers mois (ou 100 € si vous utilisez le plan gratuit)

• Nous ne serons PAS responsables des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, incluant :
  - Perte de profits, de revenus ou de données
  - Perte de clientèle ou d'opportunités commerciales
  - Interruption d'activité
  - Coûts de remplacement de biens ou services

**8.4 Exceptions**
Ces limitations ne s'appliquent pas :
• Aux dommages causés par notre négligence grave ou faute intentionnelle
• Aux dommages corporels ou au décès
• Aux obligations qui ne peuvent être légalement exclues ou limitées

**8.5 Indemnisation**
Vous acceptez de nous indemniser, nous défendre et nous dégager de toute responsabilité contre :
• Toute réclamation résultant de votre utilisation du Service
• Votre violation de ces CGU
• Votre violation des droits de tiers
• Les actions de vos employés ou collaborateurs`
    },
    {
      icon: '🌍',
      title: '9. Loi applicable et juridiction',
      content: `**9.1 Loi applicable**
Ces CGU sont régies par les lois de [À compléter - pays/juridiction de SCALOR].

**9.2 Résolution des litiges**
En cas de litige :

**Étape 1 : Négociation amiable**
• Vous devez d'abord nous contacter à legal@scalor.net
• Nous tenterons de résoudre le litige à l'amiable dans les 30 jours

**Étape 2 : Médiation (optionnelle)**
• Si la négociation échoue, nous pouvons recourir à une médiation
• Les frais de médiation seront partagés équitablement

**Étape 3 : Arbitrage ou tribunaux**
• **Pour les entreprises** : arbitrage selon les règles de [institution d'arbitrage]
• **Pour les consommateurs** : tribunaux compétents de votre lieu de résidence (conformément aux lois de protection des consommateurs)

**9.3 Renonciation au recours collectif**
Dans la mesure permise par la loi, vous acceptez de renoncer à tout recours collectif (class action) et de résoudre les litiges individuellement.

**9.4 Juridiction**
Pour les litiges non soumis à arbitrage, les tribunaux de [ville/pays] auront compétence exclusive, sauf disposition légale contraire pour les consommateurs.`
    },
    {
      icon: '📝',
      title: '10. Dispositions générales',
      content: `**10.1 Intégralité de l'accord**
Ces CGU, avec notre Politique de Confidentialité, constituent l'intégralité de l'accord entre vous et SCALOR concernant le Service.

**10.2 Modifications des CGU**
• Nous pouvons modifier ces CGU à tout moment
• Les modifications substantielles vous seront notifiées 30 jours à l'avance par email
• Votre utilisation continue du Service après notification constitue votre acceptation
• Si vous refusez les nouvelles CGU, vous devez cesser d'utiliser le Service

**10.3 Divisibilité**
Si une disposition de ces CGU est jugée invalide ou inapplicable :
• Cette disposition sera modifiée pour être applicable dans la mesure du possible
• Les autres dispositions resteront pleinement en vigueur

**10.4 Renonciation**
Notre non-exercice ou retard dans l'exercice d'un droit ne constitue pas une renonciation à ce droit.

**10.5 Cession**
• Vous ne pouvez pas céder ces CGU sans notre consentement écrit préalable
• Nous pouvons céder ces CGU à tout moment (par exemple en cas de fusion ou acquisition)
• En cas de cession, nous vous en informerons

**10.6 Survie**
Les dispositions suivantes survivront à la résiliation de ces CGU :
• Propriété intellectuelle
• Limitation de responsabilité
• Indemnisation
• Loi applicable et juridiction

**10.7 Force majeure**
Nous ne serons pas responsables des retards ou manquements dus à des causes hors de notre contrôle raisonnable :
• Catastrophes naturelles (tremblements de terre, inondations, etc.)
• Guerres, actes de terrorisme, émeutes
• Pannes d'électricité ou de télécommunications
• Actions gouvernementales, lois ou réglementations
• Cyberattaques majeures

**10.8 Langue**
• La version française de ces CGU fait foi
• En cas de traduction, la version française prévaudra en cas de conflit

**10.9 Contact**
Pour toute question concernant ces CGU :
• **Email** : legal@scalor.net
• **Support** : support@scalor.net
• **Adresse** : [À compléter]`
    },
    {
      icon: '🔔',
      title: '11. Notifications et communications',
      content: `**11.1 Notifications à vous**
Nous pouvons vous envoyer des notifications par :
• Email (à l'adresse associée à votre compte)
• Notifications dans l'application
• Bannières sur la plateforme

Vous acceptez de maintenir une adresse email valide et de consulter régulièrement vos emails.

**11.2 Notifications à nous**
Toute notification légale doit être envoyée à :
• **Email** : legal@scalor.net
• **Adresse postale** : [À compléter]

**11.3 Langue de communication**
Nous communiquons principalement en français et en anglais. Vous pouvez choisir votre langue préférée dans les paramètres de votre compte.`
    },
    {
      icon: '🎓',
      title: '12. Conditions spécifiques',
      content: `**12.1 Utilisateurs professionnels vs consommateurs**
• Si vous êtes un **consommateur** (personne physique agissant à des fins non professionnelles), vous bénéficiez de protections supplémentaires selon les lois de protection des consommateurs de votre pays
• Si vous êtes un **professionnel** (entreprise, organisation), certaines limitations de responsabilité peuvent s'appliquer plus strictement

**12.2 Période d'essai**
• Les nouveaux utilisateurs bénéficient d'une période d'essai de 14 jours
• Pendant cette période, vous pouvez annuler sans frais et obtenir un remboursement intégral
• Après la période d'essai, les conditions de résiliation standard s'appliquent

**12.3 Programmes bêta**
Si vous participez à des programmes bêta ou de test :
• Les fonctionnalités peuvent être instables ou incomplètes
• Nous pouvons modifier ou supprimer ces fonctionnalités sans préavis
• Vous acceptez de fournir des retours et de signaler les bugs
• Des CGU supplémentaires peuvent s'appliquer

**12.4 API et intégrations**
Si vous utilisez notre API :
• Vous devez respecter notre documentation API et les limites de taux
• Nous pouvons modifier ou déprécier l'API avec un préavis de 90 jours
• Vous ne pouvez pas utiliser l'API pour créer un service concurrent

**12.5 Revendeurs et partenaires**
Des conditions spécifiques s'appliquent aux revendeurs et partenaires commerciaux (contrat séparé requis).`
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Conditions légales
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent leading-tight">
            Conditions Générales<br />d'Utilisation
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Veuillez lire attentivement ces conditions avant d'utiliser SCALOR. 
            En utilisant notre service, vous acceptez d'être lié par ces conditions.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-5xl mx-auto px-4 mb-16">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Accès rapide</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tarification', section: 4 },
              { label: 'Vos droits', section: 6 },
              { label: 'Confidentialité', section: 7 },
              { label: 'Contact', section: 10 },
            ].map((link, i) => (
              <button
                key={i}
                onClick={() => document.getElementById(`section-${link.section}`)?.scrollIntoView({ behavior: 'smooth' })}
                className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition"
              >
                § {link.section}. {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 pb-20 space-y-6">
        {sections.map((section, i) => (
          <div 
            key={i} 
            id={`section-${i + 1}`}
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-white/20 transition scroll-mt-20"
          >
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
          <div className="text-4xl mb-4">✍️</div>
          <h3 className="text-xl font-bold text-white mb-3">Acceptation des conditions</h3>
          <p className="text-gray-400 text-sm max-w-xl mx-auto mb-6">
            En créant un compte sur SCALOR, vous acceptez ces Conditions Générales d'Utilisation ainsi que notre Politique de Confidentialité. 
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le Service.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 rounded-xl font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
            >
              Créer un compte
            </button>
            <button 
              onClick={() => navigate('/ecom/privacy')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-sm transition"
            >
              Voir la politique de confidentialité
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} SCALOR. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/ecom/landing')} className="text-xs text-gray-500 hover:text-gray-300 transition">
              Accueil
            </button>
            <span className="text-gray-700">•</span>
            <button onClick={() => navigate('/ecom/privacy')} className="text-xs text-gray-500 hover:text-gray-300 transition">
              Confidentialité
            </button>
            <span className="text-gray-700">•</span>
            <span className="text-xs text-emerald-500">CGU</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
