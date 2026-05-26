import React, { useState, useEffect, useRef } from 'react';
import { safeHtml } from '../utils/sanitize';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  Mail, Send, Eye, Edit3, Save, ArrowLeft, Users, Calendar,
  Clock, Sparkles, TrendingUp, AlertCircle, CheckCircle2, Copy,
  FileText, Zap, Target, Bell, Gift, Heart, Info, Briefcase,
  Package, Calculator, Truck, TrendingDown, X, Loader2
} from 'lucide-react';
import { marketingApi } from '../services/marketingApi.js';

// Styles personnalisés pour React Quill
const customQuillStyles = `
.ql-toolbar {
  border-top: 1px solid #e5e7eb !important;
  border-left: 1px solid #e5e7eb !important;
  border-right: 1px solid #e5e7eb !important;
  border-bottom: none !important;
  border-top-left-radius: 8px !important;
  border-top-right-radius: 8px !important;
  background: #f9fafb !important;
}

.ql-container {
  border-bottom: 1px solid #e5e7eb !important;
  border-left: 1px solid #e5e7eb !important;
  border-right: 1px solid #e5e7eb !important;
  border-top: none !important;
  border-bottom-left-radius: 8px !important;
  border-bottom-right-radius: 8px !important;
  min-height: 300px !important;
}

.ql-editor {
  font-size: 14px !important;
  line-height: 1.6 !important;
  color: #374151 !important;
}

.ql-editor.ql-blank::before {
  color: #9ca3af !important;
  font-style: normal !important;
}

.ql-toolbar .ql-picker-label {
  color: #6b7280 !important;
}

.ql-toolbar .ql-stroke {
  stroke: #6b7280 !important;
}

.ql-toolbar .ql-fill {
  fill: #6b7280 !important;
}

.ql-toolbar button:hover {
  background: #f3f4f6 !important;
}

.ql-toolbar button.ql-active {
  background: #10b981 !important;
  color: white !important;
}

.ql-toolbar button.ql-active .ql-stroke {
  stroke: white !important;
}

.ql-toolbar button.ql-active .ql-fill {
  fill: white !important;
}
`;

