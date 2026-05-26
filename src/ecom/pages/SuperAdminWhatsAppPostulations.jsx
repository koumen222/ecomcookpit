import React, { useState, useEffect, useCallback } from 'react';
import { getContextualError } from '../utils/errorMessages';
import {
    MessageSquare, Phone, Building2, User, Clock, CheckCircle2,
    XCircle, AlertCircle, RefreshCcw, ChevronDown, ChevronUp, Search,
    Shield, Smartphone, Filter, Users
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell';

const STATUS_CONFIG = {
    pending: {
        label: 'En attente',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        ring: 'ring-amber-500/20',
        icon: Clock,
        dot: 'bg-amber-500'
    },
    active: {
        label: 'Approuvée',
        bg: 'bg-primary-50',
        text: 'text-primary-700',
        ring: 'ring-primary-500/20',
        icon: CheckCircle2,
        dot: 'bg-primary-500'
    },
    rejected: {
        label: 'Rejetée',
        bg: 'bg-red-50',
        text: 'text-red-700',
        ring: 'ring-red-500/20',
        icon: XCircle,
        dot: 'bg-red-500'
    }
};

const BUSINESS_TYPE_LABELS = {
    ecommerce: 'E-commerce',
    services: 'Services',
    restaurant: 'Restaurant/Café',
    beauty: 'Beauté/Bien-être',
    education: 'Éducation/Formation',
    other: 'Autre'
};

const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
}) : '—';

