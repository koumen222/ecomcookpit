import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3, Users, Building2, Activity, FileText,
  Clock, Bell, MessageSquare, Zap, Settings, RefreshCw,
  CheckCircle2, AlertCircle, DollarSign, Layers, List, Store,
} from 'lucide-react';

const NAV = [
  { to: '/ecom/super-admin',                       label: 'Dashboard',    icon: BarChart3     },
  { to: '/ecom/super-admin/users',                 label: 'Utilisateurs', icon: Users         },
  { to: '/ecom/super-admin/workspaces',            label: 'Workspaces',   icon: Building2     },
  { to: '/ecom/super-admin/analytics',             label: 'Analytics',    icon: Activity      },
  { to: '/ecom/super-admin/billing',               label: 'Billing',      icon: DollarSign    },
  { to: '/ecom/super-admin/product-page-history',  label: 'Pages IA',     icon: FileText      },
  { to: '/ecom/super-admin/activity',              label: 'Activité',     icon: Clock         },
  { to: '/ecom/super-admin/boutique-stats',        label: 'Stats Boutique', icon: Store       },
  { to: '/ecom/super-admin/push',                  label: 'Push',         icon: Bell          },
  { to: '/ecom/super-admin/whatsapp-postulations', label: 'WhatsApp',     icon: MessageSquare },
  { to: '/ecom/super-admin/whatsapp-logs',         label: 'WA Logs',      icon: List          },
  { to: '/ecom/super-admin/scalor-whatsapp',       label: 'WA Scalor',    icon: Layers        },
  { to: '/ecom/super-admin/feature-analytics',     label: 'Features',     icon: Zap           },
  { to: '/ecom/super-admin/settings',              label: 'Config',       icon: Settings      },
];

const SuperAdminShell = ({
  title,
  subtitle,
  icon: Icon,
  success,
  error,
  refreshing = false,
  onRefresh,
  actions,
  children,
  maxWidth = '1600px',
}) => {
  const location = useLocation();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4f8 0%, #f8fafc 100%)' }}>
      {/* ── Dark header ── */}
      <div style={{ background: 'linear-gradient(135deg, #0c1425 0%, #162032 50%, #0c1f16 100%)' }}
           className="px-4 sm:px-6 pt-5 pb-0 shadow-2xl border-b border-white/5">
        <div style={{ maxWidth }} className="mx-auto">

          {/* Title row */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                     style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.15) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">{title}</h1>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
                {subtitle && (
                  <p className="text-xs font-medium mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.9)' }}>{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all"
                  style={{ color: 'rgba(148,163,184,0.9)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(148,163,184,0.9)'; }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast strip */}
          {(success || error) && (
            <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
              success
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                : 'bg-red-500/15 text-red-300 border border-red-500/25'
            }`}>
              {success
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                : <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{success || error}</span>
            </div>
          )}

          {/* Nav pills — scrollable on mobile */}
          <nav className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {NAV.map(({ to, label, icon: NavIcon }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 relative"
                  style={active
                    ? { color: '#fff', borderBottom: '2px solid #10b981' }
                    : { color: 'rgba(148,163,184,0.8)', borderBottom: '2px solid transparent' }
                  }
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderBottomColor = 'rgba(16,185,129,0.4)'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(148,163,184,0.8)'; e.currentTarget.style.borderBottomColor = 'transparent'; } }}
                >
                  <NavIcon className="w-3.5 h-3.5" />{label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{ maxWidth }} className="mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
};

export default SuperAdminShell;
