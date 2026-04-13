import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ExternalLink,
  LogIn,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
} from 'lucide-react';
import { analyticsApi } from '../services/analytics.js';

const SuperAdminActivity = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await analyticsApi.getUsersActivity({ limit: 100 });
        setData(res.data?.data || null);
      } catch (error) {
        console.error('SuperAdminActivity load error:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const roleBadge = {
    super_admin: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    ecom_admin: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    ecom_closeuse: 'bg-sky-50 text-sky-700 ring-sky-600/10',
    ecom_compta: 'bg-violet-50 text-violet-700 ring-violet-600/10',
    ecom_livreur: 'bg-orange-50 text-orange-700 ring-orange-600/10',
  };

  const roleLabels = {
    super_admin: 'Super Admin',
    ecom_admin: 'Admin',
    ecom_closeuse: 'Closeuse',
    ecom_compta: 'Comptable',
    ecom_livreur: 'Livreur',
  };

  const numberFmt = new Intl.NumberFormat('fr-FR');
  const formatMoney = (value, currency = 'XAF') => `${numberFmt.format(Math.round(value || 0))} ${currency}`;

  const boutiqueActivity = data?.boutiqueActivity || [];
  const recentLogins = data?.recentLogins || [];
  const boutiqueTotals = data?.boutiqueTotals || {
    usersWithBoutiques: 0,
    totalBoutiques: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
  };

  const formatDate = (value) => {
    if (!value) return 'Jamais';
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (value) => {
    if (!value) return 'Jamais';
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(value);
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return boutiqueActivity;
    return boutiqueActivity.filter((user) => {
      const userMatch = [user.email, user.name].some((value) => String(value || '').toLowerCase().includes(term));
      if (userMatch) return true;
      return (user.stores || []).some((store) => [store.name, store.subdomain, store.workspaceName].some((value) => String(value || '').toLowerCase().includes(term)));
    });
  }, [boutiqueActivity, search]);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-700 animate-spin" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Chargement de l'activité boutique…</p>
      </div>
    </div>
  );

  const StatCard = ({ icon: Icon, label, value, hint }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Activité boutique</h1>
          <p className="mt-1 text-sm text-gray-500">Toutes les boutiques de tous les users avec nombre de boutiques, commandes, CA, produits et liens publics.</p>
        </div>
        <div className="w-full lg:w-80">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un utilisateur ou une boutique…"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={User} label="Users avec boutique" value={numberFmt.format(boutiqueTotals.usersWithBoutiques)} hint="Propriétaires de boutiques" />
        <StatCard icon={Store} label="Boutiques créées" value={numberFmt.format(boutiqueTotals.totalBoutiques)} hint="Stores + legacy" />
        <StatCard icon={ShoppingCart} label="E-commandes" value={numberFmt.format(boutiqueTotals.totalOrders)} hint="Toutes boutiques confondues" />
        <StatCard icon={Activity} label="CA boutiques" value={formatMoney(boutiqueTotals.totalRevenue)} hint="Agrégé sur tout le parc" />
        <StatCard icon={Package} label="Produits boutique" value={numberFmt.format(boutiqueTotals.totalProducts)} hint="Produits créés en boutique" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
              Aucun résultat pour cette recherche.
            </div>
          ) : filteredUsers.map((user) => (
            <div key={user.userId} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                        {user.email?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-gray-900">{user.name || user.email}</p>
                        <p className="truncate text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${roleBadge[user.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{roleLabels[user.role] || user.role || 'Sans rôle'}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">{user.boutiqueCount || 0} boutique{(user.boutiqueCount || 0) > 1 ? 's' : ''}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">{user.workspaceCount || 0} workspace{(user.workspaceCount || 0) > 1 ? 's' : ''}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{user.isActive ? 'Actif' : 'Désactivé'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[460px]">
                    <div className="rounded-2xl bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Commandes</div>
                      <div className="mt-1 text-lg font-bold text-gray-900">{numberFmt.format(user.totalOrders || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">CA</div>
                      <div className="mt-1 text-lg font-bold text-gray-900">{formatMoney(user.totalRevenue || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Produits</div>
                      <div className="mt-1 text-lg font-bold text-gray-900">{numberFmt.format(user.totalProducts || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Dernière connexion</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{timeAgo(user.lastLogin)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {(user.stores || []).length === 0 ? (
                  <div className="px-6 py-6 text-sm text-gray-400">Aucune boutique créée pour cet utilisateur.</div>
                ) : user.stores.map((store) => (
                  <div key={store._id} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 xl:max-w-[36%]">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">{store.name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${store.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{store.isActive ? 'Active' : 'Inactive'}</span>
                          {store.isLegacyStore ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Legacy</span> : null}
                        </div>
                        <div className="mt-1 space-y-1 text-sm text-gray-500">
                          <p>Workspace: <span className="font-medium text-gray-700">{store.workspaceName}</span></p>
                          <p>Sous-domaine: <span className="font-medium text-gray-700">{store.subdomain || 'Aucun'}</span></p>
                          <p>Créée le: <span className="font-medium text-gray-700">{formatDate(store.createdAt)}</span></p>
                        </div>
                        {store.url ? (
                          <a href={store.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                            Voir la boutique
                            <ExternalLink size={13} />
                          </a>
                        ) : null}
                      </div>

                      <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Nb commandes</div>
                          <div className="mt-1 text-xl font-bold text-gray-900">{numberFmt.format(store.totalOrders || 0)}</div>
                          <div className="mt-1 text-xs text-gray-500">Dernière: {timeAgo(store.lastOrderAt)}</div>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">CA boutique</div>
                          <div className="mt-1 text-xl font-bold text-gray-900">{formatMoney(store.totalRevenue || 0, store.currency || 'XAF')}</div>
                          <div className="mt-1 text-xs text-gray-500">Chiffre d'affaires brut</div>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Produits générés</div>
                          <div className="mt-1 text-xl font-bold text-gray-900">{numberFmt.format(store.totalProducts || 0)}</div>
                          <div className="mt-1 text-xs text-gray-500">{numberFmt.format(store.publishedProducts || 0)} publiés</div>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Dernier produit</div>
                          <div className="mt-1 text-sm font-bold text-gray-900">{timeAgo(store.lastProductAt)}</div>
                          <div className="mt-1 text-xs text-gray-500">Catalogue boutique</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <ShoppingBag size={15} className="text-emerald-600" />
                        Produits de la boutique
                      </div>
                      {(store.productPreviews || []).length === 0 ? (
                        <p className="mt-3 text-sm text-gray-400">Aucun produit enregistré pour cette boutique.</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {store.productPreviews.map((product, index) => (
                            product.url ? (
                              <a key={`${store._id}-${product.slug || index}`} href={product.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700">
                                {product.name || product.slug || `Produit ${index + 1}`}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span key={`${store._id}-${product.slug || index}`} className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
                                {product.name || product.slug || `Produit ${index + 1}`}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <LogIn size={16} className="text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-900">Dernières connexions</h2>
              </div>
              <p className="mt-1 text-xs text-gray-400">Flux récent de connexion</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {recentLogins.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">Aucune connexion enregistrée.</div>
              ) : recentLogins.slice(0, 20).map((login, index) => (
                <div key={`${login.email || 'unknown'}-${login.date || index}`} className="px-5 py-3">
                  <p className="truncate text-sm font-medium text-gray-900">{login.name || login.email || 'Utilisateur inconnu'}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{login.email || 'Email indisponible'}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ring-1 ring-inset ${roleBadge[login.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{roleLabels[login.role] || login.role || 'Sans rôle'}</span>
                    <span className="text-[11px] text-gray-400">{timeAgo(login.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-amber-200/70 bg-amber-50/40 shadow-sm">
            <div className="border-b border-amber-200/60 px-5 py-4">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={16} />
                <h2 className="text-sm font-semibold">Points d'attention</h2>
              </div>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-amber-900">
              <div className="rounded-2xl bg-white/70 px-4 py-3">
                <p className="font-semibold">Users sans workspace</p>
                <p className="mt-1 text-2xl font-bold">{numberFmt.format(data?.noWorkspace || 0)}</p>
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3">
                <p className="font-semibold">Workspaces inactifs</p>
                <p className="mt-1 text-2xl font-bold">{numberFmt.format(data?.inactiveWorkspaces || 0)}</p>
                <p className="mt-1 text-xs text-amber-700">Sur {numberFmt.format(data?.totalWorkspaces || 0)} workspaces total</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminActivity;
