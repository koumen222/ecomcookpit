import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  History,
  Wallet,
  User,
} from 'lucide-react';

const navItems = [
  { to: '/ecom/livreur', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { to: '/ecom/livreur/available', label: 'Dispo', icon: Package },
  { to: '/ecom/livreur/deliveries', label: 'En cours', icon: Truck },
  { to: '/ecom/livreur/history', label: 'Historique', icon: History },
  { to: '/ecom/livreur/earnings', label: 'Gains', icon: Wallet },
  { to: '/ecom/livreur/profile', label: 'Profil', icon: User },
];

export default function LivreurLayout({ children }) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors"
              >
                <Icon
                  size={22}
                  className={isActive ? 'text-indigo-600' : 'text-gray-400'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium leading-none ${
                    isActive ? 'text-indigo-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
