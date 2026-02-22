import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare, Phone, Building2, User, Mail, Clock, CheckCircle2,
    XCircle, AlertCircle, RefreshCcw, ChevronDown, ChevronUp, Search,
    Shield, Smartphone, Filter, Eye, MessageCircle
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const STATUS_CONFIG = {
    pending: {
        label: 'En attente',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        ring: 'ring-amber-500/20',
        icon: Clock,
        gradient: 'from-amber-500 to-orange-500',
        dot: 'bg-amber-500'
    },
    active: {
        label: 'Approuvée',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        ring: 'ring-emerald-500/20',
        icon: CheckCircle2,
        gradient: 'from-emerald-500 to-teal-500',
        dot: 'bg-emerald-500'
    },
    rejected: {
        label: 'Rejetée',
        bg: 'bg-red-50',
        text: 'text-red-700',
        ring: 'ring-red-500/20',
        icon: XCircle,
        gradient: 'from-red-500 to-rose-500',
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
            setError(err.response?.data?.message || 'Erreur lors du chargement des postulations');
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
        <div className="min-h-screen bg-gray-950 p-4 md:p-8">
            {/* Flash */}
            {flash && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-[slideDown_0.3s_ease-out] ${flash.type === 'ok' ? 'bg-emerald-500 text-white' : flash.type === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                    {flash.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-900/30">
                        <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Postulations WhatsApp</h1>
                        <p className="text-sm text-gray-400">Gérez les demandes d'activation de numéro WhatsApp personnel</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', value: stats.total, gradient: 'from-violet-500 to-purple-600', icon: MessageSquare },
                    { label: 'En attente', value: stats.pending, gradient: 'from-amber-500 to-orange-500', icon: Clock },
                    { label: 'Approuvées', value: stats.active, gradient: 'from-emerald-500 to-teal-500', icon: CheckCircle2 },
                    { label: 'Rejetées', value: stats.rejected, gradient: 'from-red-500 to-rose-500', icon: XCircle },
                ].map(s => (
                    <div key={s.label} className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-4 hover:border-gray-700/60 transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg`}>
                                <s.icon className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{s.value}</p>
                                <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, email, téléphone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    {['all', 'pending', 'active', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filterStatus === s
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                                    : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'
                                }`}
                        >
                            {s === 'all' ? 'Tout' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                    <button
                        onClick={fetchPostulations}
                        disabled={loading}
                        className="ml-2 p-2 rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300 transition disabled:opacity-50"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800/60 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-7 h-7 text-gray-600" />
                    </div>
                    <p className="text-gray-400 font-medium">Aucune postulation trouvée</p>
                    <p className="text-sm text-gray-600 mt-1">Les demandes d'activation WhatsApp apparaîtront ici</p>
                </div>
            )}

            {/* Postulations List */}
            {!loading && filtered.length > 0 && (
                <div className="space-y-3">
                    {filtered.map(p => {
                        const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                        const StatusIcon = statusCfg.icon;
                        const isExpanded = expandedId === p._id;

                        return (
                            <div key={p._id} className={`bg-gray-900/50 border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-violet-600/40 shadow-lg shadow-violet-900/20' : 'border-gray-800/60 hover:border-gray-700/60'
                                }`}>
                                {/* Header row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : p._id)}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/30 transition-colors"
                                >
                                    {/* WhatsApp Icon */}
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-900/30">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-semibold text-white truncate">{p.businessName || p.workspaceName}</h3>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.ring}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
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
                                    <div className="flex-shrink-0 text-gray-500">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-800/60 p-5 space-y-5 animate-[fadeIn_0.2s_ease-out]">
                                        {/* Info Cards Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {/* Entreprise */}
                                            <div className="bg-gray-800/40 rounded-xl p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                    <Building2 className="w-3.5 h-3.5" /> Entreprise
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Nom</p>
                                                        <p className="text-sm text-white font-medium">{p.businessName || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Type d'activité</p>
                                                        <p className="text-sm text-white">{BUSINESS_TYPE_LABELS[p.businessType] || p.businessType || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Workspace</p>
                                                        <p className="text-sm text-violet-400 font-medium">{p.workspaceName}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Contact */}
                                            <div className="bg-gray-800/40 rounded-xl p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                    <User className="w-3.5 h-3.5" /> Contact
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Nom complet</p>
                                                        <p className="text-sm text-white font-medium">{p.contactName || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Email</p>
                                                        <p className="text-sm text-white">{p.email || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Demandé par</p>
                                                        <p className="text-sm text-white">{p.requestedBy?.name || p.requestedBy?.email || '—'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* WhatsApp */}
                                            <div className="bg-gray-800/40 rounded-xl p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                    <Smartphone className="w-3.5 h-3.5" /> WhatsApp
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Numéro à configurer</p>
                                                        <p className="text-sm text-green-400 font-mono font-medium">{fmtPhone(p.phoneNumber)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Numéro actuel</p>
                                                        <p className="text-sm text-white font-mono">{p.currentWhatsappNumber || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Volume mensuel</p>
                                                        <p className="text-sm text-white">{p.monthlyMessages || '—'} messages</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Raison / Motivation */}
                                        {p.reason && (
                                            <div className="bg-gray-800/40 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    <MessageSquare className="w-3.5 h-3.5" /> Motivation
                                                </div>
                                                <p className="text-sm text-gray-300 leading-relaxed">{p.reason}</p>
                                            </div>
                                        )}

                                        {/* Timeline */}
                                        <div className="bg-gray-800/40 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                                <Clock className="w-3.5 h-3.5" /> Chronologie
                                            </div>
                                            <div className="flex items-center gap-6 text-sm">
                                                <div>
                                                    <p className="text-xs text-gray-500">Demandé le</p>
                                                    <p className="text-white">{fmtDate(p.requestedAt)}</p>
                                                </div>
                                                {p.activatedAt && (
                                                    <div>
                                                        <p className="text-xs text-gray-500">Activé le</p>
                                                        <p className="text-emerald-400">{fmtDate(p.activatedAt)}</p>
                                                    </div>
                                                )}
                                                {p.note && (
                                                    <div className="flex-1">
                                                        <p className="text-xs text-gray-500">Note</p>
                                                        <p className="text-gray-300 italic">{p.note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/40">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                                <Shield className="w-3.5 h-3.5" /> Actions Super Admin
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Note optionnelle..."
                                                    value={noteInput[p._id] || ''}
                                                    onChange={e => setNoteInput(prev => ({ ...prev, [p._id]: e.target.value }))}
                                                    className="flex-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
                                                />
                                                <div className="flex gap-2">
                                                    {p.status !== 'active' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'active')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-emerald-500 hover:to-teal-400 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Approuver
                                                        </button>
                                                    )}
                                                    {p.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'rejected')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-medium rounded-lg hover:from-red-500 hover:to-rose-400 transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Rejeter
                                                        </button>
                                                    )}
                                                    {p.status !== 'pending' && (
                                                        <button
                                                            onClick={() => handleAction(p._id, 'pending')}
                                                            disabled={actionLoading === p._id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50"
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
        </div>
    );
};

export default SuperAdminWhatsAppPostulations;
