import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { storeDeliveryZonesApi } from '../services/storeApi.js';

const IcoTruck = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const IcoPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IcoTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IcoGlobe = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const IcoMapPin = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Common African countries for quick selection
const SUGGESTED_COUNTRIES = [
  'Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Gabon', 'Congo', 'RDC',
  'Mali', 'Burkina Faso', 'Guinée', 'Bénin', 'Togo', 'Niger', 'Tchad',
  'France', 'Belgique', 'Canada'
];

const BoutiqueDeliveryZones = () => {
  const { workspace } = useEcomAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // State
  const [countries, setCountries] = useState([]);
  const [zones, setZones] = useState([]);
  const [newCountry, setNewCountry] = useState('');
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const res = await storeDeliveryZonesApi.getZones();
        const data = res.data?.data || {};
        setCountries(data.countries || []);
        setZones(data.zones || []);
      } catch (err) {
        console.error('Failed to load delivery zones:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      await storeDeliveryZonesApi.saveZones({ countries, zones });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Country management
  const addCountry = (name) => {
    const trimmed = name.trim();
    if (!trimmed || countries.includes(trimmed)) return;
    setCountries(prev => [...prev, trimmed]);
    setNewCountry('');
    setShowCountrySuggestions(false);
  };

  const removeCountry = (name) => {
    setCountries(prev => prev.filter(c => c !== name));
    // Also remove zones in that country
    setZones(prev => prev.filter(z => z.country !== name));
  };

  // Zone management
  const addZone = (country) => {
    const newZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      country,
      city: '',
      aliases: [],
      cost: 0,
      enabled: true
    };
    setZones(prev => [...prev, newZone]);
  };

  const updateZone = (id, field, value) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, [field]: value } : z));
  };

  const removeZone = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
  };

  const handleAliasChange = (id, aliasText) => {
    // Split by comma, trim
    const aliases = aliasText.split(',').map(a => a.trim()).filter(Boolean);
    updateZone(id, 'aliases', aliases);
  };

  const filteredSuggestions = SUGGESTED_COUNTRIES.filter(
    c => !countries.includes(c) && c.toLowerCase().includes(newCountry.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0F6B4F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <IcoTruck /> Zones de livraison
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Définissez les pays et zones où vous livrez, avec les frais de livraison
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-[#0F6B4F] text-white rounded-xl text-sm font-semibold hover:bg-[#0d5a42] transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : null}
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Countries section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <IcoGlobe />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Pays de vente</h2>
            <p className="text-xs text-gray-500">Sélectionnez les pays où vous vendez. Si un client est hors de ces pays, il verra un message d'indisponibilité.</p>
          </div>
        </div>

        {/* Country tags */}
        <div className="flex flex-wrap gap-2">
          {countries.map(c => (
            <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
              {c}
              <button
                onClick={() => removeCountry(c)}
                className="w-4 h-4 rounded-full hover:bg-emerald-200 flex items-center justify-center transition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>

        {/* Add country */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCountry}
              onChange={(e) => { setNewCountry(e.target.value); setShowCountrySuggestions(true); }}
              onFocus={() => setShowCountrySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 200)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCountry(newCountry); } }}
              placeholder="Ajouter un pays..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
            />
            <button
              onClick={() => addCountry(newCountry)}
              disabled={!newCountry.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-30"
            >
              <IcoPlus />
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showCountrySuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-10 top-full mt-1 left-0 right-12 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredSuggestions.map(c => (
                <button
                  key={c}
                  onMouseDown={(e) => { e.preventDefault(); addCountry(c); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {countries.length === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            ⚠️ Aucun pays défini — votre boutique acceptera les commandes de tous les pays.
          </p>
        )}
      </div>

      {/* Zones per country */}
      {countries.length > 0 && countries.map(country => {
        const countryZones = zones.filter(z => z.country === country);

        return (
          <div key={country} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IcoMapPin />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Zones — {country}</h2>
                  <p className="text-xs text-gray-500">
                    Villes avec livraison. Hors zone = expédition (paiement avant envoi).
                  </p>
                </div>
              </div>
              <button
                onClick={() => addZone(country)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0F6B4F] text-white rounded-lg text-xs font-semibold hover:bg-[#0d5a42] transition"
              >
                <IcoPlus /> Ajouter une ville
              </button>
            </div>

            {countryZones.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3 text-center">
                Aucune zone définie pour {country}. Les commandes seront traitées en expédition.
              </p>
            )}

            {countryZones.map(zone => (
              <div key={zone.id} className={`border rounded-xl p-4 space-y-3 transition ${zone.enabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="text"
                      value={zone.city}
                      onChange={(e) => updateZone(zone.id, 'city', e.target.value)}
                      placeholder="Nom de la ville (ex: Douala)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={zone.cost}
                        onChange={(e) => updateZone(zone.id, 'cost', Number(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
                      />
                      <span className="text-xs text-gray-500 font-medium">FCFA</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => updateZone(zone.id, 'enabled', !zone.enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${zone.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zone.enabled ? 'translate-x-4' : ''}`} />
                    </button>
                    <button
                      onClick={() => removeZone(zone.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <IcoTrash />
                    </button>
                  </div>
                </div>

                {/* Aliases */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Variantes du nom (séparées par des virgules)
                  </label>
                  <input
                    type="text"
                    value={(zone.aliases || []).join(', ')}
                    onChange={(e) => handleAliasChange(zone.id, e.target.value)}
                    placeholder="Ex: Dla, douala, DOUALA, Doualla, doula"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Toutes les façons d'écrire cette ville. Le système fait une correspondance flexible.
                  </p>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* How it works */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Comment ça fonctionne</h3>
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
            <p><strong>Pays définis</strong> — Seuls les clients dans ces pays peuvent commander. Message d'erreur sinon.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
            <p><strong>Zone de livraison</strong> — Si la ville du client correspond à une zone, la livraison est proposée avec paiement à la réception + frais de livraison définis.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
            <p><strong>Hors zone</strong> — Si la ville n'est dans aucune zone (mais le pays est ok), l'expédition est proposée : le client doit payer avant l'envoi.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</span>
            <p><strong>Pays non couvert</strong> — Message : « Nous ne livrons pas dans ce pays. »</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoutiqueDeliveryZones;
