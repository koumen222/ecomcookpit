import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, Eye, Edit3, Save, ArrowLeft, Users, Calendar,
  Clock, Sparkles, TrendingUp, AlertCircle, CheckCircle2, Copy,
  FileText, Zap, Target, Bell, Gift, Heart, Info, Briefcase,
  Package, Calculator, Truck, TrendingDown
} from 'lucide-react';
import { marketingApi } from '../services/marketingApi.js';

const EMAIL_TPLS = [
  { 
    id: 'blank', 
    name: 'Vide', 
    icon: FileText,
    description: 'Commencer avec un email vierge',
    html: '', 
    text: '' 
  },
  { 
    id: 'welcome', 
    name: 'Bienvenue', 
    icon: Heart,
    description: 'Accueillir les nouveaux utilisateurs',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#7c3aed;font-size:32px;margin-bottom:16px">👋 Bienvenue sur Ecom Cockpit !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous sommes ravis de vous compter parmi nous ! Votre compte est maintenant actif et vous pouvez commencer à profiter de toutes nos fonctionnalités.</p><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/register" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px">S\'inscrire maintenant →</a></div><p style="color:#94a3b8;font-size:14px;margin-top:32px">À très bientôt,<br>L\'équipe Ecom Cockpit</p></div>', 
    text: 'Bienvenue sur Ecom Cockpit ! Votre compte est actif.' 
  },
  { 
    id: 'inactive', 
    name: 'Utilisateur inactif', 
    icon: Clock,
    description: 'Réengager les utilisateurs inactifs',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#f59e0b;font-size:28px;margin-bottom:16px">⏰ Vous nous manquez !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Nous avons remarqué que vous ne vous êtes pas connecté depuis un moment.</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Voici ce qui s\'est passé pendant votre absence :</p><ul style="color:#475569;font-size:16px;line-height:1.8;margin-bottom:24px"><li>✨ Nouvelles fonctionnalités ajoutées</li><li>📊 Améliorations des tableaux de bord</li><li>🚀 Performance optimisée</li></ul><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/login" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Revenir sur la plateforme →</a></div></div>', 
    text: 'Vous nous manquez ! Revenez découvrir les nouveautés.' 
  },
  { 
    id: 'update', 
    name: 'Nouveautés', 
    icon: Sparkles,
    description: 'Annoncer les nouvelles fonctionnalités',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#06b6d4;font-size:28px;margin-bottom:16px">✨ Voici ce qui se passe</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous avons de grandes nouvelles à partager avec vous !</p><div style="background:#f0fdfa;border-left:4px solid:#06b6d4;padding:20px;margin:24px 0;border-radius:8px"><h3 style="color:#06b6d4;margin:0 0 12px 0;font-size:18px">🎯 Nouvelle fonctionnalité</h3><p style="color:#475569;margin:0;font-size:15px">Description de la nouveauté et de ses avantages pour vous...</p></div><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/login" style="display:inline-block;padding:14px 32px;background:#06b6d4;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Découvrir →</a></div></div>', 
    text: 'Découvrez nos dernières nouveautés !' 
  },
  { 
    id: 'promo', 
    name: 'Promotion', 
    icon: Gift,
    description: 'Offre spéciale ou réduction',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff"><h1 style="font-size:32px;margin-bottom:16px;text-align:center">🎉 Offre Exclusive !</h1><div style="background:#fff;color:#1f2937;padding:32px;border-radius:16px;margin:24px 0"><p style="font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="font-size:16px;line-height:1.6;margin-bottom:24px">Profitez de notre offre spéciale réservée à nos utilisateurs fidèles !</p><div style="text-align:center;background:#fef3c7;padding:24px;border-radius:12px;margin:24px 0"><p style="font-size:48px;font-weight:bold;color:#d97706;margin:0">-30%</p><p style="color:#92400e;margin:8px 0 0 0">Sur tous nos services</p></div><div style="text-align:center;margin:24px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px">En profiter maintenant →</a></div><p style="color:#94a3b8;font-size:13px;text-align:center;margin-top:24px">Offre valable jusqu\'au 31/12/2026</p></div></div>', 
    text: 'Offre exclusive -30% !' 
  },
  { 
    id: 'newsletter', 
    name: 'Newsletter', 
    icon: Mail,
    description: 'Actualités et informations',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#1f2937;font-size:28px;margin-bottom:8px">📰 Newsletter</h1><p style="color:#94a3b8;font-size:14px;margin-bottom:32px">Les actualités de ce mois</p><div style="border-bottom:2px solid #e2e8f0;margin:24px 0"></div><div style="margin:32px 0"><h2 style="color:#7c3aed;font-size:20px;margin-bottom:12px">📌 Titre de l\'article</h2><p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:16px">Description de l\'actualité ou de l\'article...</p><a href="#" style="color:#7c3aed;font-weight:600;text-decoration:none">Lire la suite →</a></div><div style="border-bottom:1px solid #e2e8f0;margin:24px 0"></div><div style="margin:32px 0"><h2 style="color:#7c3aed;font-size:20px;margin-bottom:12px">📌 Autre actualité</h2><p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:16px">Description...</p><a href="#" style="color:#7c3aed;font-weight:600;text-decoration:none">Lire la suite →</a></div></div>', 
    text: 'Newsletter du mois' 
  },
  { 
    id: 'reminder', 
    name: 'Rappel', 
    icon: Bell,
    description: 'Rappeler une action à effectuer',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><div style="background:#fef3c7;border-left:4px solid:#f59e0b;padding:20px;border-radius:8px;margin-bottom:24px"><h1 style="color:#92400e;font-size:24px;margin:0 0 8px 0">🔔 Rappel Important</h1></div><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous vous rappelons qu\'il est temps de :</p><ul style="color:#475569;font-size:16px;line-height:1.8"><li>Action 1 à effectuer</li><li>Action 2 à effectuer</li></ul><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Passer à l\'action →</a></div></div>', 
    text: 'Rappel : actions à effectuer' 
  },
  { 
    id: 'feedback', 
    name: 'Demande d\'avis', 
    icon: Heart,
    description: 'Collecter les retours utilisateurs',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#ec4899;font-size:28px;margin-bottom:16px">💝 Votre avis compte !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous aimerions connaître votre expérience avec notre plateforme.</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Votre feedback nous aide à nous améliorer continuellement pour mieux vous servir.</p><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#ec4899;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Donner mon avis →</a></div><p style="color:#94a3b8;font-size:14px;text-align:center">Cela ne prendra que 2 minutes</p></div>', 
    text: 'Partagez votre avis avec nous !' 
  },
  { 
    id: 'achievement', 
    name: 'Succès / Milestone', 
    icon: Target,
    description: 'Célébrer une étape importante',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;text-align:center"><div style="font-size:64px;margin-bottom:16px">🎯</div><h1 style="color:#10b981;font-size:32px;margin-bottom:16px">Félicitations !</h1><p style="color:#475569;font-size:18px;line-height:1.6;margin-bottom:24px">Vous avez atteint une étape importante</p><div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;padding:32px;border-radius:16px;margin:32px 0"><p style="font-size:48px;font-weight:bold;margin:0">100+</p><p style="font-size:18px;margin:8px 0 0 0">Actions complétées</p></div><p style="color:#475569;font-size:16px;line-height:1.6;margin:24px 0">Continuez comme ça, vous êtes sur la bonne voie !</p><div style="margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Voir mes statistiques →</a></div></div>', 
    text: 'Félicitations pour votre succès !' 
  },
  { 
    id: 'tips', 
    name: 'Conseils / Astuces', 
    icon: Zap,
    description: 'Partager des conseils utiles',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><h1 style="color:#8b5cf6;font-size:28px;margin-bottom:16px">⚡ Astuce du jour</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Saviez-vous que vous pouvez optimiser votre utilisation de la plateforme ?</p><div style="background:#f5f3ff;border-left:4px solid:#8b5cf6;padding:24px;margin:24px 0;border-radius:8px"><h3 style="color:#8b5cf6;margin:0 0 12px 0;font-size:18px">💡 Conseil #1</h3><p style="color:#475569;margin:0 0 16px 0;font-size:15px">Description du conseil et comment l\'appliquer...</p><h3 style="color:#8b5cf6;margin:16px 0 12px 0;font-size:18px">💡 Conseil #2</h3><p style="color:#475569;margin:0;font-size:15px">Autre astuce utile...</p></div><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Découvrir plus d\'astuces →</a></div></div>', 
    text: 'Astuces pour mieux utiliser la plateforme' 
  },
  { 
    id: 'urgent', 
    name: 'Alerte / Urgent', 
    icon: AlertCircle,
    description: 'Message important ou urgent',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><div style="background:#fee2e2;border:2px solid#ef4444;padding:24px;border-radius:12px;margin-bottom:24px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="background:#ef4444;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">!</div><h1 style="color:#991b1b;font-size:24px;margin:0">Action Requise</h1></div><p style="color:#7f1d1d;font-size:14px;margin:0">Ce message nécessite votre attention</p></div><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous avons détecté un élément qui nécessite votre intervention immédiate.</p><div style="background:#fef3c7;padding:20px;border-radius:8px;margin:24px 0"><p style="color:#92400e;font-size:15px;margin:0"><strong>Important :</strong> Détails de la situation...</p></div><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#ef4444;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Agir maintenant →</a></div></div>', 
    text: 'Action requise : message urgent' 
  },
];

