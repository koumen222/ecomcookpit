import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';

const IcoCash = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const IcoZap = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IcoGlobe = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IcoCard = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const IcoPhone = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;

const PROVIDERS = [
  {
    id: 'cod',
    name: 'Paiement à la livraison',
    icon: <IcoCash />,
    color: '#059669',
    desc: 'Le client paie en espèces à la réception',
    fields: [],
    popular: true,
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    icon: <IcoZap />,
    color: '#F5A623',
    desc: 'Mobile Money, Carte bancaire — Afrique',
    fields: [
      { key: 'flutterwavePublicKey', label: 'Clé publique', placeholder: 'FLWPUBK-...' },
      { key: 'flutterwaveSecretKey', label: 'Clé secrète', placeholder: 'FLWSECK-...' },
    ],
    popular: true,
  },
  {
    id: 'cinetpay',
    name: 'CinetPay',
    icon: <IcoGlobe />,
    color: '#1E3A5F',
    desc: 'Mobile Money — Afrique de l\'Ouest & Centrale',
    fields: [
      { key: 'cinetpayApiKey', label: 'API Key', placeholder: 'Votre API key CinetPay' },
      { key: 'cinetpaySiteId', label: 'Site ID', placeholder: 'Votre Site ID' },
      { key: 'cinetpaySecretKey', label: 'Secret Key', placeholder: 'Votre secret key' },
    ],
    popular: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: <IcoCard />,
    color: '#635BFF',
    desc: 'Carte bancaire internationale — Visa, Mastercard',
    fields: [
      { key: 'stripePublishableKey', label: 'Clé publiable', placeholder: 'pk_live_...' },
      { key: 'stripeSecretKey', label: 'Clé secrète', placeholder: 'sk_live_...' },
    ],
    popular: false,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Order',
    icon: <IcoPhone />,
    color: '#25D366',
    desc: 'Le client commande via WhatsApp',
    fields: [
      { key: 'whatsappNumber', label: 'Numéro WhatsApp', placeholder: '+237612345678' },
    ],
    popular: true,
  },
];

const ProviderCard = ({ provider, config, onToggle, onUpdate }) => {
  const isEnabled = config?.enabled;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isEnabled ? 'border-[#6CB198] shadow-md' : 'border-gray-200'}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: provider.color + '15', color: provider.color }}>
          {provider.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{provider.name}</p>
            {provider.popular && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full">POPULAIRE</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{provider.desc}</p>
        </div>
        <button
          onClick={() => onToggle(provider.id)}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {isEnabled && provider.fields.length > 0 && (
        <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-4">
          {provider.fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
              <input
                type={f.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                value={config?.[f.key] || ''}
                onChange={(e) => onUpdate(provider.id, f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent transition bg-gray-50 focus:bg-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BoutiquePayments = () => {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/store/payments');
        if (res.data?.data) setConfig(res.data.data);
      } catch { /* defaults */ }
    };
    load();
  }, []);

  const toggleProvider = (id) => {
    setConfig(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), enabled: !(prev[id]?.enabled) }
    }));
    setSaved(false);
  };

  const updateField = (providerId, key, value) => {
    setConfig(prev => ({
      ...prev,
      [providerId]: { ...(prev[providerId] || {}), [key]: value }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/store/payments', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paiements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configurez vos modes de paiement</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-md ${
            saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
          } disabled:opacity-60`}
        >
          {saving ? 'Enregistrement...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map(p => (
          <ProviderCard
            key={p.id}
            provider={p}
            config={config[p.id]}
            onToggle={toggleProvider}
            onUpdate={updateField}
          />
        ))}
      </div>

      {/* Security note */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-gray-700">Sécurité des données</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Vos clés API sont chiffrées et stockées de manière sécurisée. Elles ne sont jamais exposées côté client.
          </p>
        </div>
      </div>

    </div>
  );
};

export default BoutiquePayments;
