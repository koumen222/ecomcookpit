import React, { useState, useCallback, useEffect } from 'react';
import {
  Save, RotateCcw, Loader2, LayoutDashboard, ClipboardList,
  Package, MessageCircle, Palette, AlignLeft, Plus, X,
  ChevronUp, ChevronDown, GripVertical, ExternalLink, Smartphone,
  ChevronRight, MousePointerClick, Tag, Layers, Sparkles,
} from 'lucide-react';
import defaultConfig from '../components/productSettings/defaultConfig';
import { storeManageApi, storeProductsApi } from '../services/storeApi';
import BlocksEditor from '../components/productSettings/BlocksEditor';
import OffersEditor from '../components/productSettings/OffersEditor';
import ButtonEditor from '../components/productSettings/ButtonEditor';
import DesignSettings from '../components/productSettings/DesignSettings';
import AutomationSettings from '../components/productSettings/AutomationSettings';
import ToggleSwitch from '../components/productSettings/ToggleSwitch';
import LivePreview from '../components/productSettings/LivePreview';

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

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
  conversion: {
    ...defaultConfig.conversion,
    ...(stored?.conversion || {}),
    offers: stored?.conversion?.offers?.length
      ? stored.conversion.offers
      : defaultConfig.conversion.offers,
  },
  automation: {
    ...defaultConfig.automation,
    ...(stored?.automation || {}),
    whatsapp: { ...defaultConfig.automation.whatsapp, ...(stored?.automation?.whatsapp || {}) },
  },
  design: { ...defaultConfig.design, ...(stored?.design || {}) },
  button: { ...defaultConfig.button, ...(stored?.button || {}) },
  form: {
    ...defaultConfig.form,
    fields: stored?.form?.fields?.length ? stored.form.fields : defaultConfig.form.fields,
  },
});

