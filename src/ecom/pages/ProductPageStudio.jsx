import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ArrowRight,
  RotateCw,
  Layers3,
} from 'lucide-react';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

export default function ProductPageStudio() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [creditsInfo, setCreditsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('ecomToken');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      const workspaceId = workspace?._id || workspace?.id || '';
      if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    } catch {}
    return headers;
  }, []);

  const fetchTasks = useCallback(async () => {
    const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks`, { headers: getHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (data.success) setTasks(data.tasks || []);
  }, [getHeaders]);

  const fetchCredits = useCallback(async () => {
    const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, { headers: getHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (data.success) setCreditsInfo(data.generations || null);
  }, [getHeaders]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchCredits()]).finally(() => setLoading(false));
  }, [fetchCredits, fetchTasks]);

  useEffect(() => {
    const hasActiveTask = tasks.some((task) => !['done', 'error'].includes(task.status));
    if (!hasActiveTask) return undefined;
    const interval = window.setInterval(fetchTasks, 8000);
    return () => window.clearInterval(interval);
  }, [tasks, fetchTasks]);

  const stats = useMemo(() => {
    const active = tasks.filter((task) => !['done', 'error'].includes(task.status));
    const done = tasks.filter((task) => task.status === 'done');
    const recoverable = tasks.filter((task) => task.status === 'error' && task.product);
    const errors = tasks.filter((task) => task.status === 'error');
    return {
      active,
      done,
      recoverable,
      errors,
    };
  }, [tasks]);

  const handleOpenTask = useCallback((taskId) => {
    navigate('/ecom/boutique/products/generator', {
      state: { loadTaskId: taskId, from: '/ecom/boutique/product-page-studio' },
    });
  }, [navigate]);

  const handleRetry = async (taskId) => {
    setRetrying(taskId);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Impossible de reprendre cette generation');
      }
      await fetchTasks();
    } catch (error) {
      window.alert(error.message || 'Erreur lors de la reprise');
    } finally {
      setRetrying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
            <Layers3 className="w-3.5 h-3.5" />
            Product Page Studio
          </div>
          <h1 className="mt-3 text-3xl font-black text-gray-900">Studio de generation pages produits</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-3xl">
            Suis toutes les generations, retrouve les echec partiels, reprends ce qui manque et ouvre directement les pages deja sauvegardees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => Promise.all([fetchTasks(), fetchCredits()])}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraichir
          </button>
          <button
            onClick={() => navigate('/ecom/boutique/products/generator', { state: { from: '/ecom/boutique/product-page-studio' } })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
          >
            <Sparkles className="w-4 h-4" />
            Nouvelle generation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardCard label="En cours" value={stats.active.length} hint="Generations qui tournent" color="blue" icon={<Clock3 className="w-4 h-4" />} />
        <DashboardCard label="Pretes" value={stats.done.length} hint="Pages utilisables" color="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
        <DashboardCard label="Reprise" value={stats.recoverable.length} hint="Echecs avec contenu sauve" color="amber" icon={<RotateCw className="w-4 h-4" />} />
        <DashboardCard label="Credits" value={creditsInfo?.remaining ?? 0} hint={creditsInfo ? `${creditsInfo.totalUsed || 0} utilise(s)` : 'Credits restants'} color="slate" icon={<Wand2 className="w-4 h-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <QuickLinkCard
          title="Toutes les generations"
          description="Liste complete avec filtres, ouverture et suppression."
          action="Voir la liste"
          onClick={() => navigate('/ecom/boutique/product-page-studio/generations')}
        />
        <QuickLinkCard
          title="Echecs et reprise"
          description="Accede directement aux contenus partiels et relance les visuels manquants."
          action="Ouvrir"
          onClick={() => navigate('/ecom/boutique/product-page-studio/errors')}
        />
        <QuickLinkCard
          title="Nouvelle generation"
          description="Lance une nouvelle page produit dans le generateur plein ecran."
          action="Generer"
          onClick={() => navigate('/ecom/boutique/products/generator', { state: { from: '/ecom/boutique/product-page-studio' } })}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <StudioPanel
          title="En cours"
          icon={<Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          items={stats.active.slice(0, 4)}
          emptyText="Aucune generation active pour le moment."
          actionLabel="Voir tout"
          onAction={() => navigate('/ecom/boutique/product-page-studio/generations')}
          renderActions={(task) => (
            <button
              type="button"
              onClick={() => handleOpenTask(task._id)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              Suivre
            </button>
          )}
        />

        <StudioPanel
          title="Pages pretes"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          items={stats.done.slice(0, 4)}
          emptyText="Aucune page prete pour l'instant."
          actionLabel="Voir tout"
          onAction={() => navigate('/ecom/boutique/product-page-studio/generations')}
          renderActions={(task) => (
            <button
              type="button"
              onClick={() => handleOpenTask(task._id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Utiliser
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        />

        <StudioPanel
          title="Echecs recuperables"
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          items={stats.recoverable.slice(0, 4)}
          emptyText="Aucun echec recuperable detecte."
          actionLabel="Voir tout"
          onAction={() => navigate('/ecom/boutique/product-page-studio/errors')}
          renderActions={(task) => (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenTask(task._id)}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Ouvrir
              </button>
              <button
                type="button"
                onClick={() => handleRetry(task._id)}
                disabled={retrying === task._id}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-60"
              >
                {retrying === task._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                Reprendre
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function DashboardCard({ label, value, hint, color, icon }) {
  const colorClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[color] || 'bg-gray-50 text-gray-700 border-gray-100';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${colorClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({ title, description, action, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm hover:border-gray-300 transition"
    >
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
        {action}
        <ArrowRight className="w-4 h-4" />
      </span>
    </button>
  );
}

function StudioPanel({ title, icon, items, emptyText, actionLabel, onAction, renderActions }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        </div>
        <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          {actionLabel}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">{emptyText}</div>
        ) : (
          items.map((task) => (
            <div key={task._id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{task.productName || task.product?.title || 'Generation sans nom'}</p>
                <p className="mt-1 text-xs text-gray-500">{task.currentStep || 'Pret'} · {new Date(task.updatedAt || task.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="shrink-0">{renderActions(task)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}