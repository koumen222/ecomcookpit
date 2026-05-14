import { useState } from 'react';

const S = (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p} />;

const icons = {
  play:     <S><polygon points="5 3 19 12 5 21 5 3"/></S>,
  link:     <S><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></S>,
  settings: <S><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></S>,
  sparkles: <S><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></S>,
  bag:      <S><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></S>,
  file:     <S><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></S>,
  clipboard:<S><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></S>,
  message:  <S><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></S>,
  package:  <S><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></S>,
  users:    <S><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></S>,
  chart:    <S><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></S>,
  target:   <S><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></S>,
  dollar:   <S><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></S>,
  box:      <S><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></S>,
  refresh:  <S><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></S>,
  cpu:      <S><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></S>,
};

const chapters = [
  { id: '7.1',  title: 'Introduction à Scalor',          icon: 'play',      duration: '12 min', videoUrl: 'https://www.youtube.com/embed/8j9TnrLKlzo' },
  { id: '7.2',  title: 'Connecter sa boutique à Scalor', icon: 'link',      duration: '18 min', videoUrl: 'https://www.youtube.com/embed/68mygQnJ3fs' },
  { id: '7.3',  title: 'Paramétrer sa boutique Scalor',  icon: 'settings',  duration: '22 min', videoUrl: 'https://www.youtube.com/embed/13dOKNrKdwA' },
  { id: '7.4',  title: 'Les fonctionnalités sur Scalor', icon: 'sparkles',  duration: '20 min', videoUrl: 'https://www.youtube.com/embed/W2Ucwi0odv4' },
  { id: '7.5',  title: 'Créer sa boutique sur Scalor',   icon: 'bag',       duration: '30 min', videoUrl: 'https://www.youtube.com/embed/gZ6upfzlpy8' },
  { id: '7.6',  title: 'Page produit — Méthode 1',       icon: 'file',      duration: '25 min', videoUrl: 'https://www.youtube.com/embed/HF3u7RURUQo' },
  { id: '7.7',  title: 'Formulaire & upsell',            icon: 'clipboard', duration: '20 min', videoUrl: 'https://www.youtube.com/embed/8ewwUJoRE88' },
  { id: '7.8',  title: 'Automatiser son WhatsApp',       icon: 'message',   duration: '28 min', videoUrl: 'https://www.youtube.com/embed/8ewwUJoRE88' },
  { id: '7.9',  title: 'Gérer les commandes Scalor',     icon: 'package',   duration: '18 min', videoUrl: 'https://www.youtube.com/embed/vOF_3jnMBUw' },
  { id: '7.10', title: "Gestion d'équipe",               icon: 'users',     duration: '15 min', videoUrl: 'https://www.youtube.com/embed/5p7E1inglN0' },
  { id: '7.11', title: 'Gérer les rapports',             icon: 'chart',     duration: '18 min', videoUrl: 'https://www.youtube.com/embed/YXpj9UqGtIo' },
  { id: '7.12', title: 'Se fixer des objectifs',         icon: 'target',    duration: '14 min', videoUrl: 'https://www.youtube.com/embed/7kP90J1oSMc' },
  { id: '7.13', title: 'Gestion des finances',           icon: 'dollar',    duration: '22 min', videoUrl: 'https://www.youtube.com/embed/6_9k_bGHxZ0' },
  { id: '7.14', title: 'Gestion de Stock',               icon: 'box',       duration: '20 min', videoUrl: 'https://www.youtube.com/embed/JPUFiWPEz4I' },
  { id: '7.15', title: 'Relancer les clients auto.',     icon: 'refresh',   duration: '24 min', videoUrl: 'https://www.youtube.com/embed/bBoZcovhpFM' },
  { id: '7.16', title: 'Configurer son agent IA ✦',      icon: 'cpu',       duration: '35 min', videoUrl: 'https://www.youtube.com/embed/Ge2TEBZFJ-8' },
];

export default function Formation() {
  const [activeId, setActiveId] = useState(null);

  const toggle = (id) => setActiveId(prev => prev === id ? null : id);

  return (
    <div className="bg-white min-h-full">

      {/* HERO */}
      <div className="px-4 py-8" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-black text-gray-900" style={{ fontSize: 'clamp(22px, 5vw, 32px)', letterSpacing: '-0.5px', lineHeight: 1 }}>
              FORMATION <span style={{ color: '#16a34a' }}>OFFERTE</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white flex-shrink-0" style={{ background: '#0f4c2a' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              ~49 000 FCFA
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-600 whitespace-nowrap">
            Incluse <span className="text-emerald-600 font-bold">gratuitement</span> dans votre compte Scalor
          </p>
        </div>
      </div>

      {/* PROGRAMME */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h2 className="text-xl font-black text-gray-900 mb-1">Programme — Module 7</h2>
        <p className="text-sm text-gray-400 mb-8">16 chapitres · 6h+ de contenu · Accès à vie</p>

        <div className="space-y-2">
          {chapters.map((ch) => {
            const isOpen = activeId === ch.id;
            return (
              <div
                key={ch.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isOpen ? 'border-emerald-400' : 'border-gray-100'
                }`}
              >
                {/* Ligne chapitre */}
                <button
                  onClick={() => toggle(ch.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-left transition cursor-pointer ${
                    isOpen ? 'bg-emerald-50' : 'bg-white hover:bg-emerald-50/30'
                  }`}
                >
                  <span className={`w-8 flex items-center justify-center flex-shrink-0 ${isOpen ? 'text-emerald-600' : 'text-emerald-500'}`}>
                    {icons[ch.icon]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 mr-2">{ch.id}</span>
                    <span className="text-sm font-semibold text-gray-800">{ch.title}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{ch.duration}</span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${isOpen ? 'bg-emerald-500 rotate-90' : 'bg-gray-100'}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </div>
                </button>

                {/* Vidéo inline */}
                {isOpen && (
                  <div style={{ background: '#0a0a0a' }}>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        key={ch.videoUrl}
                        src={`${ch.videoUrl}?autoplay=1`}
                        title={ch.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
