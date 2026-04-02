import React, { useState, useCallback, useEffect } from 'react';
import {
  Save, RotateCcw, Loader2, LayoutDashboard, ClipboardList,
  Star, HelpCircle, Package, TrendingUp, MessageCircle, Palette,
  AlignLeft, Plus, X, Info, ChevronUp, ChevronDown, GripVertical,
  Eye, ExternalLink, Smartphone,
} from 'lucide-react';
import defaultConfig from '../components/productSettings/defaultConfig';
import { storeManageApi } from '../services/storeApi';
import AutomationSettings from '../components/productSettings/AutomationSettings';
import DesignSettings from '../components/productSettings/DesignSettings';
import SectionCard from '../components/productSettings/SectionCard';
import ToggleSwitch from '../components/productSettings/ToggleSwitch';
import LivePreview from '../components/productSettings/LivePreview';

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const TABS = [
  { id: 'page', label: 'Paramètres de la page', icon: LayoutDashboard },
  { id: 'form', label: 'Paramètres du formulaire', icon: ClipboardList },
];

const mergeSections = (stored) => {
  if (!stored?.length) return deepClone(defaultConfig.general.sections);
  const defaults = deepClone(defaultConfig.general.sections);
  const merged = stored.map(s => {
    const def = defaults.find(d => d.id === s.id);
    return def ? { ...def, ...s } : s;
  });
  defaults.forEach(d => { if (!merged.find(s => s.id === d.id)) merged.push(d); });
  return merged;
};

const mergeWithDefaults = (stored) => ({
  ...deepClone(defaultConfig),
  ...stored,
  general: {
    ...defaultConfig.general,
    ...(stored?.general || {}),
    sections: mergeSections(stored?.general?.sections),
  },
  conversion: { ...defaultConfig.conversion, ...(stored?.conversion || {}) },
  automation: {
    ...defaultConfig.automation,
    ...(stored?.automation || {}),
    whatsapp: { ...defaultConfig.automation.whatsapp, ...(stored?.automation?.whatsapp || {}) },
  },
  design: { ...defaultConfig.design, ...(stored?.design || {}) },
  form: {
    ...defaultConfig.form,
    fields: stored?.form?.fields?.length ? stored.form.fields : defaultConfig.form.fields,
  },
});

const SECTION_ICONS = {
  heroSlogan:       '✍️',
  heroBaseline:     '✅',
  reviews:          '⭐',
  statsBar:         '📊',
  stockCounter:     '📦',
  urgencyBadge:     '🔥',
  urgencyElements:  '⏰',
  benefitsBullets:  '💥',
  conversionBlocks: '🛡️',
  offerBlock:       '🎁',
  description:      '📝',
  problemSection:   '😰',
  solutionSection:  '💡',
  faq:              '❓',
  testimonials:     '💬',
  relatedProducts:  '🔗',
  stickyOrderBar:   '📌',
  upsell:           '🚀',
  orderBump:        '🛒',
};

const SECTION_DESC = {
  heroSlogan:       'Sous-titre marketing généré par l\'IA',
  heroBaseline:     'Phrase de réassurance sous le titre',
  reviews:          'Étoiles et nombre d\'avis clients',
  statsBar:         'Chiffres de preuve sociale (clients, satisfaction…)',
  stockCounter:     'Stock restant pour créer l\'urgence',
  urgencyBadge:     'Badge texte d\'urgence IA près du stock',
  urgencyElements:  'Stock limité, preuve sociale, résultat rapide',
  benefitsBullets:  'Liste des bénéfices produit avec emojis',
  conversionBlocks: 'Blocs de réassurance (paiement, livraison…)',
  offerBlock:       'Bloc garantie / offre spéciale',
  description:      'Description complète du produit',
  problemSection:   'Points de douleur du client (fond rouge)',
  solutionSection:  'Solution persuasive (fond vert)',
  faq:              'Questions fréquentes sous la description',
  testimonials:     'Carrousel de témoignages clients',
  relatedProducts:  'Produits similaires « Vous aimerez aussi »',
  stickyOrderBar:   'Barre fixe en bas avec bouton Commander',
  upsell:           'Produit de valeur supérieure au checkout',
  orderBump:        'Produit complémentaire dans le formulaire',
};

