import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { getCurrentPlan } from '../services/billingApi.js';
import UpgradeWall from '../components/UpgradeWall.jsx';
import {
  Plus, Trash2, Zap, Smartphone, Package, Settings,
  TrendingUp, DollarSign, MessageSquare, Bot,
  AlertTriangle, ArrowRight, CheckCircle, Clock, Loader2,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getSteps(agent) {
  return [
    { label: 'Nom & catégorie',  done: !!agent.name },
    { label: 'WhatsApp connecté', done: !!agent.instanceId },
    { label: 'Produits ajoutés',  done: (agent.productsCount || 0) > 0 },
    { label: 'Agent activé',      done: !!(agent.status === 'active' || agent.ritaEnabled) },
  ];
}

function getAgentStatus(agent) {
  const steps = getSteps(agent);
  const done = steps.filter(s => s.done).length;
  if (done === 4) return { label: 'Actif', color: 'emerald', bg: 'bg-emerald-500' };
  if (done >= 2)  return { label: 'En cours', color: 'amber',   bg: 'bg-amber-400' };
  return           { label: 'À configurer', color: 'gray',    bg: 'bg-gray-400' };
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, loading, accent }) {
  const accents = {
    green:  { ring: 'ring-emerald-100', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    amber:  { ring: 'ring-amber-100',   icon: 'bg-amber-100  text-amber-600',   val: 'text-amber-700' },
    blue:   { ring: 'ring-blue-100',    icon: 'bg-blue-100   text-blue-600',    val: 'text-blue-700' },
  }[accent] || { ring: 'ring-gray-100', icon: 'bg-gray-100 text-gray-500', val: 'text-gray-900' };

  return (
    <div className={`bg-white rounded-2xl p-5 ring-2 ${accents.ring} flex items-start gap-4`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accents.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        {loading
          ? <div className="h-7 w-24 bg-gray-200 rounded-lg animate-pulse" />
          : <p className={`text-2xl font-black ${accents.val} leading-none`}>{value}</p>
        }
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onConfigure, onDelete, deleting, onViewConversations, isFreePlan }) {
  const status = getAgentStatus(agent);
  const steps  = getSteps(agent);
  const doneCt = steps.filter(s => s.done).length;
  const pct    = Math.round((doneCt / steps.length) * 100);

  const statusStyles = {
    emerald: { badge: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-400 to-emerald-600', ring: 'ring-emerald-200' },
    amber:   { badge: 'bg-amber-100  text-amber-700',   bar: 'from-amber-400  to-amber-500',    ring: 'ring-amber-200' },
    gray:    { badge: 'bg-gray-100   text-gray-600',    bar: 'from-gray-300   to-gray-400',     ring: 'ring-gray-200' },
  }[status.color];

  return (
    <div
      onClick={() => !isFreePlan && onConfigure(agent)}
      className={`group relative bg-white rounded-2xl ring-2 ring-gray-100 p-5 transition-all duration-200 ${
        isFreePlan ? 'opacity-60 cursor-not-allowed' : `hover:ring-2 hover:${statusStyles.ring} cursor-pointer hover:shadow-lg`
      }`}
    >
      {/* Free plan overlay */}
      {isFreePlan && (
        <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 gap-2">
          <span className="text-2xl">🔒</span>
          <p className="text-xs font-bold text-gray-600 text-center px-4">Passez à Pro pour activer cet agent</p>
        </div>
      )}
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(agent._id); }}
        disabled={deleting === agent._id}
        className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
      >
        {deleting === agent._id
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Trash2 className="w-4 h-4" />
        }
      </button>

      {/* Top row */}
      <div className="flex items-start gap-4 mb-5 pr-8">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
          status.color === 'emerald' ? 'bg-emerald-100' : status.color === 'amber' ? 'bg-amber-100' : 'bg-gray-100'
        }`}>
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-gray-900 text-base truncate">{agent.name}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyles.badge}`}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {agent.productsCount || 0} produit{(agent.productsCount || 0) !== 1 ? 's' : ''}
            {agent.instanceId ? ' · WhatsApp connecté' : ' · WhatsApp non connecté'}
          </p>
        </div>
      </div>

      {/* Steps checklist */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
            step.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'
          }`}>
            {step.done
              ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              : <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            }
            <span className="truncate font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${statusStyles.bar} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-black text-gray-600 w-10 text-right">{pct}%</span>
      </div>

      {/* CTA */}
      <div className={`mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold ${
        status.color === 'emerald' ? 'text-emerald-600' : 'text-gray-500'
      }`}>
        <span>{pct === 100 ? 'Voir les stats' : 'Continuer la configuration'}</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>

      {/* Conversations button */}
      <button
        onClick={e => { e.stopPropagation(); onViewConversations(agent); }}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Conversations
      </button>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ onCreateClick }) {
  return (
    <div className="col-span-full bg-white rounded-2xl ring-2 ring-dashed ring-gray-200 p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
        🤖
      </div>
      <h3 className="text-lg font-black text-gray-900 mb-2">Aucun agent créé</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
        Créez votre premier commercial IA et commencez à vendre automatiquement sur WhatsApp.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200"
      >
        <Plus className="w-4 h-4" />
        Créer mon premier agent
      </button>
    </div>
  );
}

// ─── PlanBar ──────────────────────────────────────────────────────────────────
function PlanBar({ planInfo, agentCount, agentLimit, onUpgrade, onBilling }) {
  if (!planInfo) return null;

  const plan = planInfo.plan;
  const isActive = planInfo.isActive;
  const isTrial = planInfo.trial?.active && !isActive;
  const isExpired = (plan === 'pro' || plan === 'ultra') && !isActive;
  const trialDays = isTrial ? daysLeft(planInfo.trial.endsAt) : null;
  const atLimit = agentCount >= agentLimit;

  // Free plan without trial — agents are fully disabled
  if (plan === 'free' && !isTrial) {
    return (
      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-slate-700 text-sm">Agents désactivés — Plan gratuit</p>
            <p className="text-slate-500 text-xs">Passez au plan Pro pour activer vos agents commerciaux IA.</p>
          </div>
        </div>
        <button onClick={onUpgrade} className="text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition">
          Passer à Pro →
        </button>
      </div>
    );
  }

  // Paid active plan — no alert needed
  if (isActive) return null;

  if (isExpired) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">Abonnement expiré</p>
            <p className="text-red-600 text-xs">Votre plan {plan} a expiré — vous êtes sur le plan gratuit.</p>
          </div>
        </div>
        <button onClick={onBilling} className="text-xs font-bold px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition">
          Renouveler →
        </button>
      </div>
    );
  }

  if (isTrial) {
    const urgent = trialDays <= 1;
    return (
      <div className={`border-2 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${
        urgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 flex-shrink-0 ${urgent ? 'text-red-500' : 'text-blue-500'}`} />
          <div>
            <p className={`font-bold text-sm ${urgent ? 'text-red-800' : 'text-blue-800'}`}>
              Essai gratuit {urgent ? '⚠️ expire bientôt' : 'en cours'}
            </p>
            <p className={`text-xs ${urgent ? 'text-red-600' : 'text-blue-600'}`}>
              {trialDays} jour{trialDays !== 1 ? 's' : ''} restant{trialDays !== 1 ? 's' : ''} · expire le {new Date(planInfo.trial.endsAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <button onClick={onUpgrade} className="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition">
          Passer au Pro →
        </button>
      </div>
    );
  }

  if (atLimit && plan !== 'ultra') {
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Limite d'agents atteinte</p>
            <p className="text-amber-600 text-xs">
              Plan {plan === 'pro' ? 'Pro' : 'Gratuit'} : {agentLimit} agent{agentLimit > 1 ? 's' : ''} max.
              Passez à Ultra pour en créer jusqu'à 5.
            </p>
          </div>
        </div>
        <button onClick={() => onUpgrade('ultra')} className="text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition">
          Passer à Ultra →
        </button>
      </div>
    );
  }

  return null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AgentIAList() {
  const navigate = useNavigate();
  const [agents, setAgents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(null);
  const [planInfo, setPlanInfo]     = useState(null);
  const [kpis, setKpis]             = useState({ orders: 0, revenue: 0, messages: 0 });
  const [kpisLoading, setKpisLoading] = useState(false);
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);
  const [upgradeTarget, setUpgradeTarget]     = useState(null); // 'pro' | 'ultra'

  useEffect(() => {
    loadAgents();
    loadPlan();
    loadStats();
  }, []);

  async function loadAgents() {
    try {
      setLoading(true);
      const res = await ecomApi.get('/agents');
      if (res.data.success) setAgents(res.data.agents || []);
    } catch (e) {
      console.error('loadAgents:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlan() {
    try {
      const data = await getCurrentPlan();
      setPlanInfo(data);
    } catch { /* silent */ }
  }

  async function loadStats() {
    try {
      setKpisLoading(true);
      const res = await ecomApi.get('/v1/external/whatsapp/agent-dashboard-stats');
      if (res.data.success && res.data.stats) {
        const s = res.data.stats;
        setKpis({
          orders:   s.ordersToday   || 0,
          revenue:  s.revenueToday  || 0,
          messages: s.messagesToday || 0,
        });
      }
    } catch { /* silent */ }
    finally { setKpisLoading(false); }
  }

  const agentLimit   = planInfo?.limits?.agents ?? 1;
  const isPlanExpired = planInfo && !planInfo.isActive && (planInfo.plan === 'pro' || planInfo.plan === 'ultra');
  const isFreeNoTrial = planInfo?.plan === 'free' && !planInfo.trial?.active;
  const atLimit       = agents.length >= agentLimit;
  const canCreate     = !isPlanExpired && !(isFreeNoTrial && atLimit) && !atLimit;

  function handleCreate() {
    if (isFreeNoTrial) { setShowUpgradeWall(true); return; }
    if (isPlanExpired) { navigate('/ecom/billing'); return; }
    if (atLimit) { setUpgradeTarget('ultra'); setShowUpgradeWall(true); return; }
    navigate('/ecom/agent-onboarding');
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet agent et toute sa configuration ?')) return;
    try {
      setDeleting(id);
      const res = await ecomApi.delete(`/agents/${id}`);
      if (res.data.success) setAgents(prev => prev.filter(a => a._id !== id));
    } catch (e) {
      console.error('delete agent:', e);
    } finally {
      setDeleting(null);
    }
  }

  const activeAgents   = agents.filter(a => getAgentStatus(a).color === 'emerald').length;
  const pendingAgents  = agents.length - activeAgents;

  return (
    <div className="min-h-screen bg-gray-50">
      {showUpgradeWall && (
        <UpgradeWall
          onDismiss={() => { setShowUpgradeWall(false); setUpgradeTarget(null); }}
          workspaceId={planInfo?.workspaceId}
          trialUsed={planInfo?.trial?.used}
          selectedPlan={upgradeTarget}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Commerciaux IA</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez vos agents WhatsApp et suivez leurs performances</p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel agent
          </button>
        </div>

        {/* ── PLAN ALERT BAR ──────────────────────────────────────────────── */}
        <PlanBar
          planInfo={planInfo}
          agentCount={agents.length}
          agentLimit={agentLimit}
          onUpgrade={() => navigate('/ecom/billing')}
          onBilling={() => navigate('/ecom/billing')}
        />

        {/* ── STATS ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Bot}
            label="Agents actifs"
            value={loading ? '…' : `${activeAgents} / ${agents.length}`}
            sub={agents.length ? `${pendingAgents} à finaliser` : 'Aucun agent'}
            accent="green"
          />
          <StatCard
            icon={DollarSign}
            label="CA aujourd'hui"
            value={kpisLoading ? '…' : `${kpis.revenue.toLocaleString('fr-FR')} F`}
            accent="amber"
            loading={kpisLoading}
          />
          <StatCard
            icon={TrendingUp}
            label="Commandes"
            value={kpis.orders}
            sub="Aujourd'hui"
            accent="blue"
            loading={kpisLoading}
          />
          <StatCard
            icon={MessageSquare}
            label="Messages traités"
            value={kpisLoading ? '…' : kpis.messages}
            sub="Aujourd'hui"
            loading={kpisLoading}
          />
        </div>

        {/* ── AGENTS GRID ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-900">
              Mes agents
              {agents.length > 0 && (
                <span className="ml-2 text-sm font-semibold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  {agents.length}/{agentLimit}
                </span>
              )}
            </h2>
            {agents.length > 0 && (
              <button
                onClick={handleCreate}
                disabled={atLimit || isPlanExpired}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl ring-2 ring-gray-100 p-5 animate-pulse">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {[1,2,3,4].map(j => <div key={j} className="h-7 bg-gray-100 rounded-lg" />)}
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.length === 0
                ? <EmptyState onCreateClick={handleCreate} />
                : agents.map(agent => (
                    <AgentCard
                      key={agent._id}
                      agent={agent}
                      onConfigure={a => navigate('/ecom/whatsapp/agent-config', { state: { agent: a } })}
                      onDelete={handleDelete}
                      deleting={deleting}
                      onViewConversations={a => navigate(`/ecom/whatsapp/conversations/${a._id}`)}
                      isFreePlan={isFreeNoTrial}
                    />
                  ))
              }
            </div>
          )}
        </div>

        {/* ── ONBOARDING GUIDE (si aucun agent actif) ─────────────────────── */}
        {!loading && agents.length > 0 && activeAgents === 0 && (
          <div className="bg-white rounded-2xl ring-2 ring-emerald-100 p-6 sm:p-8">
            <h3 className="font-black text-gray-900 mb-1">3 étapes pour commencer à vendre</h3>
            <p className="text-gray-500 text-sm mb-6">Suivez ces étapes pour activer votre commercial IA</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Package,    num: 1, title: 'Ajoutez vos produits', desc: 'Importez votre catalogue ou ajoutez-les manuellement dans la config.' },
                { icon: Smartphone, num: 2, title: 'Connectez WhatsApp',   desc: 'Scannez le QR code pour lier votre numéro WhatsApp à l\'agent.' },
                { icon: Zap,        num: 3, title: 'Activez l\'agent',     desc: 'Basculez le switch ON et votre commercial répond automatiquement.' },
              ].map(step => (
                <div key={step.num} className="flex gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-black text-lg flex-shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-1">{step.title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