const ROLES = [
  { value: 'ecom_admin', label: 'Admin', icon: Briefcase },
  { value: 'ecom_closeuse', label: 'Closeuse', icon: Package },
  { value: 'ecom_compta', label: 'Comptable', icon: Calculator },
  { value: 'ecom_livreur', label: 'Livreur', icon: Truck },
];

const PERIOD_FILTERS = [
  { value: 'last_7_days', label: 'Actifs 7 derniers jours', icon: Clock },
  { value: 'last_30_days', label: 'Actifs 30 derniers jours', icon: Calendar },
  { value: 'inactive_7_days', label: 'Inactifs depuis 7 jours', icon: AlertCircle },
  { value: 'inactive_30_days', label: 'Inactifs depuis 30 jours', icon: AlertCircle },
  { value: 'new_users_7_days', label: 'Nouveaux (7 jours)', icon: Users },
  { value: 'new_users_30_days', label: 'Nouveaux (30 jours)', icon: Users },
  { value: 'never_logged_in', label: 'Jamais connectés', icon: TrendingDown },
];

const Inp = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
);

const Dlg = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="text-base font-semibold">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button></div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export default function MarketingCompose({ editingId, onSaved, onCancel, flash }) {
  const [form, setForm] = useState({
    name: '', subject: '', previewText: '', 
    fromName: 'Ecom Cockpit', 
    fromEmail: 'contact@ecomcockpit.site', 
    replyTo: 'support@ecomcockpit.site',
    bodyHtml: '', bodyText: '', audienceType: 'custom_list',
    customEmails: '', 
    segmentFilter: { roles: [], period: '' }, 
    scheduledAt: '', tags: ''
  });
  const [eid, setEid] = useState(editingId);
  const [audCnt, setAudCnt] = useState(null);
  const [audLoad, setAudLoad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testLoad, setTestLoad] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [showTpls, setShowTpls] = useState(false);
  const [preview, setPreview] = useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const r = await marketingApi.getCampaign(editingId);
        const c = r.data.data;
        setEid(editingId);
        setForm({
          name: c.name || '', subject: c.subject || '', previewText: c.previewText || '',
          fromName: c.fromName || '', fromEmail: c.fromEmail || '', replyTo: c.replyTo || '',
          bodyHtml: c.bodyHtml || '', bodyText: c.bodyText || '',
          audienceType: c.audienceType || 'custom_list',
          customEmails: (c.customEmails || []).join('\n'),
          segmentFilter: c.segmentFilter || { roles: [] },
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : '',
          tags: (c.tags || []).join(', ')
        });
      } catch { flash('Erreur chargement', 'err'); }
    })();
  }, [editingId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setAudLoad(true);
      try {
        const emails = form.customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
        const r = await marketingApi.previewAudience({ audienceType: form.audienceType, customEmails: emails, segmentFilter: form.segmentFilter });
        setAudCnt(r.data.data.count);
      } catch { setAudCnt(null); }
      finally { setAudLoad(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [form.audienceType, form.customEmails, form.segmentFilter]);

  const save = async () => {
    if (!form.name.trim()) return flash('Nom requis', 'err');
    if (!form.subject.trim()) return flash('Sujet requis', 'err');
    if (!form.bodyHtml.trim() && !form.bodyText.trim()) return flash('Contenu requis', 'err');
    setSaving(true);
    try {
      const emails = form.customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
      const p = { ...form, customEmails: emails, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), scheduledAt: form.scheduledAt || null };
      if (eid) { await marketingApi.updateCampaign(eid, p); flash('Mise à jour ✅'); }
      else { const r = await marketingApi.createCampaign(p); setEid(r.data.data._id); flash('Créée ✅'); }
      onSaved?.();
    } catch (e) { flash(e.response?.data?.message || 'Erreur', 'err'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!eid) return flash("Sauvegardez d'abord", 'err');
    if (!testEmail.includes('@')) return flash('Email invalide', 'err');
    setTestLoad(true); setTestMsg('');
    try { await marketingApi.testCampaign(eid, testEmail); setTestMsg(`✅ Test envoyé à ${testEmail}`); }
    catch (e) { setTestMsg(`❌ ${e.response?.data?.message || 'Erreur'}`); }
    finally { setTestLoad(false); }
  };

  const applyTpl = (tpl) => { sf('bodyHtml', tpl.html); sf('bodyText', tpl.text); setShowTpls(false); };

  const toggleRole = (role, checked) => {
    const roles = checked ? [...(form.segmentFilter.roles || []), role] : (form.segmentFilter.roles || []).filter(r => r !== role);
    sf('segmentFilter', { ...form.segmentFilter, roles });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-5">
        {/* Info */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Info className="w-5 h-5 text-violet-600" />
            <h3 className="text-base font-black text-slate-900">Informations</h3>
            {eid && <span className="ml-auto text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">{eid}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-2">Nom de la campagne *</label><Inp value={form.name} onChange={e => sf('name', e.target.value)} placeholder="Ex: Promo Janvier 2026" /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-2">Tags</label><Inp value={form.tags} onChange={e => sf('tags', e.target.value)} placeholder="promo, clients" /></div>
          </div>
        </div>

        {/* Headers */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">En-têtes et expéditeur</h3>
          </div>
          <div><label className="block text-xs font-bold text-slate-700 mb-2">Sujet de l'email *</label><Inp value={form.subject} onChange={e => sf('subject', e.target.value)} placeholder="🎉 Offre exclusive !" /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-2">Texte de prévisualisation</label><Inp value={form.previewText} onChange={e => sf('previewText', e.target.value)} placeholder="Court texte visible avant ouverture..." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-2">Nom expéditeur</label><Inp value={form.fromName} onChange={e => sf('fromName', e.target.value)} placeholder="Ecom Cockpit" /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-2">Email expéditeur</label><Inp value={form.fromEmail} onChange={e => sf('fromEmail', e.target.value)} placeholder="contact@ecomcockpit.site" /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-2">Reply-To</label><Inp value={form.replyTo} onChange={e => sf('replyTo', e.target.value)} placeholder="support@ecomcockpit.site" /></div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">Contenu de l'email *</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTpls(true)} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border-2 border-violet-200 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Templates
              </button>
              <button onClick={() => setPreview(p => !p)} className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border-2 rounded-lg transition-all duration-300 ${preview ? 'bg-sky-600 text-white border-sky-600 shadow-md' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {preview ? <><Edit3 className="w-3.5 h-3.5" /> Éditer</> : <><Eye className="w-3.5 h-3.5" /> Aperçu</>}
              </button>
            </div>
          </div>
          {preview ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-b">Aperçu — {form.subject || 'Sans sujet'}</div>
              <div className="p-4 max-h-96 overflow-y-auto">{form.bodyHtml ? <div dangerouslySetInnerHTML={{ __html: form.bodyHtml }} /> : <p className="text-gray-400 text-sm whitespace-pre-wrap">{form.bodyText || 'Aucun contenu'}</p>}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">HTML (recommandé)</label><textarea value={form.bodyHtml} onChange={e => sf('bodyHtml', e.target.value)} rows={10} placeholder="<h2>Bonjour !</h2><p>Votre message...</p>" className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Texte brut (fallback)</label><textarea value={form.bodyText} onChange={e => sf('bodyText', e.target.value)} rows={3} placeholder="Version texte..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" /></div>
            </div>
          )}
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-black text-slate-900">Planification</h3>
          </div>
          <div><label className="block text-xs font-bold text-slate-700 mb-2">Envoyer le (optionnel)</label><Inp type="datetime-local" value={form.scheduledAt} onChange={e => sf('scheduledAt', e.target.value)} /></div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        {/* Audience */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-violet-600" />
            <h3 className="text-base font-black text-slate-900">Destinataires</h3>
          </div>
          <div className="space-y-2">
            {[{ v: 'custom_list', l: 'Liste personnalisée' }, { v: 'all_users', l: 'Tous les utilisateurs' }, { v: 'workspace_users', l: 'Utilisateurs workspace' }].map(o => (
              <label key={o.v} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${form.audienceType === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="aud" value={o.v} checked={form.audienceType === o.v} onChange={() => sf('audienceType', o.v)} />
                <span className="text-sm font-medium text-gray-800">{o.l}</span>
              </label>
            ))}
          </div>
          {form.audienceType === 'custom_list' && (
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Emails (un par ligne)</label><textarea value={form.customEmails} onChange={e => sf('customEmails', e.target.value)} rows={5} placeholder="email1@ex.com&#10;email2@ex.com" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" /></div>
          )}
          {form.audienceType === 'workspace_users' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Période d'activité</label>
                <div className="space-y-2">
                  {PERIOD_FILTERS.map(p => {
                    const PeriodIcon = p.icon;
                    return (
                      <label key={p.value} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 ${form.segmentFilter.period === p.value ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input 
                          type="radio" 
                          name="period" 
                          value={p.value} 
                          checked={form.segmentFilter.period === p.value} 
                          onChange={() => sf('segmentFilter', { ...form.segmentFilter, period: p.value })} 
                          className="text-violet-600"
                        />
                        <PeriodIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-800">{p.label}</span>
                      </label>
                    );
                  })}
                  {form.segmentFilter.period && (
                    <button 
                      onClick={() => sf('segmentFilter', { ...form.segmentFilter, period: '' })}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                    >
                      ✕ Retirer le filtre de période
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Rôles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => {
                    const RoleIcon = r.icon;
                    return (
                      <label key={r.value} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={(form.segmentFilter.roles || []).includes(r.value)} 
                          onChange={e => toggleRole(r.value, e.target.checked)} 
                          className="text-violet-600"
                        />
                        <RoleIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium text-slate-700">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600" />
              <span className="text-sm font-bold text-slate-700">Destinataires :</span>
            </div>
            {audLoad ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Calcul...</span>
              </div>
            ) : (
              <span className="text-2xl font-black text-violet-600">{audCnt ?? '—'}</span>
            )}
          </div>
        </div>

        {/* Test */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-3 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Send className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Envoyer un test</h3>
          </div>
          <div className="flex gap-2">
            <Inp value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@email.com" />
            <button onClick={sendTest} disabled={testLoad} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-bold rounded-lg hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap transition-colors">
              {testLoad ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> ...</> : <><Send className="w-3.5 h-3.5" /> Test</>}
            </button>
          </div>
          {testMsg && <p className="text-xs font-medium">{testMsg}</p>}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-3 shadow-lg">
          <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all duration-300 shadow-md hover:shadow-lg">
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : eid ? 'Mettre à jour' : 'Créer la campagne'}
          </button>
          <button onClick={onCancel} className="w-full inline-flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour aux campagnes
          </button>
        </div>
      </div>

      {/* Templates modal */}
      <Dlg open={showTpls} onClose={() => setShowTpls(false)} title="📋 Choisir un template d'email">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EMAIL_TPLS.map(t => {
            const TplIcon = t.icon;
            return (
              <button 
                key={t.id} 
                onClick={() => applyTpl(t)} 
                className="group p-5 border-2 border-slate-200 rounded-xl text-left hover:border-violet-500 hover:bg-violet-50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TplIcon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors">{t.name}</p>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
              </button>
            );
          })}
        </div>
      </Dlg>
    </div>
  );
}
