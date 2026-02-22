import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: '🔒',
      title: '1. Protection des données personnelles',
      content: `Ecom Cockpit s'engage à protéger vos données personnelles conformément aux réglementations en vigueur. Nous collectons uniquement les données strictement nécessaires au fonctionnement de nos services :
      
• **Email et mot de passe** — pour l'authentification sécurisée de votre compte
• **Nom et téléphone** — pour la gestion des commandes et la communication
• **Données de commandes** — pour le suivi et l'analyse de votre activité commerciale
• **Adresses de livraison** — uniquement dans le cadre du traitement des commandes

Aucune donnée n'est collectée à des fins publicitaires ou revendue à des tiers.`
    },
    {
      icon: '🛡️',
      title: '2. Sécurité technique',
      content: `Nous appliquons des mesures de sécurité avancées pour protéger vos données :

• **Chiffrement des mots de passe** — algorithme bcrypt avec salage (12 rounds), rendant les mots de passe impossibles à lire, même par nos administrateurs
• **Chiffrement en transit** — toutes les communications sont protégées par HTTPS/TLS
• **Tokens JWT sécurisés** — sessions authentifiées avec expiration automatique
• **Isolation des espaces de travail** — chaque workspace est cloisonné, les données d'un espace ne sont jamais accessibles depuis un autre
• **Contrôle d'accès par rôle** — chaque utilisateur n'accède qu'aux données autorisées par son rôle (admin, closeuse, comptable, livreur)`
    },
    {
      icon: '🚫',
      title: '3. Protection contre les accès administrateurs',
      content: `Même les administrateurs et le super administrateur sont soumis à des restrictions strictes :

• **Mots de passe invisibles** — les mots de passe sont hashés de manière irréversible. Aucun administrateur ne peut voir ou récupérer votre mot de passe
• **Journalisation des accès** — toute action d'un administrateur est tracée et horodatée
• **Principe du moindre privilège** — chaque rôle n'a accès qu'aux données nécessaires à sa fonction
• **Pas d'accès aux données financières personnelles** — les comptables voient les transactions mais jamais les mots de passe ou données sensibles des utilisateurs
• **Séparation des responsabilités** — aucun rôle unique ne dispose d'un accès total et incontrôlé`
    },
    {
      icon: '📦',
      title: '4. Données des commandes et clients',
      content: `Les données relatives à vos commandes et clients sont protégées :

• **Cloisonnement par workspace** — vos données commerciales sont isolées de celles des autres utilisateurs
• **Pas de partage inter-espaces** — même le super admin ne peut pas mélanger les données entre les espaces de travail
• **Suppression sur demande** — vous pouvez demander la suppression complète de vos données à tout moment
• **Export de données** — vous avez le droit d'exporter toutes vos données dans un format lisible`
    },
    {
      icon: '🍪',
      title: '5. Cookies et stockage local',
      content: `Nous utilisons un minimum de stockage local :

• **Token d'authentification** — stocké de manière sécurisée pour maintenir votre session
• **Préférences d'affichage** — thème, devise, langue (stockés localement sur votre appareil)
• **Aucun cookie de tracking** — nous n'utilisons pas de cookies publicitaires ou de suivi
• **Aucun outil d'analyse tiers** — pas de Google Analytics, Facebook Pixel ou équivalent sur la plateforme de gestion`
    },
    {
      icon: '⚖️',
      title: '6. Vos droits',
      content: `En tant qu'utilisateur, vous disposez des droits suivants :

• **Droit d'accès** — consultez toutes les données que nous détenons sur vous
• **Droit de rectification** — modifiez vos informations à tout moment via votre profil
• **Droit à l'effacement** — demandez la suppression définitive de votre compte et données
• **Droit à la portabilité** — exportez vos données dans un format standard
• **Droit d'opposition** — refusez certains traitements de vos données
• **Droit de retrait du consentement** — retirez votre consentement à tout moment

Pour exercer ces droits, contactez-nous à l'adresse indiquée dans la section contact.`
    },
    {
      icon: '🔄',
      title: '7. Conservation des données',
      content: `Nous conservons vos données selon les principes suivants :

• **Données de compte** — conservées tant que votre compte est actif
• **Données de commandes** — conservées pendant la durée de votre utilisation du service
• **Logs de sécurité** — conservés 12 mois maximum
• **Après suppression du compte** — toutes les données personnelles sont effacées sous 30 jours`
    },
    {
      icon: '📬',
      title: '8. Contact et réclamations',
      content: `Pour toute question relative à la protection de vos données :

• **Email** — privacy@ecomcockpit.com
• **Délai de réponse** — nous nous engageons à répondre sous 48 heures ouvrées
• **Réclamation** — si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à l'autorité de protection des données de votre pays`
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <nav className="w-full bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/ecom/landing')} className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-12 object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
              Retour
            </button>
            <button onClick={() => navigate('/ecom/login')} className="px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition">
              Connexion
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative py-16 sm:py-24 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Vos données sont protégées
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent leading-tight">
            Politique de Confidentialité<br />& Sécurité des Données
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Chez Ecom Cockpit, la sécurité de vos données est notre priorité absolue. 
            Découvrez comment nous protégeons vos informations, même vis-à-vis de nos propres administrateurs.
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
        <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-white mb-3">Votre consentement</h3>
          <p className="text-gray-400 text-sm max-w-xl mx-auto mb-6">
            En créant un compte sur Ecom Cockpit, vous acceptez cette politique de confidentialité. 
            Vous pouvez retirer votre consentement à tout moment en supprimant votre compte ou en nous contactant.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-600/20"
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
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} Ecom Cockpit. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/ecom/landing')} className="text-xs text-gray-500 hover:text-gray-300 transition">Accueil</button>
            <span className="text-gray-700">•</span>
            <span className="text-xs text-blue-400">Politique de confidentialité</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