// ── Page tab: draggable ordered section list ──────────────────────────────────
const PageSettingsPanel = ({ config, onChange }) => {
  const sections = config.general.sections;
  const dragIdx = React.useRef(null);

  const updateSections = (next) =>
    onChange({ ...config, general: { ...config.general, sections: next } });

  const toggle = (index) => {
    const next = sections.map((s, i) => i === index ? { ...s, enabled: !s.enabled } : s);
    updateSections(next);
  };

  const onDragStart = (e, index) => {
    dragIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    dragIdx.current = null;
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current === null || dragIdx.current === index) return;
    const next = [...sections];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(index, 0, moved);
    dragIdx.current = index;
    updateSections(next);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        icon={<LayoutDashboard size={18} />}
        title="Sections de la page produit"
        description="Glissez pour réorganiser · activez ou désactivez chaque section."
      >
        <div className="space-y-1.5 mt-1">
          {sections.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(e, index)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                section.enabled
                  ? 'border-[#0F6B4F]/20 bg-[#F0FAF5]'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              {/* Drag handle */}
              <GripVertical size={16} className="text-gray-300 shrink-0" />

              {/* Position badge */}
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>

              {/* Icon + label */}
              <span className="text-base shrink-0">{SECTION_ICONS[section.id]}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold ${
                  section.enabled ? 'text-gray-800' : 'text-gray-400'
                }`}>{section.label}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">{SECTION_DESC[section.id]}</p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={section.enabled}
                onClick={() => toggle(index)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  section.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-200'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  section.enabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

// ── Form tab: type + design + quantities + fields + automation ────────────────
const FormSettingsPanel = ({ config, onChange }) => {
  const [newQty, setNewQty] = useState('');
  const fields = config.form.fields;

  const updateGeneral = (key, val) => onChange({ ...config, general: { ...config.general, [key]: val } });

  const addQuantity = () => {
    const num = parseInt(newQty, 10);
    if (!num || num < 1 || config.conversion.quantities.includes(num)) return;
    const sorted = [...config.conversion.quantities, num].sort((a, b) => a - b);
    onChange({ ...config, conversion: { ...config.conversion, quantities: sorted } });
    setNewQty('');
  };

  const removeQuantity = (qty) => {
    onChange({ ...config, conversion: { ...config.conversion, quantities: config.conversion.quantities.filter(q => q !== qty) } });
  };

  const toggleField = (index) => {
    const updated = fields.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f);
    onChange({ ...config, form: { ...config.form, fields: updated } });
  };

  const moveField = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange({ ...config, form: { ...config.form, fields: updated } });
  };

  return (
    <div className="space-y-5">
      {/* Type de formulaire */}
      <SectionCard
        icon={<AlignLeft size={18} />}
        title="Type d'affichage du formulaire"
        description="Choisissez comment le formulaire de commande s'affiche."
      >
        <div className="flex gap-3 mt-1">
          {[
            { id: 'popup', label: 'Popup', desc: 'Formulaire dans une modale' },
            { id: 'embedded', label: 'Intégré', desc: 'Formulaire affiché sur la page' },
          ].map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => updateGeneral('formType', id)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                config.general.formType === id
                  ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="block text-[11px] mt-0.5 opacity-70">{desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Design du formulaire */}
      <DesignSettings config={config.design} onChange={(v) => onChange({ ...config, design: v })} />

      {/* Quantités disponibles */}
      <SectionCard
        icon={<Package size={18} />}
        title="Quantités disponibles"
        description="Définissez les options de quantité proposées au client. Laissez vide pour un sélecteur libre."
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {config.conversion.quantities.map((qty) => (
            <span key={qty} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E6F2ED] text-[#0F6B4F] text-sm font-medium">
              {qty}
              <button onClick={() => removeQuantity(qty)} className="hover:text-red-500 transition-colors">
                <X size={13} />
              </button>
            </span>
          ))}
          {config.conversion.quantities.length === 0 && (
            <span className="text-xs text-gray-400 italic">Sélecteur libre (+/-)</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number" min="1" value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuantity()}
            placeholder="Ex: 2"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F6B4F] focus:ring-1 focus:ring-[#0F6B4F]/20"
          />
          <button onClick={addQuantity} className="px-3 py-2 rounded-xl bg-[#0F6B4F] text-white text-sm font-medium hover:bg-[#0d5a42] transition-colors flex items-center gap-1">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </SectionCard>

      {/* Champs du formulaire */}
      <SectionCard
        icon={<ClipboardList size={18} />}
        title="Champs du formulaire"
        description="Activez ou désactivez les champs et réorganisez leur ordre d'affichage."
      >
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                field.enabled ? 'border-[#0F6B4F]/20 bg-[#F0FAF5]' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <GripVertical size={16} className="text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${field.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {field.label}
                </span>
                <span className="text-[11px] text-gray-400 ml-2 font-mono">{field.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveField(index, -1)} disabled={index === 0}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronUp size={14} className="text-gray-500" />
                </button>
                <button onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
              </div>
              <button
                type="button" role="switch" aria-checked={field.enabled}
                onClick={() => toggleField(index)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${field.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${field.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* WhatsApp automation */}
      <AutomationSettings config={config.automation} onChange={(v) => onChange({ ...config, automation: v })} />
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const ProductSettingsPage = () => {
  const [config, setConfig] = useState(() => deepClone(defaultConfig));
  const [activeTab, setActiveTab] = useState('page');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storeManageApi.getStoreConfig();
        const raw = res.data?.data || res.data || {};
        const stored = raw.productPageConfig;
        if (stored) setConfig(mergeWithDefaults(stored));
      } catch (e) {
        console.error('Failed to load product page config:', e);
      } finally {
        setLoading(false);
      }
    })();
    // Fetch a real product for the "voir sur la boutique" link
    (async () => {
      try {
        const res = await storeManageApi.getProducts({ limit: 1 });
        const list = res.data?.data || res.data || [];
        if (list.length > 0) setPreviewProduct(list[0]);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleChange = useCallback((newConfig) => {
    setConfig(newConfig);
    setSaved(false);
    setSaveError('');
  }, []);

  const handleReset = () => {
    setConfig(deepClone(defaultConfig));
    setSaved(false);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await storeManageApi.updateStoreConfig({ productPageConfig: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError('Erreur lors de la sauvegarde. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin text-[#0F6B4F]" />
          Chargement des paramètres…
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Paramètres Page Produit</h1>
          <p className="text-xs text-gray-500 mt-0.5">Les modifications s'appliquent directement à votre page produit et formulaire de commande</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saveError && <span className="text-xs text-red-500 font-medium">{saveError}</span>}

          {/* Preview toggle (visible on smaller screens) */}
          <button
            onClick={() => setShowMobilePreview(!showMobilePreview)}
            className={`xl:hidden flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showMobilePreview
                ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Smartphone size={14} />
            Aperçu
          </button>

          {/* View on real store link */}
          {previewProduct?.slug && (
            <a
              href={`/product/${previewProduct.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Voir sur la boutique</span>
              <span className="sm:hidden">Voir</span>
            </a>
          )}

          <button onClick={handleReset} disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-70 ${saved ? 'bg-green-500 shadow-sm' : 'bg-[#0F6B4F] hover:bg-[#0d5a42] shadow-sm'}`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Enregistrement…' : saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Info banner — settings apply in real time */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
        <Info size={16} className="text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700">
          Chaque modification ici s'applique directement à votre <strong>page produit</strong> et au <strong>formulaire de commande</strong>. Enregistrez pour que les changements soient visibles par vos clients.
        </p>
      </div>

      {/* Mobile preview (shown when toggled on smaller screens) */}
      {showMobilePreview && (
        <div className="xl:hidden">
          <LivePreview config={config} />
        </div>
      )}

      {/* 2 tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${
                active ? 'bg-[#0F6B4F] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Panel + Live Preview side by side */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {activeTab === 'page'
            ? <PageSettingsPanel config={config} onChange={handleChange} />
            : <FormSettingsPanel config={config} onChange={handleChange} />
          }
        </div>
        <div className="hidden xl:block w-[400px] shrink-0 sticky top-20">
          <LivePreview config={config} />
        </div>
      </div>
    </div>
  );
};

export default ProductSettingsPage;
