import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

// ── Boutique Sidebar Navigation ──────────────────────────────────────────────
const BOUTIQUE_NAV = [
  {
    name: 'Dashboard',
    href: '/ecom/boutique',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    exact: true,
  },
  {
    name: 'Produits',
    href: '/ecom/boutique/products',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'Commandes',
    href: '/ecom/boutique/orders',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: 'Pixel & Tracking',
    href: '/ecom/boutique/pixel',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: 'Paiements',
    href: '/ecom/boutique/payments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: 'Domaines',
    href: '/ecom/boutique/domains',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    name: 'Paramètres',
    href: '/ecom/boutique/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ── Mobile bottom tabs (5 max) ───────────────────────────────────────────────
const MOBILE_TABS = ['Dashboard', 'Produits', 'Commandes', 'Thème', 'Paramètres'];

const BoutiqueLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, workspace } = useEcomAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [entering, setEntering] = useState(true);

  // Entry animation
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 400);
    return () => clearTimeout(t);
  }, []);

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.href;
    return location.pathname.startsWith(item.href);
  };

  const mobileTabs = useMemo(() => BOUTIQUE_NAV.filter(i => MOBILE_TABS.includes(i.name)), []);
  const mobileMore = useMemo(() => BOUTIQUE_NAV.filter(i => !MOBILE_TABS.includes(i.name)), []);

  const storeName = workspace?.storeSettings?.name || workspace?.name || 'Ma Boutique';
  const themeColor = workspace?.storeSettings?.themeColor || '#0F6B4F';

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden max-w-[100vw] transition-all duration-500 ${entering ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}>

      {/* ── Desktop Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:fixed lg:inset-y-0 z-30 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">

          {/* Header — Boutique branding */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <button
              onClick={() => navigate('/ecom/dashboard/admin')}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition mb-3 group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Retour à Scalor</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeColor + '20' }}>
                <svg className="w-5 h-5" style={{ color: themeColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{storeName}</p>
                <p className="text-[10px] text-gray-400 font-medium">Module Boutique</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {BOUTIQUE_NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  style={active ? { backgroundColor: themeColor } : {}}
                >
                  <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom: Preview store link */}
          <div className="border-t border-gray-100 p-3">
            <a
              href={workspace?.storeSettings?.subdomain ? `https://${workspace.storeSettings.subdomain}.scalor.net` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition group"
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Voir ma boutique</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[240px]">

        {/* Mobile header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/ecom/dashboard/admin')} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor + '20' }}>
                  <svg className="w-4 h-4" style={{ color: themeColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-gray-900">Boutique</span>
              </div>
            </div>
            <a
              href={workspace?.storeSettings?.subdomain ? `https://${workspace.storeSettings.subdomain}.scalor.net` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex border-b h-14 items-center px-6 fixed top-0 left-[240px] right-0 z-20 bg-white border-gray-200">
          <h1 className="text-[15px] font-semibold text-gray-900">
            {getBoutiquePageTitle(location.pathname)}
          </h1>
          <div className="flex-1" />
          <a
            href={workspace?.storeSettings?.subdomain ? `https://${workspace.storeSettings.subdomain}.scalor.net` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
            style={{ color: themeColor }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Voir ma boutique
          </a>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 pb-20 lg:pt-14 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar ──────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="flex items-stretch px-2" style={{ height: '60px' }}>
          {mobileTabs.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200 active:scale-95"
              >
                <span className={`transition-colors duration-200 ${active ? '' : 'text-gray-500'}`} style={active ? { color: themeColor } : {}}>
                  {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                </span>
                <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${active ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* More menu */}
          <div className="relative flex-1">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-95"
            >
              <svg className={`w-5 h-5 transition-colors duration-200 ${moreOpen ? 'text-[#0F6B4F]' : 'text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
                <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
              </svg>
              <span className={`text-[10px] font-medium leading-none ${moreOpen ? 'text-gray-900' : 'text-gray-500'}`}>Plus</span>
            </button>

            {moreOpen && (
              <>
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[45]" onClick={() => setMoreOpen(false)} />
                <div className="fixed bottom-0 left-0 right-0 z-50 px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl mb-2">
                    <div className="px-5 pt-3 pb-2">
                      <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plus d'options</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {mobileMore.map((item) => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-4 px-5 py-4 text-[16px] font-medium active:bg-gray-100 transition-colors ${active ? '' : 'text-gray-900'}`}
                            style={active ? { color: themeColor } : {}}
                          >
                            <span className={`flex-shrink-0 ${active ? '' : 'text-gray-400'}`} style={active ? { color: themeColor } : {}}>
                              {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                            </span>
                            <span className="flex-1 truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};

const getBoutiquePageTitle = (pathname) => {
  if (pathname === '/ecom/boutique') return 'Dashboard Boutique';
  if (pathname.includes('/boutique/products/new')) return 'Nouveau produit';
  if (pathname.includes('/boutique/products') && pathname.includes('/edit')) return 'Modifier produit';
  if (pathname.includes('/boutique/products')) return 'Produits';
  if (pathname.includes('/boutique/orders')) return 'Commandes';
  if (pathname.includes('/boutique/theme')) return 'Thème & Apparence';
  if (pathname.includes('/boutique/pages')) return 'Pages';
  if (pathname.includes('/boutique/pixel')) return 'Pixel & Tracking';
  if (pathname.includes('/boutique/payments')) return 'Paiements';
  if (pathname.includes('/boutique/domains')) return 'Domaines';
  if (pathname.includes('/boutique/settings')) return 'Paramètres & Branding';
  return 'Boutique';
};

export default BoutiqueLayout;
