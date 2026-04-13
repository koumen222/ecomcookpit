import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { marketingApi } from '../services/marketingApi.js';

const fmtNum = (n) => (n || 0).toLocaleString('fr-FR');

export default function EmailAnalytics() {
  const [days, setDays] = useState(30);
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const loadCampaigns = async () => {
    try {
      const res = await marketingApi.getCampaigns({ page: 1, limit: 200 });
      setCampaigns(res.data?.data?.campaigns || []);
    } catch {
      setCampaigns([]);
    }
  };

  const loadAnalytics = async (nextDays = days, nextCampaignId = campaignId) => {
    setLoading(true);
    setError('');
    try {
      const params = { days: nextDays };
      if (nextCampaignId) params.campaignId = nextCampaignId;
      const res = await marketingApi.getDailyAnalytics(params);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les analytics email');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadAnalytics(30, '');
  }, []);

  const chartData = useMemo(() => data?.series || [], [data]);
  const totals = data?.totals || {
    targeted: 0,
    sent: 0,
    failed: 0,
    opened: 0,
    uniqueClicked: 0,
    totalClicks: 0,
    openRate: 0,
    clickRate: 0
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
            <p className="text-sm text-gray-500">Evolution journaliere des campagnes email: envoi, ouverture, clic</p>
          </div>
          <Link
            to="/ecom/marketing"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-100"
          >
            Retour marketing
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Periode</label>
            <select
              value={days}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDays(v);
                loadAnalytics(v, campaignId);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
              <option value={180}>180 jours</option>
            </select>
          </div>

          <div className="md:min-w-[280px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Campagne</label>
            <select
              value={campaignId}
              onChange={(e) => {
                const v = e.target.value;
                setCampaignId(v);
                loadAnalytics(days, v);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadAnalytics(days, campaignId)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Actualiser
          </button>
        </div>

        {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Cibles', value: fmtNum(totals.targeted), color: 'text-gray-900' },
            { label: 'Envoyes', value: fmtNum(totals.sent), color: 'text-emerald-600' },
            { label: 'Echecs', value: fmtNum(totals.failed), color: 'text-red-600' },
            { label: 'Ouverts', value: fmtNum(totals.opened), color: 'text-blue-600' },
            { label: 'Cliqueurs', value: fmtNum(totals.uniqueClicked), color: 'text-amber-600' },
            { label: 'Clics total', value: fmtNum(totals.totalClicks), color: 'text-indigo-600' },
            { label: 'Taux ouv.', value: `${totals.openRate || 0}%`, color: 'text-blue-700' },
            { label: 'Taux clic', value: `${totals.clickRate || 0}%`, color: 'text-amber-700' }
          ].map((item) => (
            <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Evolution journaliere des volumes</h2>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">Chargement...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" name="Envoyes" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" name="Echecs" stroke="#EF4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="opened" name="Ouverts" stroke="#2563EB" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="uniqueClicked" name="Cliqueurs" stroke="#D97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Taux journaliers</h2>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">Chargement...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, '']} />
                  <Legend />
                  <Bar dataKey="openRate" name="Taux ouverture" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clickRate" name="Taux clic" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
