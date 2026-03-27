import React, { useEffect, useMemo, useState } from 'react';
import {
  createProviderInstance,
  deleteProviderInstance,
  getProviderMe,
  listProviderInstances,
  loginProvider,
  providerApiBaseUrl,
  providerStorage,
  refreshProviderToken,
  registerProvider,
  updateProviderInstance,
  verifyProviderEmail
} from '../services/providerApi.js';

const initialRegister = {
  email: '',
  password: '',
  company: '',
  name: '',
  phone: ''
};

const initialLogin = {
  email: '',
  password: ''
};

const initialInstance = {
  name: '',
  subdomain: '',
  currency: 'XAF'
};

const ProviderService = () => {
  const [mode, setMode] = useState('login');
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [verifyToken, setVerifyToken] = useState('');
  const [instanceForm, setInstanceForm] = useState(initialInstance);
  const [editingInstance, setEditingInstance] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [provider, setProvider] = useState(providerStorage.getProfile());
  const [instances, setInstances] = useState([]);
  const [token, setToken] = useState(providerStorage.getToken());

  const isAuthenticated = Boolean(token);

  const tokenPreview = useMemo(() => {
    if (!token) return 'Aucun token';
    if (token.length < 24) return token;
    return `${token.slice(0, 10)}...${token.slice(-8)}`;
  }, [token]);

  const safeError = (err) => setError(err?.message || 'Une erreur est survenue');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, instancesRes] = await Promise.all([
        getProviderMe(),
        listProviderInstances()
      ]);
      setProvider(profileRes?.data || null);
      setInstances(instancesRes?.data?.instances || []);
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated]);

  const onRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await registerProvider(registerForm);
      const newToken = res?.provider?.apiToken || '';
      setToken(newToken);
      setMessage('Compte provider cree. Verifiez votre email, puis connectez-vous.');
      setRegisterForm(initialRegister);
      setMode('verify');
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    if (!verifyToken.trim()) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyProviderEmail(verifyToken.trim());
      setMessage('Email verifie avec succes. Vous pouvez maintenant vous connecter.');
      setVerifyToken('');
      setMode('login');
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await loginProvider(loginForm);
      const newToken = res?.data?.token || '';
      setToken(newToken);
      setProvider(res?.data?.provider || null);
      setLoginForm(initialLogin);
      setMessage('Connexion provider reussie.');
      await loadDashboard();
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefreshToken = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await refreshProviderToken();
      const newToken = res?.data?.token || '';
      setToken(newToken);
      setMessage('Token rafraichi avec succes.');
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onCreateInstance = async (e) => {
    e.preventDefault();
    if (!instanceForm.name.trim()) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await createProviderInstance({
        name: instanceForm.name.trim(),
        subdomain: instanceForm.subdomain.trim() || undefined,
        settings: {
          currency: instanceForm.currency,
          businessType: 'ecommerce',
          providerManaged: true
        }
      });
      setMessage('Instance creee avec succes.');
      setInstanceForm(initialInstance);
      await loadDashboard();
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onStartEdit = (inst) => {
    setEditingInstance(inst.id);
    setInstanceForm({
      name: inst.name || '',
      subdomain: inst.subdomain || '',
      currency: 'XAF'
    });
  };

  const onSaveEdit = async (instanceId) => {
    if (!instanceForm.name.trim()) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await updateProviderInstance(instanceId, {
        name: instanceForm.name.trim(),
        storeSettings: {
          storeName: instanceForm.name.trim()
        }
      });
      setMessage('Instance mise a jour.');
      setEditingInstance(null);
      setInstanceForm(initialInstance);
      await loadDashboard();
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteInstance = async (instanceId) => {
    const ok = window.confirm('Supprimer cette instance ? Cette action est irreversible.');
    if (!ok) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await deleteProviderInstance(instanceId);
      setMessage('Instance supprimee.');
      await loadDashboard();
    } catch (err) {
      safeError(err);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = () => {
    providerStorage.clear();
    setToken('');
    setProvider(null);
    setInstances([]);
    setMessage('Session provider fermee.');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-lime-50 to-cyan-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Provider Console</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Interface Provider As A Service</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
            Creez vos instances, gerez vos boutiques et pilotez votre service avec un Bearer token dedie.
          </p>
          <div className="mt-4 text-xs text-slate-500">API cible: {providerApiBaseUrl()}</div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {!isAuthenticated && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => setMode('login')}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => setMode('register')}
                >
                  Inscription
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'verify' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => setMode('verify')}
                >
                  Verification email
                </button>
              </div>

              {mode === 'login' && (
                <form onSubmit={onLogin} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      required
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                    <input
                      required
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Connexion...' : 'Se connecter comme Provider'}
                  </button>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={onRegister} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Entreprise</label>
                    <input
                      required
                      value={registerForm.company}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, company: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
                    <input
                      required
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input
                      required
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Telephone</label>
                    <input
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                    <input
                      required
                      minLength={6}
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                    />
                  </div>
                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Creation...' : 'Creer mon compte Provider'}
                  </button>
                </form>
              )}

              {mode === 'verify' && (
                <form onSubmit={onVerify} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Token de verification email</label>
                    <input
                      required
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                      placeholder="Collez le token recu par email"
                    />
                  </div>
                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Verification...' : 'Verifier mon email'}
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
              <h2 className="text-lg font-bold text-slate-900">Comment ca marche</h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-600">
                <li>Inscrivez votre entreprise provider.</li>
                <li>Verifiez l'email de validation.</li>
                <li>Connectez-vous et recevez votre Bearer token.</li>
                <li>Creez vos instances sans passer par l'API principale.</li>
                <li>Gerez vos instances avec droits read/write.</li>
              </ol>

              <div className="mt-6 rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
                <div className="font-semibold text-white">Header API</div>
                <div className="mt-1 break-all">Authorization: Bearer prov_xxxxxxxxxxxxxxxxx</div>
              </div>
            </div>
          </div>
        )}

        {isAuthenticated && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-slate-500">Token</div>
                <div className="mt-2 break-all font-mono text-sm text-slate-800">{tokenPreview}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={onRefreshToken}
                    disabled={loading}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={onLogout}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Deconnexion
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-slate-500">Entreprise</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{provider?.company || '-'}</div>
                <div className="mt-1 text-xs text-slate-600">{provider?.email || '-'}</div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-slate-500">Instances</div>
                <div className="mt-2 text-sm text-slate-900">
                  {(provider?.limits?.activeInstances ?? provider?.stats?.activeInstances ?? instances.length) || 0}
                  {' / '}
                  {(provider?.limits?.instanceLimit ?? 10)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-slate-900">Creer une nouvelle instance</h2>
              <form onSubmit={onCreateInstance} className="mt-4 grid gap-4 md:grid-cols-4">
                <input
                  required
                  placeholder="Nom instance"
                  value={instanceForm.name}
                  onChange={(e) => setInstanceForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                />
                <input
                  placeholder="Subdomain (optionnel)"
                  value={instanceForm.subdomain}
                  onChange={(e) => setInstanceForm((prev) => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                />
                <select
                  value={instanceForm.currency}
                  onChange={(e) => setInstanceForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 outline-none ring-emerald-200 focus:ring"
                >
                  <option value="XAF">XAF</option>
                  <option value="XOF">XOF</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <button
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  type="submit"
                >
                  {loading ? 'Creation...' : 'Creer instance'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Mes instances</h2>
                <button
                  onClick={loadDashboard}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Rafraichir
                </button>
              </div>

              <div className="space-y-3">
                {instances.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Aucune instance pour le moment.
                  </div>
                )}

                {instances.map((inst) => (
                  <div key={inst.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{inst.name}</div>
                        <div className="text-xs text-slate-500">slug: {inst.slug || '-'} | statut: {inst.status || '-'}</div>
                        {inst.accessUrl && (
                          <a href={inst.accessUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-cyan-700 underline">
                            Ouvrir la boutique
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onStartEdit(inst)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => onDeleteInstance(inst.id)}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {editingInstance === inst.id && (
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <input
                          value={instanceForm.name}
                          onChange={(e) => setInstanceForm((prev) => ({ ...prev, name: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={instanceForm.subdomain}
                          disabled
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => onSaveEdit(inst.id)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Enregistrer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderService;
