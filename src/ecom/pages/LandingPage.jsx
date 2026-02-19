import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductSearch from '../components/ProductSearch.jsx';
import ProductSearchDebug from '../components/ProductSearchDebug.jsx';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  const Check = () => (
    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav className="w-full z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-16 object-contain" />
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <a href="#features" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition rounded-lg">Fonctionnalités</a>
            <a href="#advantages" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition rounded-lg">Avantages</a>
            <a href="#roles" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition rounded-lg">Rôles</a>
            <a href="#pricing" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition rounded-lg">Tarifs</a>
            <a href="#security" className="px-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition rounded-lg flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Sécurité
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ecom/login')} className="hidden sm:block px-4 py-2 text-sm text-gray-300 hover:text-white transition">
              Connexion
            </button>
            <button onClick={() => navigate('/ecom/register')} className="px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition shadow-lg shadow-blue-600/20">
              Commencer gratuitement
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="sm:hidden p-2 text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="sm:hidden border-t border-white/5 bg-[#0a0a0f]/95 backdrop-blur-xl px-4 py-4 space-y-2">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg">Fonctionnalités</a>
            <a href="#advantages" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg">Avantages</a>
            <a href="#roles" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg">Rôles</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg">Tarifs</a>
            <a href="#security" onClick={() => setMobileMenu(false)} className="block px-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 rounded-lg">Sécurité</a>
            <button onClick={() => navigate('/ecom/login')} className="block w-full text-left px-3 py-2 text-sm text-gray-300">Connexion</button>
          </div>
        )}
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative pt-16 pb-20 sm:pt-20 sm:pb-32 px-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute top-60 left-1/2 w-72 h-72 bg-indigo-600/8 rounded-full blur-[80px]"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-gray-300 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            La plateforme #1 pour le e-commerce COD en Afrique
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
            Pilotez votre
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              empire e-commerce
            </span>
            <br />
            <span className="text-3xl sm:text-5xl lg:text-6xl text-gray-300">depuis un seul endroit</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            Commandes, clients, prospects, finances, stock, campagnes WhatsApp, rapports — <strong className="text-gray-200">tout est centralisé</strong>. 
            Votre équipe travaille ensemble, chacun avec son propre dashboard adapté à son rôle.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => navigate('/ecom/register')}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-bold text-lg transition shadow-2xl shadow-blue-600/25 flex items-center justify-center gap-2">
              Créer mon espace gratuitement
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </button>
            <button onClick={() => navigate('/ecom/login')}
              className="w-full sm:w-auto px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-lg transition backdrop-blur-sm">
              J'ai déjà un compte
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Gratuit pour commencer
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Aucune carte requise
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Prêt en 30 secondes
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRODUCT SEARCH ═══════════════════ */}
      <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-transparent to-blue-950/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4">
              RECHERCHE DE PRODUITS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Découvrez nos produits</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Explorez notre catalogue de produits testés et validés pour le marché africain.
            </p>
          </div>
          
          <ProductSearch />
        </div>
      </section>

      {/* ═══════════════════ DASHBOARD PREVIEW ═══════════════════ */}
      <section className="pb-20 sm:pb-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-b from-gray-900 to-gray-900/50 rounded-3xl border border-white/10 p-1 shadow-2xl shadow-blue-900/10">
            <div className="bg-gray-950 rounded-[20px] p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                <span className="ml-3 text-xs text-gray-600 font-mono">app.ecom-cockpit.com/dashboard</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Commandes reçues', value: '247', sub: '+18 aujourd\'hui', color: 'text-white', subColor: 'text-blue-400' },
                  { label: 'Bénéfice net', value: '1.2M', sub: 'FCFA ce mois', color: 'text-emerald-400', subColor: 'text-emerald-400/70' },
                  { label: 'Taux livraison', value: '72%', sub: '+8% vs mois dernier', color: 'text-blue-400', subColor: 'text-blue-400/70' },
                  { label: 'Clients actifs', value: '156', sub: '34 prospects', color: 'text-purple-400', subColor: 'text-purple-400/70' }
                ].map((s, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">{s.label}</p>
                    <p className={`text-2xl sm:text-3xl font-black mt-1.5 ${s.color}`}>{s.value}</p>
                    <p className={`text-[11px] mt-1 ${s.subColor}`}>{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'Gummies Nintime', status: 'Winner', emoji: '🏆', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
                  { name: 'Sérum Visage', status: 'Stable', emoji: '📈', bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400' },
                  { name: 'Ceinture Minceur', status: 'Test', emoji: '🧪', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400' },
                  { name: 'Crème Anti-âge', status: 'Winner', emoji: '🏆', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' }
                ].map((p, i) => (
                  <div key={i} className={`${p.bg} border rounded-xl p-3 flex items-center gap-2.5`}>
                    <span className="text-lg">{p.emoji}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-200">{p.name}</p>
                      <p className={`text-[10px] font-medium ${p.text}`}>{p.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS BAND ═══════════════════ */}
      <section className="py-12 sm:py-16 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '10+', label: 'Modules intégrés' },
            { value: '3', label: 'Rôles utilisateurs' },
            { value: '100%', label: 'Données sécurisées' },
            { value: '24/7', label: 'Accessible partout' }
          ].map((s, i) => (
            <div key={i}>
              <p className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ FEATURES GRID ═══════════════════ */}
      <section id="features" className="py-20 sm:py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4">
              FONCTIONNALITÉS
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-5">Tout pour piloter votre business</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Du premier produit à la dernière livraison, chaque étape est couverte.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '📦', title: 'Gestion des Commandes', desc: 'Import automatique depuis Google Sheets. Suivi en temps réel : en attente, confirmée, expédiée, livrée, retour. Tags automatiques.', gradient: 'from-blue-500/20 to-blue-600/5' },
              { icon: '👥', title: 'Clients & Prospects', desc: 'Base clients synchronisée automatiquement. Prospects créés depuis les commandes en attente. Filtres par ville, produit, tags, statut.', gradient: 'from-emerald-500/20 to-emerald-600/5' },
              { icon: '📊', title: 'Rapports Quotidiens', desc: 'Rapports de vente journaliers : commandes reçues, livrées, retours, dépenses pub, bénéfice net, ROAS. Historique complet.', gradient: 'from-purple-500/20 to-purple-600/5' },
              { icon: '💰', title: 'Suivi Financier', desc: 'Revenus, dépenses, bénéfice net calculés automatiquement. Transactions détaillées. Résumé financier par période.', gradient: 'from-amber-500/20 to-amber-600/5' },
              { icon: '📱', title: 'Campagnes WhatsApp', desc: 'Relancez vos prospects et clients par WhatsApp. Messages personnalisés avec variables. Envoi par lots avec pauses automatiques.', gradient: 'from-green-500/20 to-green-600/5' },
              { icon: '🏷️', title: 'Gestion Produits', desc: 'Statuts produits : Test, Stable, Winner. Suivi des marges, prix d\'achat/vente. Catégories et images.', gradient: 'from-indigo-500/20 to-indigo-600/5' },
              { icon: '📦', title: 'Stock & Fournisseurs', desc: 'Commandes fournisseurs, suivi des arrivages, alertes de stock bas. Historique complet des mouvements.', gradient: 'from-rose-500/20 to-rose-600/5' },
              { icon: '🔔', title: 'Notifications', desc: 'Alertes en temps réel : nouvelles commandes, stock bas, rapports à remplir. Notifications push et in-app.', gradient: 'from-cyan-500/20 to-cyan-600/5' },
              { icon: '📈', title: 'Analytics & Décisions', desc: 'Tableau de bord avec KPIs clés. Historique des décisions business. Suivi de la performance par produit et par période.', gradient: 'from-violet-500/20 to-violet-600/5' }
            ].map((f, i) => (
              <div key={i} className={`bg-gradient-to-br ${f.gradient} border border-white/5 rounded-2xl p-6 hover:border-white/10 transition group`}>
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-lg mb-2.5 text-white">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ KEY ADVANTAGES ═══════════════════ */}
      <section id="advantages" className="py-20 sm:py-32 px-4 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold mb-4">
              AVANTAGES
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-5">Pourquoi choisir Ecom Cockpit ?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Conçu spécialement pour le e-commerce COD en Afrique de l'Ouest.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left column - big cards */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/5 border border-blue-500/10 rounded-2xl p-8">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="text-xl font-bold mb-3">Sync automatique Google Sheets</h3>
                <p className="text-gray-400 leading-relaxed mb-4">Connectez votre Google Sheet de commandes et tout se synchronise automatiquement. Commandes, clients, prospects — tout est créé et mis à jour en un clic.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">Import auto</span>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">Détection colonnes</span>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">Tags automatiques</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-600/20 to-green-600/5 border border-emerald-500/10 rounded-2xl p-8">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="text-xl font-bold mb-3">Marketing WhatsApp intégré</h3>
                <p className="text-gray-400 leading-relaxed mb-4">Créez des campagnes de relance ciblées. Sélectionnez vos prospects par statut, ville, produit. Messages personnalisés avec variables. Envoi sécurisé avec pauses.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">Templates prêts</span>
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">Variables dynamiques</span>
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">Anti-spam</span>
                </div>
              </div>
            </div>

            {/* Right column - list of advantages */}
            <div className="space-y-4">
              {[
                { icon: '⚡', title: 'Rapide à configurer', desc: 'Créez votre espace en 30 secondes. Invitez votre équipe avec un code. Commencez immédiatement.' },
                { icon: '🔒', title: 'Données isolées par workspace', desc: 'Chaque business a son espace séparé. Vos données sont privées et sécurisées.' },
                { icon: '📱', title: 'Mobile-first', desc: 'Interface responsive optimisée pour smartphone. Gérez votre business depuis n\'importe où.' },
                { icon: '🏷️', title: 'Tags & filtres intelligents', desc: 'Tags automatiques basés sur le statut des commandes. Filtrez par ville, produit, source, tag.' },
                { icon: '📊', title: 'KPIs calculés automatiquement', desc: 'ROAS, taux de livraison, bénéfice net, marge — tout est calculé pour vous en temps réel.' },
                { icon: '🔄', title: 'Prospects auto-synchronisés', desc: 'Les commandes en attente deviennent automatiquement des prospects. Relancez-les en un clic.' },
                { icon: '💼', title: 'Multi-business', desc: 'Gérez plusieurs boutiques depuis un seul compte. Chaque boutique a son propre espace.' },
                { icon: '🆓', title: 'Gratuit pour démarrer', desc: 'Pas de carte bancaire requise. Commencez gratuitement et évoluez selon vos besoins.' }
              ].map((a, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 hover:border-white/10 transition">
                  <span className="text-2xl flex-shrink-0">{a.icon}</span>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">{a.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ ROLES ═══════════════════ */}
      <section id="roles" className="py-20 sm:py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold mb-4">
              COLLABORATION
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-5">Un dashboard par rôle</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Chaque membre voit exactement ce dont il a besoin. Pas plus, pas moins.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                name: 'Admin / Gérant',
                emoji: '👑',
                gradient: 'from-purple-600 to-indigo-700',
                border: 'border-purple-500/20',
                items: [
                  'Dashboard complet avec tous les KPIs',
                  'Gestion produits, stock & fournisseurs',
                  'Rapports financiers & bénéfices',
                  'Gestion des clients & prospects',
                  'Campagnes marketing WhatsApp',
                  'Gestion de l\'équipe & rôles',
                  'Décisions & stratégie business'
                ]
              },
              {
                name: 'Closeuse / Vendeuse',
                emoji: '💼',
                gradient: 'from-blue-600 to-cyan-700',
                border: 'border-blue-500/20',
                items: [
                  'Rapports de vente quotidiens',
                  'Suivi des commandes clients',
                  'Vue des produits disponibles',
                  'Dashboard simplifié',
                  'Gestion de ses propres clients',
                  'Notifications de nouvelles commandes'
                ]
              },
              {
                name: 'Comptable',
                emoji: '📊',
                gradient: 'from-emerald-600 to-teal-700',
                border: 'border-emerald-500/20',
                items: [
                  'Transactions & mouvements',
                  'Résumé financier par période',
                  'Rapports détaillés avec filtres',
                  'Suivi revenus & dépenses',
                  'Bénéfice net & marges',
                  'Export des données'
                ]
              }
            ].map((r, i) => (
              <div key={i} className={`bg-white/[0.02] border ${r.border} rounded-2xl overflow-hidden hover:border-white/10 transition`}>
                <div className={`bg-gradient-to-r ${r.gradient} px-6 py-5 flex items-center gap-3`}>
                  <span className="text-2xl">{r.emoji}</span>
                  <h3 className="font-bold text-lg">{r.name}</h3>
                </div>
                <ul className="p-6 space-y-3.5">
                  {r.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="py-20 sm:py-32 px-4 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold mb-4">
              COMMENT ÇA MARCHE
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-5">Prêt en 3 étapes</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Créez votre espace', desc: 'Inscrivez-vous gratuitement. Votre espace de travail est prêt en 30 secondes. Aucune configuration complexe.', icon: '🏗️' },
              { step: '02', title: 'Connectez vos données', desc: 'Liez votre Google Sheet de commandes. L\'import est automatique. Clients et prospects sont créés instantanément.', icon: '🔗' },
              { step: '03', title: 'Pilotez & développez', desc: 'Suivez vos KPIs, relancez vos prospects, gérez votre stock. Invitez votre équipe pour travailler ensemble.', icon: '🚀' }
            ].map((s, i) => (
              <div key={i} className="text-center relative">
                {i < 2 && <div className="hidden sm:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent"></div>}
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-indigo-400 mb-2 tracking-widest">ÉTAPE {s.step}</div>
                <h3 className="font-bold text-lg mb-3">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="py-20 sm:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-semibold mb-4">
              TARIFS
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-5">Simple et transparent</h2>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">Commencez gratuitement, évoluez quand vous êtes prêt.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
              <div className="text-sm font-semibold text-gray-400 mb-2">Starter</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black">Gratuit</span>
              </div>
              <p className="text-sm text-gray-500 mb-8">Pour démarrer votre activité</p>
              <ul className="space-y-3 mb-8">
                {['1 espace de travail', 'Gestion commandes & clients', 'Rapports quotidiens', 'Suivi financier de base', 'Import Google Sheets', '2 utilisateurs max'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/ecom/register')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold text-sm transition">
                Commencer gratuitement
              </button>
            </div>

            {/* Pro */}
            <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border-2 border-blue-500/30 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-xs font-bold">
                POPULAIRE
              </div>
              <div className="text-sm font-semibold text-blue-400 mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black">9 900</span>
                <span className="text-lg text-gray-400">FCFA/mois</span>
              </div>
              <p className="text-sm text-gray-500 mb-8">Pour les équipes qui grandissent</p>
              <ul className="space-y-3 mb-8">
                {['Tout du plan Starter', 'Utilisateurs illimités', 'Campagnes WhatsApp', 'Prospects & marketing', 'Stock & fournisseurs', 'Analytics avancés', 'Support prioritaire'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/ecom/register')}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-600/20">
                Essayer Pro gratuitement
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TESTIMONIALS ═══════════════════ */}
      <section className="py-20 sm:py-32 px-4 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-5">Ils utilisent Ecom Cockpit</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { name: 'Aminata K.', role: 'E-commerçante, Abidjan', text: 'Avant je gérais tout sur Excel. Maintenant mes closeuses remplissent leurs rapports et je vois tout en temps réel. Le gain de temps est énorme.' },
              { name: 'Ibrahim D.', role: 'Gérant boutique, Dakar', text: 'La sync Google Sheets m\'a changé la vie. Mes commandes arrivent automatiquement, les prospects sont créés tout seuls. Je me concentre sur la vente.' },
              { name: 'Fatou S.', role: 'Closeuse, Bamako', text: 'L\'interface est super simple. Je remplis mon rapport en 2 minutes et mon patron voit tout. Plus besoin d\'envoyer des captures d\'écran.' }
            ].map((t, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-5 italic">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ SÉCURITÉ & CONFIDENTIALITÉ ═══════════════════ */}
      <section id="security" className="py-20 sm:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Sécurité certifiée
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-5">Vos données sont <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">en sécurité</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Nous protégeons vos données avec les standards les plus élevés — même nos propres administrateurs ne peuvent pas y accéder.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🔐', title: 'Chiffrement total', desc: 'Mots de passe hashés avec bcrypt (irréversible). Communications protégées par HTTPS/TLS. Aucun admin ne peut lire vos mots de passe.' },
              { icon: '🏗️', title: 'Isolation des espaces', desc: 'Chaque workspace est complètement cloisonné. Les données d\'un espace ne sont jamais accessibles depuis un autre.' },
              { icon: '🚫', title: 'Zéro tracking', desc: 'Aucun cookie publicitaire, aucun Google Analytics, aucun Facebook Pixel. Nous ne revendons jamais vos données.' },
              { icon: '👁️', title: 'Transparence totale', desc: 'Consultez, exportez ou supprimez vos données à tout moment. Vous gardez le contrôle total sur vos informations.' },
              { icon: '⚖️', title: 'Accès par rôle strict', desc: 'Chaque utilisateur n\'accède qu\'aux données nécessaires à sa fonction. Principe du moindre privilège appliqué.' },
              { icon: '📋', title: 'Journalisation', desc: 'Toute action administrative est tracée et horodatée. Les accès sont surveillés en permanence pour votre protection.' },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition group">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-base font-bold text-white mb-2 group-hover:text-emerald-300 transition">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button onClick={() => navigate('/ecom/privacy')} className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-semibold transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Lire notre politique de confidentialité complète
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FINAL CTA ═══════════════════ */}
      <section className="py-20 sm:py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNnYySDEydi0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-black mb-5">Prêt à scaler votre business ?</h2>
              <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                Rejoignez les e-commerçants qui utilisent Ecom Cockpit pour gérer leur activité. Créez votre espace en 30 secondes.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => navigate('/ecom/register')}
                  className="w-full sm:w-auto px-10 py-4 bg-white text-indigo-700 rounded-2xl font-bold text-lg hover:bg-blue-50 transition shadow-2xl flex items-center justify-center gap-2">
                  Commencer maintenant
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </button>
                <button onClick={() => navigate('/ecom/login')}
                  className="w-full sm:w-auto px-10 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-semibold text-lg transition backdrop-blur-sm">
                  Se connecter
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-white/5 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-5 gap-8 mb-10">
            <div className="sm:col-span-2">
              <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-14 object-contain mb-4" />
              <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                La plateforme tout-en-un pour gérer votre business e-commerce COD en Afrique. Commandes, clients, finances, marketing — tout centralisé.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-300">Plateforme</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-sm text-gray-500 hover:text-gray-300 transition">Fonctionnalités</a></li>
                <li><a href="#advantages" className="text-sm text-gray-500 hover:text-gray-300 transition">Avantages</a></li>
                <li><a href="#pricing" className="text-sm text-gray-500 hover:text-gray-300 transition">Tarifs</a></li>
                <li><a href="#roles" className="text-sm text-gray-500 hover:text-gray-300 transition">Rôles</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-300">Compte</h4>
              <ul className="space-y-2.5">
                <li><button onClick={() => navigate('/ecom/register')} className="text-sm text-gray-500 hover:text-gray-300 transition">Créer un compte</button></li>
                <li><button onClick={() => navigate('/ecom/login')} className="text-sm text-gray-500 hover:text-gray-300 transition">Se connecter</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-300">Légal & Sécurité</h4>
              <ul className="space-y-2.5">
                <li><button onClick={() => navigate('/ecom/privacy')} className="text-sm text-gray-500 hover:text-gray-300 transition">Politique de confidentialité</button></li>
                <li><a href="#security" className="text-sm text-gray-500 hover:text-gray-300 transition">Sécurité des données</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} Ecom Cockpit. Tous droits réservés.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/ecom/privacy')} className="text-xs text-gray-500 hover:text-gray-300 transition">Confidentialité</button>
              <span className="text-gray-700">•</span>
              <p className="text-xs text-gray-600">Fait avec ❤️ pour les e-commerçants africains</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
