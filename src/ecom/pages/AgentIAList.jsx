import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { getCurrentPlan } from '../services/billingApi.js';
import UpgradeWall from '../components/UpgradeWall.jsx';
import {
  AlertCircle, ArrowRight,
  Plus, Trash2, X, Zap,
  Smartphone, Sparkles, DollarSign, BarChart3, Activity, User, Crown
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function getConfigProgress(commercial) {
  let score = 0;
  if (commercial.name) score += 34;
  if (commercial.instanceId) score += 33;
  if ((commercial.productsCount || 0) > 0) score += 33;
  return score;
}

function getStatusMeta(commercial) {
  const progress = getConfigProgress(commercial);
  if ((commercial.status === 'active' || commercial.ritaEnabled) && progress === 100)
    return { label: 'Actif', color: 'emerald', dot: 'bg-emerald-500' };
  if (progress < 67)
    return { label: 'À configurer', color: 'orange', dot: 'bg-orange-400' };
  return { label: 'Inactif', color: 'gray', dot: 'bg-gray-400' };
}

// ─── HERO SECTION ──────────────────────────────────────────────────────────

function HeroSection({ onCreateClick }) {
  return (
    <div className="mb-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-scalor-green-dark via-scalor-green to-scalor-green-light p-8 sm:p-12">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 leading-tight">
            Vendez automatiquement sur WhatsApp 🚀
          </h1>
          <p className="text-lg text-white/90 mb-8 max-w-2xl leading-relaxed">
            Configurez votre commercial IA en 2 minutes et commencez à générer des ventes automatiquement.
            Les clients demandent → Rita répond → Les ventes arrivent.
          </p>

          <button
            onClick={onCreateClick}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-scalor-copper to-scalor-copper-light hover:from-scalor-copper-dark hover:to-scalor-copper text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-scalor-copper/30 hover:shadow-scalor-copper/50 hover:scale-105"
          >
            <Zap className="w-5 h-5" />
            Créer et activer mon commercial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI CARDS ─────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, loading }) {
  const colors = {
    primary: 'bg-white border-primary-500/20 text-ecom-primary',
    secondary: 'bg-white border-scalor-copper/20 text-scalor-copper',
    accent: 'bg-white border-scalor-sand/20 text-scalor-sand-dark',
  };
  const bgColors = {
    primary: 'bg-primary-50',
    secondary: 'bg-scalor-copper/5',
    accent: 'bg-scalor-sand-light/20',
  };
  return (
    <div className={`flex-1 rounded-2xl border-2 p-6 flex flex-col gap-3 transition-all hover:shadow-lg ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${bgColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-semibold text-scalor-black/70">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-scalor-black">{value}</p>
      )}
    </div>
  );
}

// ─── QUICK SETUP + COMMERCIAUX SECTION ─────────────────────────────────────

function QuickSetupAndCommerciauxSection({ commerciaux, onCreateClick, onConfigure, onDelete, deleting }) {
  const steps = [
    { num: 1, label: 'Ajouter un produit', icon: Package },
    { num: 2, label: 'Connecter WhatsApp', icon: Smartphone },
    { num: 3, label: 'Activer le commercial', icon: Zap },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Quick Setup */}
      <div className="rounded-3xl bg-gradient-to-r from-primary-100/50 to-primary-50 border-2 border-primary-300 p-8 h-fit">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-scalor-black flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6 text-scalor-copper-light" />
            Configuration rapide
          </h2>
          <p className="text-scalor-black/60 text-sm">Plus qu'une étape pour commencer à vendre 🚀</p>
        </div>

        {/* Steps visualization */}
        <div className="space-y-4 mb-8">
          {steps.map((step) => (
            <div key={step.num} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-ecom-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                {step.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-scalor-black">{step.label}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onCreateClick}
          className="w-full group py-4 px-6 bg-gradient-to-r from-ecom-primary to-primary-600 hover:from-ecom-primary-dark hover:to-primary-700 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Lancer la config
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Right: Mes commerciaux */}
      <div className="rounded-3xl bg-white border-2 border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-scalor-black">
            Mes commerciaux IA
            {commerciaux.length > 0 && (
              <span className="ml-3 text-sm bg-gray-200 text-scalor-black/70 px-3 py-1 rounded-full font-medium">
                {commerciaux.length}
              </span>
            )}
          </h2>
          {commerciaux.length > 0 && (
            <button
              onClick={onCreateClick}
              className="text-ecom-primary hover:text-ecom-primary-dark font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Nouveau</span>
            </button>
          )}
        </div>

        {commerciaux.length === 0 ? (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm text-scalor-black/60 mb-4">Aucun commercial créé</p>
            <button
              onClick={onCreateClick}
              className="text-sm text-ecom-primary hover:text-ecom-primary-dark font-bold"
            >
              Créez le vôtre
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {commerciaux.map((commercial) => {
              const progress = getConfigProgress(commercial);
              const isReady = (commercial.status === 'active' || commercial.ritaEnabled) && progress === 100;

              return (
                <div
                  key={commercial._id}
                  className="p-4 rounded-xl border-2 border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all cursor-pointer"
                  onClick={() => onConfigure(commercial)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isReady ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        <User className={`w-5 h-5 ${isReady ? 'text-ecom-primary' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-scalor-black text-sm">{commercial.name}</p>
                        <p className="text-xs text-scalor-black/50">{commercial.productsCount || 0} produits</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(commercial._id);
                      }}
                      disabled={deleting === commercial._id}
                      className="p-1.5 text-gray-300 hover:text-scalor-copper hover:bg-scalor-copper/10 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          progress === 100
                            ? 'bg-gradient-to-r from-ecom-primary to-primary-600'
                            : 'bg-gradient-to-r from-scalor-copper-light to-scalor-copper'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold ml-3 text-scalor-black/70">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function AgentIAList() {
  const navigate = useNavigate();
  const [commerciaux, setCommerciaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [kpis, setKpis] = useState({ orders: 0, revenue: 0, conversionRate: '0.0' });
  const [kpisLoading, setKpisLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState(null);
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);

  useEffect(() => {
    loadCommerciaux();
    loadTodayStats();
    loadPlan();
  }, []);

  const loadTodayStats = async () => {
    try {
      setKpisLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const res = await ecomApi.get(`/reports/stats/financial?startDate=${today}&endDate=${today}`);
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setKpis({
          orders: d.totalOrdersReceived || 0,
          revenue: Math.round(d.totalRevenue || 0),
          conversionRate: d.deliveryRate ? Number(d.deliveryRate).toFixed(1) : '0.0',
        });
      }
    } catch {
      // silently ignore
    } finally {
      setKpisLoading(false);
    }
  };

  const loadPlan = async () => {
    try {
      const data = await getCurrentPlan();
      setPlanInfo(data);
    } catch {
      // silently ignore
    }
  };

  const loadCommerciaux = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/agents');
      if (res.data.success) setCommerciaux(res.data.agents || []);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement commerciaux:', err);
      setError('Impossible de charger les commerciaux');
    } finally {
      setLoading(false);
    }
  };

  const isFreeUser = planInfo && planInfo.plan === 'free' && !planInfo.trial?.active;

  const handleCreateCommercial = () => {
    if (isFreeUser) {
      setShowUpgradeWall(true);
      return;
    }
    navigate('/ecom/agent-onboarding');
  };

  const handleDeleteCommercial = async (commercialId) => {
    if (!window.confirm('Êtes-vous sûr ? Cela supprimera le commercial et sa configuration.')) return;
    try {
      setDeleting(commercialId);
      const res = await ecomApi.delete(`/agents/${commercialId}`);
      if (res.data.success) {
        setCommerciaux(commerciaux.filter(a => a._id !== commercialId));
        setError(null);
      }
    } catch (err) {
      console.error('Erreur suppression:', err);
      setError('Impossible de supprimer le commercial');
    } finally {
      setDeleting(null);
    }
  };

  const handleConfigure = (commercial) => {
    navigate('/ecom/whatsapp/agent-config', { state: { agent: commercial } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <User className="w-8 h-8 text-ecom-primary" />
          </div>
          <p className="text-scalor-black/60 font-medium">Chargement de vos commerciaux...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Upgrade wall modal */}
      {showUpgradeWall && (
        <UpgradeWall
          onDismiss={() => setShowUpgradeWall(false)}
          workspaceId={planInfo?.workspaceId}
          trialUsed={planInfo?.trial?.used}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* PLAN BADGE */}
        {planInfo && (
          <div className="flex justify-end">
            {planInfo.plan === 'free' && !planInfo.trial?.active && (
              <button
                onClick={() => setShowUpgradeWall(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-scalor-copper/10 border border-scalor-copper/30 text-scalor-copper text-sm font-semibold rounded-xl hover:bg-scalor-copper/20 transition-colors"
              >
                <Crown className="w-4 h-4" />
                Passer Pro
              </button>
            )}
            {planInfo.trial?.active && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl">
                <Zap className="w-4 h-4" />
                Essai gratuit — expire le {new Date(planInfo.trial.endsAt).toLocaleDateString('fr-FR')}
              </div>
            )}
            {planInfo.plan === 'pro' && planInfo.isActive && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 text-ecom-primary text-sm font-semibold rounded-xl">
                <Crown className="w-4 h-4" />
                Plan Pro
              </div>
            )}
            {planInfo.plan === 'ultra' && planInfo.isActive && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-scalor-copper/10 border border-scalor-copper/30 text-scalor-copper text-sm font-semibold rounded-xl">
                <Crown className="w-4 h-4" />
                Plan Ultra
              </div>
            )}
          </div>
        )}

        {/* HERO SECTION */}
        <HeroSection onCreateClick={handleCreateCommercial} />

        {/* ERROR BANNER */}
        {error && (
          <div className="bg-ecom-danger/5 border-2 border-ecom-danger/20 rounded-2xl p-4 flex items-center justify-between text-ecom-danger text-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-ecom-danger/60 hover:text-ecom-danger">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* KPI SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            icon={Activity}
            label="Commandes aujourd'hui"
            value={kpis.orders}
            color="primary"
            loading={kpisLoading}
          />
          <KpiCard
            icon={DollarSign}
            label="Chiffre d'affaires"
            value={`${kpis.revenue.toLocaleString('fr-FR')} FCFA`}
            color="secondary"
            loading={kpisLoading}
          />
          <KpiCard
            icon={BarChart3}
            label="Taux de conversion"
            value={`${kpis.conversionRate}%`}
            color="accent"
            loading={kpisLoading}
          />
        </div>

        {/* QUICK SETUP + COMMERCIAUX */}
        <QuickSetupAndCommerciauxSection
          commerciaux={commerciaux}
          onCreateClick={handleCreateCommercial}
          onConfigure={handleConfigure}
          onDelete={handleDeleteCommercial}
          deleting={deleting}
        />

        {/* FOOTER TIP */}
        {commerciaux.length > 0 && (
          <div className="bg-primary-50 border-2 border-primary-300 rounded-2xl p-6 flex items-start gap-4">
            <Zap className="w-5 h-5 text-ecom-primary flex-shrink-0 mt-1" />
            <div className="text-sm text-scalor-green-dark">
              <p className="font-bold mb-1">💡 Besoin d'aide pour activer votre commercial ?</p>
              <p>Connectez WhatsApp, ajoutez vos produits et lancez le commercial. Vos clients recevront les messages automatiquement.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
