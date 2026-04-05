import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../contexts/StoreContext.jsx';

const StoreSwitcher = () => {
  const { stores, activeStore, switchStore } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!stores || stores.length === 0) return null;

  const displayName = activeStore?.storeSettings?.storeName || activeStore?.name || 'Ma boutique';
  const themeColor = activeStore?.storeSettings?.storeThemeColor || '#0F6B4F';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm max-w-[200px]"
      >
        {/* Color dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: themeColor }}
        />
        <span className="truncate flex-1 text-left">{displayName}</span>
        {stores.length > 1 && (
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[220px]">
            <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mes boutiques</p>
            {stores.map(s => {
              const name = s.storeSettings?.storeName || s.name;
              const color = s.storeSettings?.storeThemeColor || '#0F6B4F';
              const isActive = s._id === activeStore?._id;
              return (
                <button
                  key={s._id}
                  onClick={() => { switchStore(s); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    {name?.[0]?.toUpperCase() || '?'}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    {s.subdomain && (
                      <p className="text-xs text-gray-400 truncate">{s.subdomain}.scalor.net</p>
                    )}
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}

            <div className="border-t border-gray-100 mt-1 pt-1">
              <Link
                to="/ecom/boutique/nouvelle"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <span className="font-medium">Nouvelle boutique</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StoreSwitcher;
