import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { useMoney } from '../hooks/useMoney.js';
import { ArrowLeft, CalendarDays, Truck, AlertCircle } from 'lucide-react';
import { getContextualError } from '../utils/errorMessages';

const ReportsInsightsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fmt } = useMoney();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reports, setReports] = useState([]);

  const activeTab = new URLSearchParams(location.search).get('tab') === 'agencies' ? 'agencies' : 'days';

  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await ecomApi.get('/reports', { params: { limit: 1000 } });
      setReports(res.data?.data?.reports || []);
    } catch (e) {
      setError(getContextualError(e, 'load_stats'));
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const getReportProfit = (report) => {
    if ((report.profit || 0) !== 0) return report.profit || 0;
    const revenue = report.revenue || 0;
    const cost = report.cost || 0;
    if (revenue !== 0 || cost !== 0) return revenue - cost;
    return -(report.adSpend || 0);
  };

  const topProfitDays = useMemo(() => {
    const dayProfitMap = reports.reduce((acc, report) => {
      const dateKey = new Date(report.date).toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, profit: 0, reports: 0, delivered: 0, revenue: 0 };
      }
      acc[dateKey].profit += getReportProfit(report);
      acc[dateKey].reports += 1;
      acc[dateKey].delivered += report.ordersDelivered || 0;
      acc[dateKey].revenue += report.revenue || 0;
      return acc;
    }, {});

    return Object.values(dayProfitMap).sort((a, b) => b.profit - a.profit);
  }, [reports]);

  const topAgencies = useMemo(() => {
    const agencyMap = reports.reduce((acc, report) => {
      (report.deliveries || []).forEach((delivery) => {
        const agencyName = (delivery.agencyName || '').trim();
        if (!agencyName) return;

        if (!acc[agencyName]) {
          acc[agencyName] = {
            agencyName,
            ordersDelivered: 0,
            deliveryCost: 0,
            reportsCount: 0
          };
        }

        acc[agencyName].ordersDelivered += delivery.ordersDelivered || 0;
        acc[agencyName].deliveryCost += delivery.deliveryCost || 0;
        acc[agencyName].reportsCount += 1;
      });
      return acc;
    }, {});

    return Object.values(agencyMap)
      .map((agency) => {
        const avgCostPerDelivery = agency.ordersDelivered > 0
          ? agency.deliveryCost / agency.ordersDelivered
          : 0;
        const efficiencyScore = avgCostPerDelivery > 0
          ? agency.ordersDelivered / avgCostPerDelivery
          : agency.ordersDelivered;

        return {
          ...agency,
          avgCostPerDelivery,
          efficiencyScore
        };
      })
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }, [reports]);

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-500" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ecom/reports')}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition border border-gray-200 shadow-sm"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📈 Insights mensuels</h3>
            <p className="text-sm text-gray-500">Classement détaillé des jours rentables et des agences</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Link
          to="/ecom/reports/insights?tab=days"
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'days' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          Jours rentables
        </Link>
        <Link
          to="/ecom/reports/insights?tab=agencies"
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'agencies' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          Agences efficaces
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : activeTab === 'days' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <CalendarDays size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-700">Tous les jours classés par rentabilité</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {topProfitDays.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">Aucune donnée disponible</p>
            ) : (
              topProfitDays.map((day, idx) => (
                <div key={day.date} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{idx + 1} {new Date(day.date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-gray-500">{day.delivered} livrées • {day.reports} rapport{day.reports > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${day.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(day.profit)}</p>
                    <p className="text-xs text-gray-500">CA: {fmt(day.revenue || 0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Truck size={16} className="text-emerald-700" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">🔍 Recommandations</h3>
            <h2 className="text-sm font-semibold text-gray-700"> les agences classées par efficacité</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {topAgencies.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">Aucune donnée d'agence disponible</p>
            ) : (
              topAgencies.map((agency, idx) => (
                <div key={agency.agencyName} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{idx + 1} {agency.agencyName}</p>
                    <p className="text-xs text-gray-500">{agency.ordersDelivered} livrées • {agency.reportsCount} rapport{agency.reportsCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-700">{fmt(agency.avgCostPerDelivery)}</p>
                    <p className="text-xs text-gray-500">Coût moyen / livraison</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsInsightsPage;
