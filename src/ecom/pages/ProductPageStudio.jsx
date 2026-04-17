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
  Eye,
  Trash2,
  AlertCircle,
  XCircle,
  Zap,
  ShieldCheck,
} from 'lucide-react';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock3 },
  generating_text: { label: 'Texte en cours', color: 'bg-blue-100 text-blue-700', icon: Loader2, animate: true },
  generating_images: { label: 'Images en cours', color: 'bg-violet-100 text-violet-700', icon: Loader2, animate: true },
  done: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  error: { label: 'Échec partiel', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function formatTaskDate(value) {
  if (!value) return 'Date inconnue';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTaskThumbnail(task) {
  return task.product?.heroImage
    || task.images?.heroImage
    || task.product?.heroPosterImage
    || task.images?.heroPosterImage
    || task.product?.realPhotos?.[0]
    || null;
}

export default function ProductPageStudio() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [creditsInfo, setCreditsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

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
    const headers = getHeaders();
    if (!headers.Authorization || headers.Authorization === 'Bearer null') return;
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setTasks(data.tasks || []);
    } catch (error) {
      console.error('[ProductPageStudio] tasks error:', error);
    }
  }, [getHeaders]);

  const fetchCredits = useCallback(async () => {
    const headers = getHeaders();
    if (!headers.Authorization || headers.Authorization === 'Bearer null') return;
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setCreditsInfo(data.generations || null);
    } catch (error) {
      console.error('[ProductPageStudio] credits error:', error);
    }
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

  const filters = useMemo(() => ([
    { id: 'all', label: 'Tout', count: tasks.length },
    { id: 'active', label: 'En cours', count: stats.active.length },
    { id: 'done', label: 'Prêtes', count: stats.done.length },
    { id: 'recoverable', label: 'Reprise', count: stats.recoverable.length },
    { id: 'error', label: 'Échecs', count: stats.errors.length },
  ]), [stats.active.length, stats.done.length, stats.errors.length, stats.recoverable.length, tasks.length]);

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'active':
        return stats.active;
      case 'done':
        return stats.done;
      case 'recoverable':
        return stats.recoverable;
      case 'error':
        return stats.errors;
      default:
        return tasks;
    }
  }, [activeFilter, stats.active, stats.done, stats.errors, stats.recoverable, tasks]);

  const handleOpenTask = useCallback((taskId) => {
    navigate('/ecom/boutique/products/generator', {
      state: { loadTaskId: taskId, from: '/ecom/boutique/product-page-studio' },
    });
  }, [navigate]);

  const handleDelete = async (taskId) => {
    if (!window.confirm('Supprimer cette génération ?')) return;
    setDeleting(taskId);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.ok) {
        setTasks((current) => current.filter((task) => task._id !== taskId));
      }
    } finally {
      setDeleting(null);
    }
  };

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
      setActiveFilter('active');
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">Etat des credits</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <CreditBlock
              label="Restants"
              value={creditsInfo?.remaining ?? 0}
              tone="emerald"
              hint="credits disponibles"
            />
            <CreditBlock
              label="Gratuits"
              value={creditsInfo?.freeRemaining ?? 0}
              tone="blue"
              hint="credits offerts"
            />
            <CreditBlock
              label="Payants"
              value={creditsInfo?.paidRemaining ?? 0}
              tone="violet"
              hint="credits achetes"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5">
              <Wand2 className="w-3.5 h-3.5 text-gray-600" />
              {creditsInfo?.totalUsed ?? 0} génération(s) utilisée(s)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
              {tasks.length} tâche(s) historisées
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-gray-900">Lecture rapide</h2>
          </div>

          <div className="space-y-3">
            <InsightRow
              label="Générations actives"
              value={`${stats.active.length}`}
              hint={stats.active.length > 0 ? 'Une mise à jour auto tourne toutes les 8 secondes.' : 'Aucun traitement en cours.'}
            />
            <InsightRow
              label="Pages prêtes"
              value={`${stats.done.length}`}
              hint={stats.done.length > 0 ? 'Ouvrables directement depuis la liste complète.' : 'Aucune page finalisée pour le moment.'}
            />
            <InsightRow
              label="Échecs récupérables"
              value={`${stats.recoverable.length}`}
              hint={stats.recoverable.length > 0 ? 'Le contenu sauvegardé peut être rouvert ou repris.' : 'Aucune reprise requise.'}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">Toutes les informations des générations</h2>
            <p className="text-sm text-gray-500 mt-1">
              Filtre, ouvre, reprends ou supprime une génération sans quitter la vue studio.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            {filteredTasks.length} élément(s) affiché(s)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <Sparkles className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Aucune donnée pour ce filtre</h3>
            <p className="mt-1 text-sm text-gray-500">Change de filtre ou lance une nouvelle génération.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskDetailCard
                key={task._id}
                task={task}
                deleting={deleting}
                retrying={retrying}
                onDelete={handleDelete}
                onOpen={handleOpenTask}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
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

function CreditBlock({ label, value, hint, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || 'bg-gray-50 border-gray-100 text-gray-700'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs opacity-80">{hint}</p>
    </div>
  );
}

function InsightRow({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <span className="text-lg font-black text-gray-900">{value}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function TaskDetailCard({ task, deleting, retrying, onDelete, onOpen, onRetry }) {
  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const isActive = !['done', 'error'].includes(task.status);
  const isDone = task.status === 'done';
  const isError = task.status === 'error';
  const hasSavedContent = Boolean(task.product);
  const thumbnail = getTaskThumbnail(task);

  return (
    <div className="rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="Apercu generation" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-6 h-6 text-gray-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate max-w-full">
              {task.productName || task.product?.title || 'Generation sans nom'}
            </h3>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}>
              <StatusIcon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
              {config.label}
            </span>
            {isError && hasSavedContent && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="w-3 h-3" />
                Contenu sauvé
              </span>
            )}
          </div>

          {isActive && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                <span>{task.currentStep || 'En cours...'}</span>
                <span>{task.progressPercent || 0}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${task.progressPercent || 0}%` }}
                />
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-1">
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {task.errorMessage || 'La génération s’est arrêtée avant la fin.'}
              </p>
              {hasSavedContent && (
                <p className="text-xs text-gray-500">
                  Le texte et les éléments déjà générés restent disponibles. Tu peux rouvrir le contenu ou relancer la suite.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
            <span>Créée le {formatTaskDate(task.createdAt)}</span>
            <span>Mise à jour {formatTaskDate(task.updatedAt || task.createdAt)}</span>
            <span>{task.currentStep || (isDone ? 'Prête' : isError ? 'Interrompue' : 'En cours')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
          {hasSavedContent && (
            <button
              onClick={() => onOpen(task._id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold rounded-xl transition"
              title="Ouvrir le contenu généré"
            >
              <Eye className="w-3.5 h-3.5" />
              Voir contenu
            </button>
          )}

          {isDone && (
            <button
              onClick={() => onOpen(task._id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
              title="Utiliser cette génération"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Utiliser
            </button>
          )}

          {isError && (
            <button
              onClick={() => onRetry(task._id)}
              disabled={retrying === task._id}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition"
              title="Reprendre cette génération"
            >
              {retrying === task._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              Reprendre
            </button>
          )}

          <button
            onClick={() => onDelete(task._id)}
            disabled={deleting === task._id}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold rounded-xl transition"
            title="Supprimer"
          >
            {deleting === task._id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}