const fmtPhone = p => {
    if (!p) return '—';
    if (p.length === 12) return `+${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
    return p;
};

const SuperAdminWhatsAppPostulations = () => {
    const [postulations, setPostulations] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [flash, setFlash] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [noteInput, setNoteInput] = useState({});

    const fetchPostulations = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (filterStatus !== 'all') params.status = filterStatus;
            const res = await ecomApi.get('/super-admin/whatsapp-postulations', { params });
            setPostulations(res.data.data.postulations || []);
            setStats(res.data.data.stats || { total: 0, pending: 0, active: 0, rejected: 0 });
        } catch (err) {
            setError(getContextualError(err, 'load_stats'));
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchPostulations(); }, [fetchPostulations]);

    const showFlash = (message, type = 'ok') => {
        setFlash({ message, type });
        setTimeout(() => setFlash(null), 4000);
    };

    const handleAction = async (id, status) => {
        setActionLoading(id);
        try {
            const note = noteInput[id] || '';
            const res = await ecomApi.put(`/super-admin/whatsapp-postulations/${id}`, { status, note });
            showFlash(res.data.message, status === 'active' ? 'ok' : status === 'rejected' ? 'error' : 'info');
            fetchPostulations();
        } catch (err) {
            showFlash(err.response?.data?.message || 'Erreur', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = postulations.filter(p => {
        if (filterStatus !== 'all' && p.status !== filterStatus) return false;
        if (search) {
            const s = search.toLowerCase();
            return (
                (p.businessName || '').toLowerCase().includes(s) ||
                (p.contactName || '').toLowerCase().includes(s) ||
                (p.email || '').toLowerCase().includes(s) ||
                (p.phoneNumber || '').includes(s) ||
                (p.workspaceName || '').toLowerCase().includes(s)
            );
        }
        return true;
    });

    return (
        <SuperAdminShell
            title="Postulations WhatsApp"
            subtitle="Gérez les demandes d'activation de numéro WhatsApp personnel"
            icon={Users}
            error={error}
            refreshing={loading}
            onRefresh={fetchPostulations}
        >
            {/* Flash toast */}
            {flash && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${
                    flash.type === 'ok' ? 'bg-primary-500 text-white' :
                    flash.type === 'error' ? 'bg-red-500 text-white' :
                    'bg-amber-500 text-white'
                }`}>
                    {flash.message}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: stats.total, icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100' },
                    { label: 'En attente', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Approuvées', value: stats.active, icon: CheckCircle2, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Rejetées', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                            <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                            <p className="text-xs text-slate-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, email, téléphone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-slate-400" />
                    {['all', 'pending', 'active', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                filterStatus === s
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {s === 'all' ? 'Tout' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-semibold">Aucune postulation trouvée</p>
                    <p className="text-sm text-slate-400 mt-1">Les demandes d'activation WhatsApp apparaîtront ici</p>
                </div>
            )}

            {/* Postulations list */}
            {!loading && filtered.length > 0 && (
                <div className="space-y-3">
                    {filtered.map(p => {
                        const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                        const StatusIcon = statusCfg.icon;
                        const isExpanded = expandedId === p._id;

                        return (
                            <div
                                key={p._id}
                                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200 ${
                                    isExpanded
                                        ? 'border-primary-300 shadow-md'
                                        : 'border-slate-200 hover:border-slate-300 hover:shadow'
                                }`}
                            >
                                {/* Header row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : p._id)}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                                >
                                    {/* WhatsApp icon */}
                                    <div className="w-11 h-11 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <h3 className="font-semibold text-slate-900 truncate">{p.businessName || p.workspaceName}</h3>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.ring}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> {fmtPhone(p.phoneNumber)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" /> {p.contactName || '—'}
                                            </span>
                                            <span className="flex items-center gap-1 hidden sm:flex">
                                                <Clock className="w-3 h-3" /> {fmtDate(p.requestedAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expand toggle */}
                                    <div className="flex-shrink-0 text-slate-400">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/50">
                                        {/* Info cards grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {/* Entreprise */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    <Building2 className="w-3.5 h-3.5" /> Entreprise
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-slate-400">Nom</p>
                                                        <p className="text-sm text-slate-800 font-medium">{p.businessName || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Type d'activité</p>
                                                        <p className="text-sm text-slate-700">{BUSINESS_TYPE_LABELS[p.businessType] || p.businessType || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Workspace</p>
                                                        <p className="text-sm text-primary-600 font-medium">{p.workspaceName}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Contact */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    <User className="w-3.5 h-3.5" /> Contact
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-slate-400">Nom complet</p>
                                                        <p className="text-sm text-slate-800 font-medium">{p.contactName || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Email</p>
                                                        <p className="text-sm text-slate-700">{p.email || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Demandé par</p>
                                                        <p className="text-sm text-slate-700">{p.requestedBy?.name || p.requestedBy?.email || '—'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* WhatsApp */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                    <Smartphone className="w-3.5 h-3.5" /> WhatsApp
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-slate-400">Numero à configurer</p>
                                                        <p className="text-sm text-primary-600 font-mono font-medium">{fmtPhone(p.phoneNumber)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Numéro actuel</p>
                                                        <p className="text-sm text-slate-700 font-mono">{p.currentWhatsappNumber || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400">Volume mensuel</p>
                                                        <p className="text-sm text-slate-700">{p.monthlyMessages || '—'} messages</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Motivation */}
                                        {p.reason && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                                    <MessageSquare className="w-3.5 h-3.5" /> Motivation
                                                </div>
                                                <p className="text-sm text-slate-700 leading-relaxed">{p.reason}</p>
                                            </div>
                                        )}

                                        {/* Timeline */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                <Clock className="w-3.5 h-3.5" /> Chronologie
                                            </div>
                                            <div className="flex items-center gap-6 text-sm flex-wrap">
                                                <div>
                                                    <p className="text-xs text-slate-400">Demandé le</p>
                                                    <p className="text-slate-800">{fmtDate(p.requestedAt)}</p>
                                                </div>
                                                {p.activatedAt && (
                                                    <div>
                                                        <p className="text-xs text-slate-400">Activé le</p>
                                                        <p className="text-primary-600">{fmtDate(p.activatedAt)}</p>
                                                    </div>
                                                )}
                                                {p.note && (
                                                    <div className="flex-1">
                                                        <p className="text-xs text-slate-400">Note</p>
                                                        <p className="text-slate-600 italic">{p.note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                <Shield className="w-3.5 h-3.5" /> Actions Super Admin
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Note optionnelle..."
                                                    value={noteInput[p._id] || ''}
                                                    onChange={e => setNoteInput(prev => ({ ...prev, [p._id]: e.target.value }))}
                                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition"
                                                />
                                                <div className="flex gap-2 flex-wrap">
                                                    {p.status !== 'active' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'active')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition shadow-sm disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Approuver
                                                        </button>
                                                    )}
                                                    {p.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'rejected')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition shadow-sm disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Rejeter
                                                        </button>
                                                    )}
                                                    {p.status !== 'pending' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'pending')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition disabled:opacity-50"
                                                        >
                                                            <RefreshCcw className="w-4 h-4" />
                                                            Remettre en attente
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </SuperAdminShell>
    );
};

export default SuperAdminWhatsAppPostulations;
