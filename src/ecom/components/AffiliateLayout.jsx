import React, { useMemo, useCallback, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAffiliateToken } from '../services/affiliatePortalApi.js';

const AffiliateLayoutComponent = ({ children, affiliate }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAffiliateToken();
    navigate('/affiliate/login');
  };

  const navItems = useMemo(() => [
    {
      name: 'Dashboard', href: '/affiliate/dashboard',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    },
    {
      name: 'Conversions', href: '/affiliate/conversions',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
      name: 'Commissions', href: '/affiliate/commissions',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
  ], []);

  const isActive = useCallback((href) => {
    if (href === '/affiliate/dashboard') {
      return location.pathname === '/affiliate/dashboard' || location.pathname === '/affiliate';
    }
    return location.pathname.startsWith(href);
  }, [location.pathname]);

  const getPageTitle = (pathname) => {
    if (pathname.includes('/conversions')) return 'Conversions';
    if (pathname.includes('/commissions')) return 'Commissions';
    return 'Dashboard';
  };

  const initial = affiliate?.name?.charAt(0)?.toUpperCase() || 'A';

  const NavLink = ({ item }) => {
    const active = isActive(item.href);
    return (
      <Link
        to={item.href}
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-[#0F6B4F]/10 text-[#0F6B4F]'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={`flex-shrink-0 ${active ? 'text-[#0F6B4F]' : 'text-gray-400 group-hover:text-gray-600'}`}>
          {item.icon}
        </span>
        <span className="truncate flex-1">{item.name}</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0F6B4F] flex-shrink-0" />}
      </Link>
    );
  };

  const mobileMainTabs = navItems.slice(0, 4);
  const mobileIcon = (item) => React.cloneElement(item.icon, { className: 'w-5 h-5' });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden max-w-[100vw]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[220px] lg:fixed lg:inset-y-0 z-30 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <Link to="/affiliate/dashboard" className="flex items-center gap-2.5 mb-1">
              <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            </Link>
            <span className="text-[10px] font-bold text-[#0F6B4F] uppercase tracking-wider">Espace Affilié</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation</p>
            {navItems.map(item => <NavLink key={item.name} item={item} />)}
          </nav>

          {/* Bottom: user */}
          <div className="border-t border-gray-100">
            <div className="px-3 pb-3 pt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{initial}</span>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold text-gray-800 truncate">{affiliate?.name || 'Affilié'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{affiliate?.email || 'affilié'}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[220px]">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-14 px-4">
            <Link to="/affiliate/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="Scalor" className="h-7 object-contain" />
              <span className="text-[10px] font-bold text-[#0F6B4F] uppercase tracking-wider">Affilié</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initial}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex border-b h-14 items-center px-5 fixed top-0 left-[220px] right-0 z-20 bg-white border-gray-200 gap-4">
          <div className="flex items-center gap-2 min-w-[160px]">
            <h1 className="text-[15px] font-semibold text-gray-900 truncate">{getPageTitle(location.pathname)}</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-500">Code : <span className="font-mono font-bold text-[#0F6B4F]">{affiliate?.referralCode || '—'}</span></span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Déconnexion
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0 pt-14">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="flex items-stretch px-2" style={{ height: '60px' }}>
          {mobileMainTabs.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200 active:scale-95"
              >
                <span className={`transition-colors duration-200 ${active ? 'text-[#0F6B4F]' : 'text-gray-500'}`}>
                  {mobileIcon(item)}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-[#0F6B4F]' : 'text-gray-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

const AffiliateLayout = memo(AffiliateLayoutComponent);
export default AffiliateLayout;
