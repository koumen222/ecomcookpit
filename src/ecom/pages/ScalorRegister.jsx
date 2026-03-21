import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { scalorRegister } from '../services/scalorApi';

export default function ScalorRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', phone: '' });
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await scalorRegister(form);
      setApiKey(data.apiKey);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show API key screen after successful registration
  if (apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔑</div>
            <h2 className="text-2xl font-bold text-white">Votre clé API</h2>
            <p className="text-yellow-400 text-sm mt-2">⚠️ Sauvegardez cette clé maintenant. Elle ne sera plus affichée.</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 break-all mb-4">
            {apiKey}
          </div>

          <button
            onClick={copyKey}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors mb-4"
          >
            {copied ? '✅ Copié !' : '📋 Copier la clé'}
          </button>

          <button
            onClick={() => navigate('/scalor/dashboard')}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            Accéder au Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            <span className="text-green-400">Scalor</span> API
          </h1>
          <p className="text-gray-400 mt-2">Créez votre compte développeur</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-6">Inscription</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom complet *</label>
              <input
                type="text" name="name" required
                value={form.name} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="Jean Dupont"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input
                type="email" name="email" required
                value={form.email} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Mot de passe * (min. 8 chars)</label>
              <input
                type="password" name="password" required minLength={8}
                value={form.password} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Entreprise</label>
              <input
                type="text" name="company"
                value={form.company} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="Ma Société"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Téléphone</label>
              <input
                type="tel" name="phone"
                value={form.phone} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="+237 6XX XXX XXX"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Déjà un compte ?{' '}
            <Link to="/scalor/login" className="text-green-400 hover:text-green-300">
              Se connecter
            </Link>
          </p>
        </div>

        {/* Plans overview */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            { name: 'Starter', price: 'Gratuit', features: '1 instance • 500 msg/jour' },
            { name: 'Pro', price: '29€/mois', features: '5 instances • 5K msg/jour' },
            { name: 'Business', price: '99€/mois', features: '20 instances • 50K msg/jour' },
            { name: 'Enterprise', price: 'Sur devis', features: 'Illimité' },
          ].map(plan => (
            <div key={plan.name} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center">
              <div className="text-green-400 font-semibold text-sm">{plan.name}</div>
              <div className="text-white font-bold">{plan.price}</div>
              <div className="text-gray-500 text-xs mt-1">{plan.features}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