// Injecter les styles personnalisés
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = customQuillStyles;
  document.head.appendChild(styleSheet);
}

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
    html: '<h1 style="color:#0A5740;font-size:32px;margin-bottom:16px">👋 Bienvenue sur Scalor !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous sommes ravis de vous compter parmi nous ! Votre compte est maintenant actif et vous pouvez commencer à profiter de toutes nos fonctionnalités.</p><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/register" style="display:inline-block;padding:14px 32px;background:#0A5740;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px">S\'inscrire maintenant →</a></div><p style="color:#94a3b8;font-size:14px;margin-top:32px">À très bientôt,<br>L\'équipe Scalor</p>', 
    text: 'Bienvenue sur Scalor ! Votre compte est actif.' 
  },
  { 
    id: 'inactive', 
    name: 'Utilisateur inactif', 
    icon: Clock,
    description: 'Réengager les utilisateurs inactifs',
    html: '<h1 style="color:#f59e0b;font-size:28px;margin-bottom:16px">⏰ Vous nous manquez !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Nous avons remarqué que vous ne vous êtes pas connecté depuis un moment.</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Voici ce qui s\'est passé pendant votre absence :</p><ul style="color:#475569;font-size:16px;line-height:1.8;margin-bottom:24px"><li>✨ Nouvelles fonctionnalités ajoutées</li><li>📊 Améliorations des tableaux de bord</li><li>🚀 Performance optimisée</li></ul><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/login" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Revenir sur la plateforme →</a></div>', 
    text: 'Vous nous manquez ! Revenez découvrir les nouveautés.' 
  },
  { 
    id: 'update', 
    name: 'Nouveautés', 
    icon: Sparkles,
    description: 'Annoncer les nouvelles fonctionnalités',
    html: '<h1 style="color:#06b6d4;font-size:28px;margin-bottom:16px">✨ Voici ce qui se passe</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous avons de grandes nouvelles à partager avec vous !</p><div style="background:#f0fdfa;border-left:4px solid:#06b6d4;padding:20px;margin:24px 0;border-radius:8px"><h3 style="color:#06b6d4;margin:0 0 12px 0;font-size:18px">🎯 Nouvelle fonctionnalité</h3><p style="color:#475569;margin:0;font-size:15px">Description de la nouveauté et de ses avantages pour vous...</p></div><div style="text-align:center;margin:32px 0"><a href="https://ecomcockpit.site/ecom/login" style="display:inline-block;padding:14px 32px;background:#06b6d4;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Découvrir →</a></div>', 
    text: 'Découvrez nos dernières nouveautés !' 
  },
  { 
    id: 'promo', 
    name: 'Promotion', 
    icon: Gift,
    description: 'Offre spéciale ou réduction',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff"><h1 style="font-size:32px;margin-bottom:16px;text-align:center">🎉 Offre Exclusive !</h1><div style="background:#fff;color:#1f2937;padding:32px;border-radius:16px;margin:24px 0"><p style="font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="font-size:16px;line-height:1.6;margin-bottom:24px">Profitez de notre offre spéciale réservée à nos utilisateurs fidèles !</p><div style="text-align:center;background:#fef3c7;padding:24px;border-radius:12px;margin:24px 0"><p style="font-size:48px;font-weight:bold;color:#d97706;margin:0">-30%</p><p style="color:#92400e;margin:8px 0 0 0">Sur tous nos services</p></div><div style="text-align:center;margin:24px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#0A5740;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px">En profiter maintenant →</a></div><p style="color:#94a3b8;font-size:13px;text-align:center;margin-top:24px">Offre valable jusqu\'au 31/12/2026</p></div></div>', 
    text: 'Offre exclusive -30% !' 
  },
  { 
    id: 'newsletter', 
    name: 'Newsletter', 
    icon: Mail,
    description: 'Actualités et informations',
    html: '<h1 style="color:#1f2937;font-size:28px;margin-bottom:8px">📰 Newsletter</h1><p style="color:#94a3b8;font-size:14px;margin-bottom:32px">Les actualités de ce mois</p><div style="border-bottom:2px solid #e2e8f0;margin:24px 0"></div><div style="margin:32px 0"><h2 style="color:#0A5740;font-size:20px;margin-bottom:12px">📌 Titre de l\'article</h2><p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:16px">Description de l\'actualité ou de l\'article...</p><a href="#" style="color:#0A5740;font-weight:600;text-decoration:none">Lire la suite →</a></div><div style="border-bottom:1px solid #e2e8f0;margin:24px 0"></div><div style="margin:32px 0"><h2 style="color:#0A5740;font-size:20px;margin-bottom:12px">📌 Autre actualité</h2><p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:16px">Description...</p><a href="#" style="color:#0A5740;font-weight:600;text-decoration:none">Lire la suite →</a></div>', 
    text: 'Newsletter du mois' 
  },
  { 
    id: 'reminder', 
    name: 'Rappel', 
    icon: Bell,
    description: 'Rappeler une action à effectuer',
    html: '<div style="background:#fef3c7;border-left:4px solid:#f59e0b;padding:20px;border-radius:8px;margin-bottom:24px"><h1 style="color:#92400e;font-size:24px;margin:0 0 8px 0">🔔 Rappel Important</h1></div><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous vous rappelons qu\'il est temps de :</p><ul style="color:#475569;font-size:16px;line-height:1.8"><li>Action 1 à effectuer</li><li>Action 2 à effectuer</li></ul><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Passer à l\'action →</a></div>', 
    text: 'Rappel : actions à effectuer' 
  },
  { 
    id: 'feedback', 
    name: 'Demande d\'avis', 
    icon: Heart,
    description: 'Collecter les retours utilisateurs',
    html: '<h1 style="color:#ec4899;font-size:28px;margin-bottom:16px">💝 Votre avis compte !</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous aimerions connaître votre expérience avec notre plateforme.</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Votre feedback nous aide à nous améliorer continuellement pour mieux vous servir.</p><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#ec4899;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Donner mon avis →</a></div><p style="color:#94a3b8;font-size:14px;text-align:center">Cela ne prendra que 2 minutes</p>', 
    text: 'Partagez votre avis avec nous !' 
  },
  { 
    id: 'achievement', 
    name: 'Succès / Milestone', 
    icon: Target,
    description: 'Célébrer une étape importante',
    html: '<div style="text-align:center"><div style="font-size:64px;margin-bottom:16px">🎯</div><h1 style="color:#10b981;font-size:32px;margin-bottom:16px">Félicitations !</h1><p style="color:#475569;font-size:18px;line-height:1.6;margin-bottom:24px">Vous avez atteint une étape importante</p><div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;padding:32px;border-radius:16px;margin:32px 0"><p style="font-size:48px;font-weight:bold;margin:0">100+</p><p style="font-size:18px;margin:8px 0 0 0">Actions complétées</p></div><p style="color:#475569;font-size:16px;line-height:1.6;margin:24px 0">Continuez comme ça, vous êtes sur la bonne voie !</p><div style="margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Voir mes statistiques →</a></div></div>', 
    text: 'Félicitations pour votre succès !' 
  },
  { 
    id: 'tips', 
    name: 'Conseils / Astuces', 
    icon: Zap,
    description: 'Partager des conseils utiles',
    html: '<h1 style="color:#0F6B4F;font-size:28px;margin-bottom:16px">⚡ Astuce du jour</h1><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Saviez-vous que vous pouvez optimiser votre utilisation de la plateforme ?</p><div style="background:#f5f3ff;border-left:4px solid:#0F6B4F;padding:24px;margin:24px 0;border-radius:8px"><h3 style="color:#0F6B4F;margin:0 0 12px 0;font-size:18px">💡 Conseil #1</h3><p style="color:#475569;margin:0 0 16px 0;font-size:15px">Description du conseil et comment l\'appliquer...</p><h3 style="color:#0F6B4F;margin:16px 0 12px 0;font-size:18px">💡 Conseil #2</h3><p style="color:#475569;margin:0;font-size:15px">Autre astuce utile...</p></div><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#0F6B4F;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Découvrir plus d\'astuces →</a></div>', 
    text: 'Astuces pour mieux utiliser la plateforme' 
  },
  { 
    id: 'urgent', 
    name: 'Alerte / Urgent', 
    icon: AlertCircle,
    description: 'Message important ou urgent',
    html: '<div style="background:#fee2e2;border:2px solid#ef4444;padding:24px;border-radius:12px;margin-bottom:24px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="background:#ef4444;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px">!</div><h1 style="color:#991b1b;font-size:24px;margin:0">Action Requise</h1></div><p style="color:#7f1d1d;font-size:14px;margin:0">Ce message nécessite votre attention</p></div><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:16px">Bonjour,</p><p style="color:#475569;font-size:16px;line-height:1.6;margin-bottom:24px">Nous avons détecté un élément qui nécessite votre intervention immédiate.</p><div style="background:#fef3c7;padding:20px;border-radius:8px;margin:24px 0"><p style="color:#92400e;font-size:15px;margin:0"><strong>Important :</strong> Détails de la situation...</p></div><div style="text-align:center;margin:32px 0"><a href="#" style="display:inline-block;padding:14px 32px;background:#ef4444;color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Agir maintenant →</a></div>', 
    text: 'Action requise : message urgent' 
  },
];

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
  ],
};

