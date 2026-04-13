import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Trash2, Eye, ArrowRight, Loader2, AlertCircle, Clock, CheckCircle, XCircle, RefreshCw, Plus } from 'lucide-react';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  generating_text: { label: 'Texte en cours', color: 'bg-blue-100 text-blue-700', icon: Loader2, animate: true },
  generating_images: { label: 'Images en cours', color: 'bg-purple-100 text-purple-700', icon: Loader2, animate: true },
  done: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  error: { label: 'Erreur', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function GenerationsPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [creditsInfo, setCreditsInfo] = useState(null);

  const token = localStorage.getItem('ecomToken');
  const wsId = localStorage.getItem('workspaceId');

  const fetchTasks = useCallback(async () => {
    if (!token || !wsId) return;
    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': wsId },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success) setTasks(data.tasks || []);
    } catch {}
  }, [token, wsId]);

  const fetchCredits = useCallback(async () => {
    if (!token || !wsId) return;
    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': wsId },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success) setCreditsInfo(data.generations);
    } catch {}
  }, [token, wsId]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchCredits()]).finally(() => setLoading(false));
  }, [fetchTasks, fetchCredits]);

  // Poll active tasks every 8s
  useEffect(() => {
    const hasActive = tasks.some(t => !['done', 'error'].includes(t.status));
    if (!hasActive) return;
    const interval = setInterval(fetchTasks, 8000);
    return () => clearInterval(interval);
  }, [tasks, fetchTasks]);

  const handleDelete = async (taskId) => {
    if (!confirm('Supprimer cette génération ?')) return;
    setDeleting(taskId);
    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Workspace-Id': wsId },
      });
      if (resp.ok) {
        setTasks(prev => prev.filter(t => t._id !== taskId));
      }
    } catch {} finally {
      setDeleting(null);
    }
  };

  const handleApply = (taskId) => {
    // Navigate to the generator wizard which will load this task
    navigate('/ecom/boutique/products/generator', { state: { loadTaskId: taskId } });
  };

  const handleView = (taskId) => {
    navigate('/ecom/boutique/products/generator', { state: { loadTaskId: taskId } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const activeTasks = tasks.filter(t => !['done', 'error'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'done');
  const errorTasks = tasks.filter(t => t.status === 'error');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes Générations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {creditsInfo ? `${creditsInfo.remaining} crédit${creditsInfo.remaining !== 1 ? 's' : ''} restant${creditsInfo.remaining !== 1 ? 's' : ''}` : 'Chargement...'}
            {creditsInfo?.totalUsed ? ` · ${creditsInfo.totalUsed} génération${creditsInfo.totalUsed !== 1 ? 's' : ''} utilisée${creditsInfo.totalUsed !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/ecom/boutique/products/generator')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle génération
          </button>
        </div>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            En cours ({activeTasks.length})
          </h2>
          <div className="space-y-3">
            {activeTasks.map(task => (
              <TaskCard key={task._id} task={task} onDelete={handleDelete} onView={handleView} deleting={deleting} />
            ))}
          </div>
        </section>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Terminées ({completedTasks.length})
          </h2>
          <div className="space-y-3">
            {completedTasks.map(task => (
              <TaskCard key={task._id} task={task} onDelete={handleDelete} onApply={handleApply} onView={handleView} deleting={deleting} />
            ))}
          </div>
        </section>
      )}

      {/* Error tasks */}
      {errorTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            Échouées ({errorTasks.length})
          </h2>
          <div className="space-y-3">
            {errorTasks.map(task => (
              <TaskCard key={task._id} task={task} onDelete={handleDelete} deleting={deleting} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Aucune génération</h3>
          <p className="text-sm text-gray-500 mb-6">Créez votre première page produit avec l'IA</p>
          <button
            onClick={() => navigate('/ecom/boutique/products/generator')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Générer une page produit
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onDelete, onApply, onView, deleting }) {
  const cfg = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const isActive = !['done', 'error'].includes(task.status);
  const isDone = task.status === 'done';
  const isError = task.status === 'error';

  // Try to get a thumbnail from the task's product images
  const thumbnail = task.product?.heroImage || task.images?.heroImage || null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-6 h-6 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {task.productName || 'Génération sans nom'}
            </h3>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
              <StatusIcon className={`w-3 h-3 ${cfg.animate ? 'animate-spin' : ''}`} />
              {cfg.label}
            </span>
          </div>

          {/* Progress bar for active tasks */}
          {isActive && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span>{task.currentStep || 'En cours...'}</span>
                <span>{task.progressPercent || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${task.progressPercent || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {isError && task.errorMessage && (
            <p className="text-xs text-red-600 flex items-center gap-1 mb-1">
              <AlertCircle className="w-3 h-3" />
              {task.errorMessage}
            </p>
          )}

          {/* Date */}
          <p className="text-[11px] text-gray-400">
            {new Date(task.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isDone && onView && (
            <button
              onClick={() => onView(task._id)}
              className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
              title="Voir / Appliquer"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {isDone && onApply && (
            <button
              onClick={() => onApply(task._id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
              title="Utiliser comme page produit"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Appliquer
            </button>
          )}
          <button
            onClick={() => onDelete(task._id)}
            disabled={deleting === task._id}
            className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Supprimer"
          >
            {deleting === task._id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