// ── Editor sections ───────────────────────────────────────────────────────────
const EDITOR_SECTIONS = [
  { id: 'sections', label: 'Sections de la page', icon: Layers, desc: 'Blocs, ordre & visibilité' },
  { id: 'offers', label: 'Offres quantité', icon: Tag, desc: 'Lots, réductions & badges' },
  { id: 'form', label: 'Formulaire', icon: ClipboardList, desc: 'Champs, type & validation' },
  { id: 'button', label: 'Bouton d\'action', icon: MousePointerClick, desc: 'Texte, icône & animation' },
  { id: 'design', label: 'Design & Styles', icon: Palette, desc: 'Couleurs, typo & bordures' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Confirmation automatique' },
];

// ── Form Fields Editor (inline) ──────────────────────────────────────────────
const FormFieldsEditor = ({ config, onChange }) => {
  const fields = config.form.fields;
  const updateGeneral = (key, val) =>
    onChange({ ...config, general: { ...config.general, [key]: val } });

  const toggleField = (index) => {
    const updated = fields.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f);
    onChange({ ...config, form: { ...config.form, fields: updated } });
  };

  const moveField = (index, dir) => {
    const t = index + dir;
    if (t < 0 || t >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[t]] = [updated[t], updated[index]];
    onChange({ ...config, form: { ...config.form, fields: updated } });
  };

  return (
    <div className="space-y-5">
      {/* Form type toggle */}
      <div>
        <div className="text-xs font-bold text-gray-700 mb-2.5">Type d'affichage</div>
        <div className="flex gap-2">
          {[
            { id: 'popup', label: 'Popup', icon: '💬' },
            { id: 'embedded', label: 'Intégré', icon: '📋' },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => updateGeneral('formType', id)}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                config.general.formType === id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'border-gray-150 bg-white text-gray-500 hover:border-gray-200'
              }`}
            >
              <span className="text-base">{icon}</span>
              <div className="text-left">
                <div className="font-bold text-[13px]">{label}</div>
                <div className="text-[10px] opacity-60 font-normal">
                  {id === 'popup' ? 'Modale au clic' : 'Affiché sur la page'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div>
        <div className="text-xs font-bold text-gray-700 mb-2.5">Champs du formulaire</div>
        <div className="space-y-1.5">
          {fields.map((field, index) => (
            <div
              key={field.name}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all ${
                field.enabled
                  ? 'border-emerald-200/60 bg-emerald-50/40'
                  : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <GripVertical size={14} className="text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-semibold ${field.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {field.label}
                </span>
                <span className="text-[10px] text-gray-400 ml-2 font-mono">{field.name}</span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => moveField(index, -1)} disabled={index === 0}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-20 transition-colors">
                  <ChevronUp size={13} className="text-gray-400" />
                </button>
                <button onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-20 transition-colors">
                  <ChevronDown size={13} className="text-gray-400" />
                </button>
              </div>
              <button
                onClick={() => toggleField(index)}
                className={`relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  field.enabled ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition duration-200 ${
                  field.enabled ? 'translate-x-[18px]' : 'translate-x-0'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Builder ──────────────────────────────────────────────────────────────
const ProductSettingsPage = () => {
  const [config, setConfig] = useState(() => deepClone(defaultConfig));
  const [openSection, setOpenSection] = useState('sections');
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
        const stored = raw.storeSettings?.productPageConfig || raw.productPageConfig;
        if (stored) setConfig(mergeWithDefaults(stored));
      } catch (e) {
        console.error('Failed to load product page config:', e);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await storeProductsApi.getProducts({ limit: 1 });
        const list = res.data?.data?.products || res.data?.data || res.data || [];
        if (list.length > 0) setPreviewProduct(list[0]);
      } catch (e) {
        console.error('ProductSettingsPage: failed to load preview product', e);
      }
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
    } catch {
      setSaveError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id) => setOpenSection(prev => prev === id ? null : id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
          </div>
          <span className="text-sm font-medium text-gray-500">Chargement du builder…</span>
        </div>
      </div>
    );
  }

  // Render the editor content for a given section
  const renderEditor = (sectionId) => {
    switch (sectionId) {
      case 'sections':
        return (
          <BlocksEditor
            sections={config.general.sections}
            onChange={(sections) => handleChange({
              ...config,
              general: { ...config.general, sections },
            })}
          />
        );
      case 'offers':
        return (
          <OffersEditor
            config={config.conversion}
            onChange={(conv) => handleChange({ ...config, conversion: conv })}
          />
        );
      case 'form':
        return <FormFieldsEditor config={config} onChange={handleChange} />;
      case 'button':
        return (
          <ButtonEditor
            config={config.button}
            designConfig={config.design}
            onChange={(btn) => handleChange({ ...config, button: btn })}
          />
        );
      case 'design':
        return (
          <DesignSettings
            config={config.design}
            onChange={(d) => handleChange({ ...config, design: d })}
          />
        );
      case 'whatsapp':
        return (
          <AutomationSettings
            config={config.automation}
            onChange={(a) => handleChange({ ...config, automation: a })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50/80">
      {/* ── Top bar ── */}
      <div className="flex-none bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-extrabold text-gray-900 tracking-tight leading-tight">
                Product Page Builder
              </h1>
              <p className="text-[10px] text-gray-400 font-medium leading-tight hidden sm:block">
                Personnalisez votre page produit en temps réel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-[11px] text-red-500 font-medium hidden sm:inline">{saveError}</span>
            )}

            <button
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                showMobilePreview
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Smartphone size={13} /> Aperçu
            </button>

            {previewProduct?.slug && (
              <a
                href={`/product/${previewProduct.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={12} />
                Voir en direct
              </a>
            )}

            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} /> Reset
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm disabled:opacity-70 ${
                saved
                  ? 'bg-green-500 shadow-green-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Sauvegarde…' : saved ? 'Enregistré !' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile preview overlay ── */}
      {showMobilePreview && (
        <div className="lg:hidden flex-1 overflow-y-auto p-4 bg-gray-100">
          <LivePreview config={config} product={previewProduct} />
        </div>
      )}

      {/* ── Builder body: editor + preview ── */}
      <div className={`flex-1 flex overflow-hidden ${showMobilePreview ? 'hidden lg:flex' : ''}`}>
        {/* Left: Editor panel */}
        <div className="w-full lg:w-[420px] xl:w-[460px] flex-none overflow-y-auto border-r border-gray-200 bg-white">
          <div className="p-3 sm:p-4">
            {/* Accordion sections */}
            <div className="space-y-1.5">
              {EDITOR_SECTIONS.map(({ id, label, icon: Icon, desc }) => {
                const isOpen = openSection === id;
                return (
                  <div key={id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all">
                    {/* Accordion header */}
                    <button
                      onClick={() => toggleSection(id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                        isOpen
                          ? 'bg-gradient-to-r from-emerald-50/80 to-white'
                          : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isOpen
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] font-bold block leading-tight ${
                          isOpen ? 'text-emerald-800' : 'text-gray-700'
                        }`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                          {desc}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-gray-300 transition-transform duration-200 shrink-0 ${
                          isOpen ? 'rotate-90 text-emerald-400' : ''
                        }`}
                      />
                    </button>

                    {/* Accordion body */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100/80">
                        {renderEditor(id)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="hidden lg:flex flex-1 items-start justify-center overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-gray-100/50">
          <div className="w-full max-w-[420px] sticky top-4">
            <LivePreview config={config} product={previewProduct} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSettingsPage;