const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align',
  'blockquote', 'code-block',
  'link', 'image'
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

const Inp = ({ value, onChange, placeholder, type = 'text', className = '' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 placeholder:text-slate-400 bg-white transition-colors ${className}`} />
);

const Section = ({ icon: Icon, title, accent = 'text-primary-600', children, actions }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${accent}`} />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {actions}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Label = ({ children, required }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const Tag = ({ label, onClick }) => (
  <button type="button" onClick={onClick}
    className="px-2.5 py-1 text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors">
    {`{${label}}`}
  </button>
);

const Dlg = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export default function MarketingCompose({ editingId, onSaved, onCancel, flash }) {
  const [form, setForm] = useState({
    name: '', subject: '', previewText: '', 
    fromName: 'Scalor', 
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
  const [contentMode, setContentMode] = useState('html');

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
        setContentMode(c.bodyHtml ? 'html' : 'text');
      } catch { flash('Erreur chargement', 'err'); }
    })();
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serialize segmentFilter to avoid object reference instability triggering debounce every render
  const segmentFilterKey = JSON.stringify(form.segmentFilter);
  const prevAudKey = useRef('');
  useEffect(() => {
    const key = `${form.audienceType}|${form.customEmails}|${segmentFilterKey}`;
    if (key === prevAudKey.current) return;
    prevAudKey.current = key;
    const t = setTimeout(async () => {
      setAudLoad(true);
      try {
        const emails = form.customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
        const r = await marketingApi.previewAudience({ audienceType: form.audienceType, customEmails: emails, segmentFilter: form.segmentFilter });
        setAudCnt(r.data.data.count);
      } catch { setAudCnt(null); }
      finally { setAudLoad(false); }
    }, 900);
    return () => clearTimeout(t);
  }, [form.audienceType, form.customEmails, segmentFilterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.name.trim()) return flash('Nom requis', 'err');
    if (!form.subject.trim()) return flash('Sujet requis', 'err');
    if (contentMode === 'html' && !form.bodyHtml.trim()) return flash('Contenu HTML requis', 'err');
    if (contentMode === 'text' && !form.bodyText.trim()) return flash('Contenu texte requis', 'err');
    setSaving(true);
    try {
      const emails = form.customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
      const p = {
        ...form,
        bodyHtml: contentMode === 'html' ? form.bodyHtml : '',
        bodyText: contentMode === 'text' ? form.bodyText : '',
        customEmails: emails,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        scheduledAt: form.scheduledAt || null
      };
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

  const applyTpl = (tpl) => {
    sf('bodyHtml', tpl.html);
    sf('bodyText', tpl.text);
    setContentMode(tpl.html ? 'html' : 'text');
    setShowTpls(false);
  };

  const toggleRole = (role, checked) => {
    const roles = checked ? [...(form.segmentFilter.roles || []), role] : (form.segmentFilter.roles || []).filter(r => r !== role);
    sf('segmentFilter', { ...form.segmentFilter, roles });
  };

  const TAGS = ['prenom', 'name', 'email', 'workspace', 'role'];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Compose header ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-5 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour
              </button>
              <div className="w-px h-5 bg-white/10" />
              <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Edit3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-white">{eid ? 'Modifier la campagne' : 'Nouvelle campagne'}</h1>
                {eid && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{eid}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTpls(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Templates
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Enregistrement…' : eid ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-4">

        {/* Infos */}
        <Section icon={Info} title="Informations de la campagne">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label required>Nom de la campagne</Label>
              <Inp value={form.name} onChange={e => sf('name', e.target.value)} placeholder="Ex : Promo Janvier 2026" />
            </div>
            <div>
              <Label>Tags</Label>
              <Inp value={form.tags} onChange={e => sf('tags', e.target.value)} placeholder="promo, newsletter, relance" />
            </div>
          </div>
        </Section>

        {/* Headers */}
        <Section icon={Mail} title="En-têtes et expéditeur" accent="text-blue-500">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label required>Sujet de l'email</Label>
              <div className="flex gap-1">
                {['prenom', 'name'].map(t => (
                  <Tag key={t} label={t} onClick={() => sf('subject', form.subject + `{{${t}}}`)} />
                ))}
              </div>
            </div>
            <Inp value={form.subject} onChange={e => sf('subject', e.target.value)} placeholder="Offre exclusive réservée pour vous !" />
          </div>
          <div>
            <Label>Texte de prévisualisation</Label>
            <Inp value={form.previewText} onChange={e => sf('previewText', e.target.value)} placeholder="Court texte affiché avant ouverture dans la boîte mail…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Nom expéditeur</Label><Inp value={form.fromName} onChange={e => sf('fromName', e.target.value)} placeholder="Scalor" /></div>
            <div><Label>Email expéditeur</Label><Inp value={form.fromEmail} onChange={e => sf('fromEmail', e.target.value)} placeholder="contact@ecomcockpit.site" /></div>
            <div><Label>Reply-To</Label><Inp value={form.replyTo} onChange={e => sf('replyTo', e.target.value)} placeholder="support@ecomcockpit.site" /></div>
          </div>
        </Section>

        {/* Body */}
        <Section
          icon={Edit3}
          title="Contenu de l'email"
          accent="text-violet-500"
          actions={
            <button
              onClick={() => setPreview(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${preview ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {preview ? <><Edit3 className="w-3 h-3" /> Éditer</> : <><Eye className="w-3 h-3" /> Aperçu</>}
            </button>
          }
        >
          {!preview && (
            <div className="flex items-center gap-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-100">
                {['html', 'text'].map(m => (
                  <button key={m} onClick={() => setContentMode(m)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${contentMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {m === 'html' ? 'HTML' : 'Texte brut'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-semibold">Variables :</span>
                {TAGS.map(t => (
                  <Tag key={t} label={t} onClick={() => {
                    if (contentMode === 'html') sf('bodyHtml', form.bodyHtml + `{{${t}}}`);
                    else sf('bodyText', form.bodyText + `{{${t}}}`);
                  }} />
                ))}
              </div>
            </div>
          )}

          {preview ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">{form.subject || 'Sans sujet'}</span>
              </div>
              <div className="p-5 max-h-[500px] overflow-y-auto">
                {contentMode === 'html'
                  ? (form.bodyHtml ? <div dangerouslySetInnerHTML={safeHtml(form.bodyHtml)} /> : <p className="text-slate-400 text-sm">Aucun contenu HTML</p>)
                  : <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{form.bodyText || 'Aucun contenu'}</p>}
              </div>
            </div>
          ) : contentMode === 'html' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <ReactQuill value={form.bodyHtml} onChange={v => sf('bodyHtml', v)} modules={quillModules} formats={quillFormats} placeholder="Composez votre email HTML…" style={{ minHeight: '320px' }} />
            </div>
          ) : (
            <textarea
              value={form.bodyText}
              onChange={e => sf('bodyText', e.target.value)}
              rows={12}
              placeholder="Composez votre message en texte brut…"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-y placeholder:text-slate-400 leading-relaxed"
            />
          )}
        </Section>

        {/* Scheduling */}
        <Section icon={Calendar} title="Planification" accent="text-amber-500">
          <div>
            <Label>Date et heure d'envoi <span className="normal-case font-normal text-slate-400">(optionnel — laisser vide pour envoyer manuellement)</span></Label>
            <Inp type="datetime-local" value={form.scheduledAt} onChange={e => sf('scheduledAt', e.target.value)} />
          </div>
        </Section>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Audience */}
        <Section icon={Users} title="Destinataires" accent="text-primary-500">
          <div className="space-y-2">
            {[
              { v: 'custom_list',    l: 'Liste personnalisée',      desc: 'Entrez des emails manuellement' },
              { v: 'all_users',      l: 'Tous les utilisateurs',    desc: 'Tous les comptes de la plateforme' },
              { v: 'workspace_users',l: 'Utilisateurs workspace',   desc: 'Segmentez par rôle et activité' },
            ].map(o => (
              <label key={o.v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.audienceType === o.v ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="aud" value={o.v} checked={form.audienceType === o.v} onChange={() => sf('audienceType', o.v)} className="mt-0.5 accent-primary-600" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{o.l}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{o.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {form.audienceType === 'custom_list' && (
            <div>
              <Label>Emails (un par ligne ou séparés par virgule)</Label>
              <textarea value={form.customEmails} onChange={e => sf('customEmails', e.target.value)} rows={5} placeholder={"email1@exemple.com\nemail2@exemple.com"} className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-y placeholder:text-slate-400 font-mono" />
            </div>
          )}

          {form.audienceType === 'workspace_users' && (
            <>
              <div>
                <Label>Période d'activité</Label>
                <div className="space-y-1.5">
                  {PERIOD_FILTERS.map(p => {
                    const PeriodIcon = p.icon;
                    return (
                      <label key={p.value} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${form.segmentFilter.period === p.value ? 'border-primary-400 bg-primary-50 font-semibold text-primary-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <input type="radio" name="period" value={p.value} checked={form.segmentFilter.period === p.value} onChange={() => sf('segmentFilter', { ...form.segmentFilter, period: p.value })} className="accent-primary-600" />
                        <PeriodIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        {p.label}
                      </label>
                    );
                  })}
                  {form.segmentFilter.period && (
                    <button onClick={() => sf('segmentFilter', { ...form.segmentFilter, period: '' })} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 font-semibold pt-1">
                      <X className="w-3 h-3" /> Retirer le filtre
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
                          className="text-primary-700"
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
          <div className="flex items-center justify-between p-3.5 bg-primary-50 rounded-xl border border-primary-200">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary-700" />
              <span className="text-xs font-bold text-slate-700">Destinataires estimés</span>
            </div>
            {audLoad ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                <span className="text-xs text-slate-500">Calcul…</span>
              </div>
            ) : (
              <span className="text-2xl font-black text-primary-700">{audCnt ?? '—'}</span>
            )}
          </div>
        </Section>

        {/* Test */}
        <Section icon={Send} title="Envoyer un test" accent="text-sky-500">
          <div className="flex gap-2">
            <Inp value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@email.com" />
            <button
              onClick={sendTest}
              disabled={testLoad}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-500 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              {testLoad ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Test
            </button>
          </div>
          {testMsg && (
            <p className={`text-xs font-semibold px-3 py-2 rounded-lg ${testMsg.startsWith('✅') ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-600'}`}>
              {testMsg}
            </p>
          )}
        </Section>

        {/* Actions */}
        <Section icon={Save} title="Actions" accent="text-primary-600">
          <button
            onClick={save}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-500 disabled:opacity-50 transition-all shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : eid ? 'Mettre à jour' : 'Créer la campagne'}
          </button>
          <button
            onClick={onCancel}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux campagnes
          </button>
        </Section>
      </div>

      {/* Templates modal */}
      <Dlg open={showTpls} onClose={() => setShowTpls(false)} title="Choisir un template d'email">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EMAIL_TPLS.map(t => {
            const TplIcon = t.icon;
            return (
              <button 
                key={t.id} 
                onClick={() => applyTpl(t)} 
                className="group p-5 border-2 border-slate-200 rounded-xl text-left hover:border-primary-600 hover:bg-primary-50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TplIcon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-slate-900 group-hover:text-primary-800 transition-colors">{t.name}</p>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
              </button>
            );
          })}
        </div>
      </Dlg>

      </div>{/* end grid */}
      </div>{/* end body padding */}
    </div>
  );
}
