import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, GripVertical, Eye, EyeOff, Plus, ChevronUp, ChevronDown, Settings2, ShoppingCart, Layers, Phone, User, MapPin, Trash2, Mail, FileText, Hash, Calendar } from 'lucide-react';
import { storeManageApi, storeProductsApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';
import defaultConfig from '../components/productSettings/defaultConfig.js';

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const mergeWithDefaults = (stored) => {
  const defaults = deepClone(defaultConfig);
  const defaultFieldMap = {};
  defaults.form.fields.forEach(f => { defaultFieldMap[f.name] = f; });

  // Merge each stored field with its default counterpart, and add missing defaults
  let mergedFields;
  if (stored?.form?.fields?.length) {
    const storedNames = new Set(stored.form.fields.map(f => f.name));
    const merged = stored.form.fields.map(f => ({ ...(defaultFieldMap[f.name] || {}), ...f }));
    // Add default fields not present in stored data
    defaults.form.fields.forEach(df => {
      if (!storedNames.has(df.name)) merged.push(df);
    });
    mergedFields = merged;
  } else {
    mergedFields = defaults.form.fields;
  }

  // Ensure product_info is always first
  const piIdx = mergedFields.findIndex(f => f.name === 'product_info');
  if (piIdx > 0) {
    const [pi] = mergedFields.splice(piIdx, 1);
    mergedFields.unshift(pi);
  }

  // Ensure city is before address
  const cityIdx = mergedFields.findIndex(f => f.name === 'city');
  const addrIdx = mergedFields.findIndex(f => f.name === 'address');
  if (cityIdx > addrIdx && addrIdx >= 0) {
    const [city] = mergedFields.splice(cityIdx, 1);
    mergedFields.splice(addrIdx, 0, city);
  }

  return {
    ...defaults,
    ...stored,
    general: {
      ...defaults.general,
      ...(stored?.general || {}),
      formType: stored?.general?.formType || defaults.general.formType,
      title: stored?.general?.title || defaults.general.title,
      countries: stored?.general?.countries || defaults.general.countries,
      popularCities: stored?.general?.popularCities || defaults.general.popularCities,
    },
    form: { ...defaults.form, fields: mergedFields },
    button: { ...defaults.button, ...(stored?.button || {}) },
    design: { ...defaults.design, ...(stored?.design || {}) },
    conversion: {
      ...defaults.conversion,
      ...(stored?.conversion || {}),
      offers: stored?.conversion?.offers?.length
        ? stored.conversion.offers
        : defaults.conversion.offers,
    },
    callSchedule: { ...defaults.callSchedule, ...(stored?.callSchedule || {}) },
    urgency: { ...defaults.urgency, ...(stored?.urgency || {}) },
  };
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all bg-white';

// ── Section card pour les champs du formulaire ────────────────────────────────
const FIELD_TYPE_ICONS = {
  title: '✏️', product_info: '🛒', summary: '📦', shipping: '🚚',
  call_schedule: '📞', urgency: '⏳', cta_button: '🔘',
  text: '✏️', phone: '📱', city_select: '🏙️',
  email: '📧', textarea: '📝', number: '🔢', date: '📅',
  whatsapp: '💬', timer: '⏱️', select: '📋', checkbox: '☑️',
};

const ICON_OPTIONS = [
  { value: 'user', label: '👤 Personne', Icon: User },
  { value: 'phone', label: '📱 Téléphone', Icon: Phone },
  { value: 'map', label: '📍 Localisation', Icon: MapPin },
  { value: 'pin', label: '📌 Adresse', Icon: MapPin },
  { value: 'mail', label: '✉️ Email', Icon: Mail },
  { value: 'cart', label: '🛒 Panier', Icon: ShoppingCart },
  { value: 'file', label: '📄 Document', Icon: FileText },
  { value: 'hash', label: '# Nombre', Icon: Hash },
  { value: 'calendar', label: '📅 Date', Icon: Calendar },
  { value: 'none', label: '❌ Aucune', Icon: null },
];

const FIELD_ICON_MAP = {
  user: User, phone: Phone, map: MapPin, pin: MapPin, mail: Mail,
  cart: ShoppingCart, file: FileText, hash: Hash, calendar: Calendar,
};

const FieldCard = ({ field, index, total, onMove, onToggle, onChange, onRemove, shopColor }) => {
  const [expanded, setExpanded] = useState(false);
  const isSpecial = field.editable === false;
  const FieldIcon = field.icon ? FIELD_ICON_MAP[field.icon] : null;
  const fallbackEmoji = FIELD_TYPE_ICONS[field.type] || '✏️';
  const iconColor = field.iconColor || shopColor || '#0F6B4F';

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${field.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
        {FieldIcon ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconColor + '20' }}>
            <FieldIcon size={15} style={{ color: iconColor }} />
          </div>
        ) : (
          <span className="text-base flex-shrink-0">{fallbackEmoji}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{field.label}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {!isSpecial && (
            <button onClick={() => setExpanded(v => !v)}
              className="p-1 rounded-lg hover:bg-gray-100 transition" title="Modifier">
              <Settings2 className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <button onClick={() => onToggle(index)}
            className="p-1 rounded-lg hover:bg-gray-100 transition" title={field.enabled ? 'Masquer' : 'Afficher'}>
            {field.enabled ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          <button onClick={() => onRemove(index)}
            className="p-1 rounded-lg hover:bg-red-50 transition" title="Supprimer">
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && !isSpecial && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
          {/* Label + placeholder */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Libellé</label>
              <input className={inputCls} value={field.label || ''}
                onChange={e => onChange(index, 'label', e.target.value)} placeholder="Nom du champ" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Placeholder</label>
              <input className={inputCls} value={field.placeholder || ''}
                onChange={e => onChange(index, 'placeholder', e.target.value)} placeholder="Texte indicatif" />
            </div>
          </div>

          {/* Toggle row: show label, show icon, required */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                checked={field.showLabel !== false}
                onChange={e => onChange(index, 'showLabel', e.target.checked)} />
              <span className="text-[11px] text-gray-600 font-medium">Afficher le label</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                checked={field.showIcon !== false}
                onChange={e => onChange(index, 'showIcon', e.target.checked)} />
              <span className="text-[11px] text-gray-600 font-medium">Afficher l'icône</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                checked={!!field.required}
                onChange={e => onChange(index, 'required', e.target.checked)} />
              <span className="text-[11px] text-gray-600 font-medium">Obligatoire</span>
            </label>
          </div>

          {/* Icon picker + icon color */}
          {field.showIcon !== false && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Icône</label>
                <select className={inputCls} value={field.icon || 'none'}
                  onChange={e => onChange(index, 'icon', e.target.value)}>
                  {ICON_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Couleur de l'icône</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={field.iconColor || shopColor || '#0F6B4F'}
                    onChange={e => onChange(index, 'iconColor', e.target.value)}
                    className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                  <input className={inputCls + ' font-mono text-[11px]'} value={field.iconColor || shopColor || '#0F6B4F'}
                    onChange={e => onChange(index, 'iconColor', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Move buttons */}
          <div className="flex items-center gap-1 pt-1">
            <button onClick={() => onMove(index, -1)} disabled={index === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronUp className="w-3 h-3" /> Monter
            </button>
            <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition">
              <ChevronDown className="w-3 h-3" /> Descendre
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom field types available to add
const CUSTOM_FIELD_TYPES = [
  { type: 'text', label: 'Champ texte', icon: '✏️', defaults: { name: 'custom_text', label: 'Champ texte', placeholder: 'Saisir...', icon: 'user', showLabel: true, showIcon: true, required: false } },
  { type: 'phone', label: 'Téléphone', icon: '📱', defaults: { name: 'custom_phone', label: 'Téléphone', placeholder: 'Numéro', icon: 'phone', showLabel: true, showIcon: true, required: true } },
  { type: 'email', label: 'Email', icon: '📧', defaults: { name: 'custom_email', label: 'Email', placeholder: 'email@exemple.com', icon: 'mail', showLabel: true, showIcon: true, required: false } },
  { type: 'textarea', label: 'Zone de texte', icon: '📝', defaults: { name: 'custom_textarea', label: 'Message', placeholder: 'Écrire ici...', icon: 'file', showLabel: true, showIcon: false, required: false } },
  { type: 'number', label: 'Nombre', icon: '🔢', defaults: { name: 'custom_number', label: 'Quantité', placeholder: '1', icon: 'hash', showLabel: true, showIcon: true, required: false } },
  { type: 'date', label: 'Date', icon: '📅', defaults: { name: 'custom_date', label: 'Date', placeholder: 'JJ/MM/AAAA', icon: 'calendar', showLabel: true, showIcon: true, required: false } },
  { type: 'select', label: 'Liste déroulante', icon: '📋', defaults: { name: 'custom_select', label: 'Choisir', placeholder: 'Sélectionner...', icon: 'none', showLabel: true, showIcon: false, required: false, options: ['Option 1', 'Option 2'] } },
  { type: 'city_select', label: 'Ville (auto)', icon: '🏙️', defaults: { name: 'custom_city', label: 'Ville', placeholder: 'Ex : Douala', icon: 'map', showLabel: true, showIcon: true, required: false } },
  { type: 'title', label: 'Titre / Slogan', icon: '✏️', defaults: { name: 'custom_title', label: 'Veuillez remplir le formulaire', type: 'title', editable: false, enabled: true } },
  { type: 'summary', label: 'Récapitulatif', icon: '📦', defaults: { name: 'custom_summary', label: 'Récapitulatif de la commande', type: 'summary', editable: false, enabled: true } },
  { type: 'urgency', label: 'Compte à rebours', icon: '⏱️', defaults: { name: 'custom_timer', label: 'Compte à rebours', editable: false, enabled: true } },
  { type: 'call_schedule', label: 'Horaire d\'appel', icon: '📞', defaults: { name: 'custom_call', label: 'Quand vous appeler ?', editable: false, enabled: true } },
];

// ── Preview du formulaire ─────────────────────────────────────────────────────
const PREVIEW_ICON_MAP = {
  user: User, phone: Phone, map: MapPin, pin: MapPin, mail: Mail,
  cart: ShoppingCart, file: FileText, hash: Hash, calendar: Calendar,
};

const FormPreview = ({ config, offersPreview = null, shopColor = '#0F6B4F' }) => {
  const fields = config.form?.fields?.filter(f => f.enabled) || [];
  const btn = config.button || {};
  const design = config.design || {};
  const btnColor = design.buttonColor || '#D94A1F';
  const btnRadius = design.borderRadius || '8px';
  const isEmbedded = config.general?.formType === 'embedded';
  const callSchedule = config.callSchedule || {};
  const urgency = config.urgency || {};

  const showOffers = offersPreview?.offersEnabled && offersPreview?.offers?.length > 0;

  const formBorderRadius = design.formBorderRadius || '12px';
  const formBorderColor = design.formBorderColor || '#e5e5e5';
  const formBorderWidth = design.formBorderWidth || '1px';
  const formShadowVal = parseInt(design.formShadow) || 0;
  const formShadow = formShadowVal > 0 ? `0 ${formShadowVal}px ${formShadowVal * 2}px rgba(0,0,0,${Math.min(formShadowVal * 0.02, 0.3).toFixed(2)})` : 'none';
  const formBgColor = design.backgroundColor || '#ffffff';
  const formTextColor = design.textColor || '#1F2937';
  const formFontSize = design.fontSize || '16px';
  const formBold = design.formBold || false;
  const formItalic = design.formItalic || false;
  const labelAlign = design.labelAlign || 'left';
  const fieldIconBg = design.fieldIconBg || '#eCe7e7';

  const renderField = (field, i) => {
    const fIconColor = field.iconColor || shopColor || design.fieldIconColor || '#9b9b9b';
    const showIcon = field.showIcon !== false;
    const IconComp = PREVIEW_ICON_MAP[field.icon];
    const borderColor = formBorderColor;
    const fieldBg = design.fieldBgColor || '#ffffff';
    const fieldTxtColor = design.fieldTextColor || '#1F2937';
    const placeholderText = (field.placeholder || field.label) + (field.required ? ' *' : '');
    const fieldRadius = formBorderRadius;

    switch (field.type) {
      case 'title':
        return (
          <div key={i} className="font-bold py-1" style={{
            color: formTextColor, fontSize: formFontSize, textAlign: labelAlign,
            fontWeight: formBold ? 'bold' : '600', fontStyle: formItalic ? 'italic' : 'normal'
          }}>
            {field.label}
          </div>
        );
      case 'product_info':
        return (
          <div key={i} className="flex items-center gap-3 rounded-xl p-3 border" style={{ backgroundColor: shopColor + '10', borderColor: shopColor + '30' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: shopColor + '20' }}>
              <ShoppingCart className="w-6 h-6" style={{ color: shopColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400">Variante</p>
              <p className="text-sm font-bold text-gray-900 underline">Nom du produit</p>
            </div>
            <span className="text-sm font-bold text-gray-900">19.99FCFA</span>
          </div>
        );
      case 'summary':
        return null;
      case 'shipping':
        return (
          <div key={i} className="flex items-center gap-2 py-1.5">
            <ShoppingCart size={16} className="text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold text-emerald-600">Paiement à la livraison</span>
            <span className="text-xs text-gray-500">— vous payez à la réception</span>
          </div>
        );
      case 'textarea':
        return (
          <div key={i} className="border flex items-start gap-0 overflow-hidden"
            style={{ borderColor, backgroundColor: fieldBg, borderRadius: fieldRadius, borderWidth: formBorderWidth }}>
            {showIcon && IconComp && (
              <div className="flex items-start justify-center pl-3 pt-3 flex-shrink-0"
                style={{ backgroundColor: fieldIconBg, borderRadius: `${fieldRadius} 0 0 ${fieldRadius}` }}>
                <IconComp size={18} style={{ color: fIconColor }} />
              </div>
            )}
            <div className="flex-1 h-20 px-3 py-3 flex items-start">
              <span className="text-sm" style={{ color: '#9ca3af' }}>{placeholderText}</span>
            </div>
          </div>
        );
      case 'city_select': {
        return (
          <div key={i} className="border h-12 flex items-center gap-0 overflow-hidden"
            style={{ borderColor, backgroundColor: fieldBg, borderRadius: fieldRadius, borderWidth: formBorderWidth }}>
            {showIcon && (
              <div className="flex items-center justify-center px-3 h-full flex-shrink-0"
                style={{ backgroundColor: fieldIconBg }}>
                <MapPin size={18} style={{ color: fIconColor }} />
              </div>
            )}
            <div className="flex-1 px-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: '#9ca3af' }}>{placeholderText}</span>
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            </div>
          </div>
        );
      }
      case 'select':
        return (
          <div key={i} className="border h-12 flex items-center gap-0 overflow-hidden"
            style={{ borderColor, backgroundColor: fieldBg, borderRadius: fieldRadius, borderWidth: formBorderWidth }}>
            {showIcon && IconComp && (
              <div className="flex items-center justify-center px-3 h-full flex-shrink-0"
                style={{ backgroundColor: fieldIconBg }}>
                <IconComp size={18} style={{ color: fIconColor }} />
              </div>
            )}
            <div className="flex-1 px-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: '#9ca3af' }}>{placeholderText}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        );
      case 'call_schedule':
        return callSchedule.enabled !== false ? (
          <div key={i} className="space-y-2.5 pt-1">
            <p className="text-xs font-bold" style={{ color: design.textColor || '#1f2937' }}>
              {callSchedule.question || field.label}
            </p>
            <div className="space-y-2">
              {(callSchedule.options || []).map((opt, j) => (
                <label key={j} className="flex items-center gap-2.5 text-xs cursor-pointer"
                  style={{ color: design.textColor || '#4b5563' }}>
                  <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        ) : null;
      case 'urgency':
        return urgency.enabled !== false ? (
          <div key={i} className="rounded-xl p-3 text-xs text-white" style={{ backgroundColor: btnColor }}>
            <p className="leading-relaxed">
              {urgency.text || 'Stock presque épuisé. La promotion se termine bientôt.'}
            </p>
            {urgency.countdown && (
              <span className="inline-block mt-1 font-mono font-bold text-sm bg-white/20 px-2 py-0.5 rounded">
                {String(urgency.countdownMinutes || 15).padStart(2, '0')}:47
              </span>
            )}
          </div>
        ) : null;
      case 'cta_button':
        return (
          <button key={i}
            className="w-full py-3.5 font-bold flex items-center justify-center gap-2"
            style={{
              backgroundColor: btnColor,
              borderRadius: btnRadius,
              color: design.buttonTextColor || '#ffffff',
              fontWeight: 'bold',
              fontStyle: design.buttonItalic ? 'italic' : 'normal',
              fontSize: design.buttonFontSize || '16px',
            }}
          >
            {showIcon && <ShoppingCart size={18} />}
            <span>{field.label || btn.text || 'Commander'}</span>
          </button>
        );
      default: {
        return (
          <div key={i} className="border h-12 flex items-center gap-0 overflow-hidden"
            style={{ borderColor, backgroundColor: fieldBg, borderRadius: fieldRadius, borderWidth: formBorderWidth }}>
            {showIcon && IconComp && (
              <div className="flex items-center justify-center px-3 h-full flex-shrink-0"
                style={{ backgroundColor: fieldIconBg }}>
                <IconComp size={18} style={{ color: fIconColor }} />
              </div>
            )}
            <div className="flex-1 px-3 flex items-center"
              style={{ color: fieldTxtColor }}>
              <span className="text-sm" style={{ color: '#9ca3af' }}>{placeholderText}</span>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="overflow-hidden" style={{
      backgroundColor: formBgColor, borderRadius: formBorderRadius,
      border: `${formBorderWidth} solid ${formBorderColor}`, boxShadow: formShadow,
    }}>
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: formBorderColor, backgroundColor: formBgColor === '#ffffff' ? '#f9fafb' : formBgColor }}>
        <span className="text-sm font-bold" style={{ color: formTextColor }}>
          {isEmbedded ? 'Formulaire intégré' : 'Aperçu en direct:'}
        </span>
        <span className="text-gray-400 text-lg cursor-pointer">×</span>
      </div>

      <div className="p-5 space-y-3" style={{ backgroundColor: formBgColor }}>
        {/* Offres quantité — avant les champs */}
        {showOffers && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Choisissez votre offre</p>
            <div className="space-y-1.5">
              {offersPreview.offers.map((offer, i) => (
                <OfferPreviewCard
                  key={i}
                  offer={offer}
                  basePrice={offersPreview.basePrice}
                  currency={offersPreview.currency}
                  accentColor={offersPreview.accentColor}
                  selected={offersPreview.selectedIdx === i}
                  onClick={() => offersPreview.setSelectedIdx(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Champs */}
        <div className="space-y-2.5">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-2">Aucun champ activé</p>
          ) : fields.map((field, i) => renderField(field, i))}
        </div>
      </div>
    </div>
  );
};

const fmtPrice = (n, cur = 'XAF') => n ? `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} ${cur}` : '—';

// ── Aperçu d'une offre (identique au rendu boutique) ─────────────────────────
const OfferPreviewCard = ({ offer, basePrice, currency, accentColor, selected, onClick }) => {
  const displayPrice = offer.price > 0 ? offer.price : basePrice * (offer.qty || 1);
  const displayCompare = offer.comparePrice > 0 ? offer.comparePrice : 0;
  const disc = displayCompare > displayPrice && displayPrice > 0
    ? Math.round((1 - displayPrice / displayCompare) * 100) : 0;
  const color = accentColor || '#0F6B4F';

  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
      border: selected ? `2px solid ${color}` : '1.5px solid #E5E7EB',
      backgroundColor: selected ? `${color}0d` : '#fff',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all 0.15s ease', boxShadow: selected ? `0 0 0 3px ${color}22` : 'none',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: selected ? `5px solid ${color}` : '2px solid #D1D5DB',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}</span>
          {offer.badge && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', backgroundColor: color, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.02em' }}>
              {offer.badge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color }}>{fmtPrice(displayPrice, currency)}</span>
          {disc > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmtPrice(displayCompare, currency)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: '#FEE2E2', padding: '1px 5px', borderRadius: 8 }}>-{disc}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Page principale ───────────────────────────────────────────────────────────
const BoutiqueFormBuilder = () => {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [offersPreviewData, setOffersPreviewData] = useState(null);
  const [offersPreviewSelected, setOffersPreviewSelected] = useState(0);
  const [buttonSectionOpen, setButtonSectionOpen] = useState(true);
  const [addFieldMenuOpen, setAddFieldMenuOpen] = useState(false);
  const [shopColor, setShopColor] = useState('#0F6B4F');
  const { activeStore } = useStore();
  const storeSubdomain = activeStore?.subdomain || '';

  useEffect(() => {
    (async () => {
      try {
        const [configRes, productsRes] = await Promise.all([
          storeManageApi.getStoreConfig(),
          storeProductsApi.getProducts({ limit: 200 }).catch(() => null),
        ]);
        const raw = configRes.data?.data || configRes.data || {};
        const ppc = raw.storeSettings?.productPageConfig || raw.productPageConfig || null;
        setShopColor(raw.storeSettings?.storeThemeColor || raw.storeTheme?.primaryColor || '#0F6B4F');
        setConfig(mergeWithDefaults(ppc));
        const prods = productsRes?.data?.data?.products || productsRes?.data?.data || productsRes?.data?.products || [];
        setProducts(Array.isArray(prods) ? prods : []);
      } catch {
        setConfig(mergeWithDefaults(null));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await storeManageApi.getStoreConfig();
      const raw = res.data?.data || res.data || {};
      const existing = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
      await storeManageApi.updateStoreConfig({ productPageConfig: { ...existing, ...config } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const update = useCallback((updater) => {
    setConfig(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    setSaved(false);
  }, []);

  // Champs handlers
  const moveField = (index, dir) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= config.form.fields.length) return;
    const next = [...config.form.fields];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const toggleField = (index) => {
    const next = config.form.fields.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const changeField = (index, key, val) => {
    const next = config.form.fields.map((f, i) => i === index ? { ...f, [key]: val } : f);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const addField = (fieldDef) => {
    const newField = fieldDef
      ? { ...fieldDef.defaults, name: `${fieldDef.defaults.name}_${Date.now()}`, type: fieldDef.type, enabled: true }
      : { name: `champ_${Date.now()}`, label: 'Nouveau champ', type: 'text', enabled: true, icon: 'user', showLabel: true, showIcon: true, required: false, placeholder: 'Saisir...' };
    const next = [...config.form.fields, newField];
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const removeField = (index) => {
    const next = config.form.fields.filter((_, i) => i !== index);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-emerald-500" />
        </div>
        <span className="text-sm font-medium text-gray-500">Chargement…</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <ShoppingCart size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Créateur de formulaire</h1>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Personnalise le formulaire de commande de ta boutique</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {storeSubdomain && (
                <a href={`https://${storeSubdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition">
                  <Eye size={14} /> Voir la boutique
                </a>
              )}
              <button onClick={handleSave} disabled={saving}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  saved ? 'bg-green-500 shadow-green-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Sauvegarde…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Type de formulaire */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Type de formulaire</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'popup', label: 'Formulaire sous forme de pop-up' },
              { id: 'embedded', label: 'Formulaire intégré' },
            ].map(opt => {
              const sel = (config.general?.formType || 'popup') === opt.id;
              return (
                <button key={opt.id} onClick={() => update(c => ({ ...c, general: { ...c.general, formType: opt.id } }))}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${sel ? 'border-gray-800 bg-gray-800' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className={`flex items-center gap-2 mb-3 ${sel ? 'text-white' : 'text-gray-400'}`}>
                    {opt.id === 'popup' ? (
                      <>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <Settings2 size={20} />
                        </div>
                        <div className="flex gap-1">
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <Layers size={11} />
                          </div>
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <Settings2 size={11} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-7 h-7 rounded flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <User size={13} />
                        </div>
                        <div className={`w-7 h-7 rounded flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <Layers size={13} />
                        </div>
                        <div className={`w-7 h-7 rounded flex items-center justify-center ${sel ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <Settings2 size={13} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`font-bold text-sm ${sel ? 'text-white' : 'text-gray-900'}`}>{opt.label}</div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            {(config.general?.formType || 'popup') === 'popup'
              ? 'Le formulaire s\'ouvrira lorsque le client cliquera sur le bouton Acheter de l\'application.'
              : 'Le formulaire est affiché directement dans la page produit.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Panel gauche: éditeur (tout en scroll) ── */}
          <div className="space-y-6">

            {/* ─── Bouton d'achat (popup uniquement) ─── */}
            {(config.general?.formType || 'popup') === 'popup' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setButtonSectionOpen(v => !v)}>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Bouton d'achat</h3>
                  <p className="text-[11px] text-gray-400">Le bouton qui ouvre le formulaire</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  {buttonSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Aperçu
                </span>
              </div>
              {buttonSectionOpen && (<>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Texte du bouton</label>
                  <input className={inputCls} value={config.button?.text || ''}
                    onChange={e => update(c => ({ ...c, button: { ...c.button, text: e.target.value } }))}
                    placeholder="COMMANDER MAINTENANT" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Sous-titre du bouton</label>
                  <input className={inputCls} value={config.button?.subtext || ''}
                    onChange={e => update(c => ({ ...c, button: { ...c.button, subtext: e.target.value } }))}
                    placeholder="Il n'y a plus assez de pièces" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.buttonTextColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonTextColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.buttonTextColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonTextColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Taille du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="10" max="30" className={inputCls + ' text-center'}
                      value={parseInt(config.design?.buttonFontSize) || 16}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonFontSize: `${e.target.value}px` } }))} />
                    <span className="text-[11px] text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Style</label>
                  <div className="flex gap-1">
                    <button className={`px-3 py-2 rounded-lg border text-xs font-bold transition ${config.design?.buttonBold ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      onClick={() => update(c => ({ ...c, design: { ...c.design, buttonBold: !c.design?.buttonBold } }))}>B</button>
                    <button className={`px-3 py-2 rounded-lg border text-xs italic transition ${config.design?.buttonItalic ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      onClick={() => update(c => ({ ...c, design: { ...c.design, buttonItalic: !c.design?.buttonItalic } }))}>I</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de l'arrière plan</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.buttonColor || '#007122'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.buttonColor || '#007122'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Animation</label>
                  <select className={inputCls} value={config.button?.animation || 'none'}
                    onChange={e => update(c => ({ ...c, button: { ...c.button, animation: e.target.value } }))}>
                    <option value="none">None</option>
                    <option value="pulse">Pulse</option>
                    <option value="bounce">Bounce</option>
                    <option value="shake">Shake</option>
                    <option value="glow">Glow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Icône du bouton</label>
                  <select className={inputCls} value={config.button?.icon || 'cart'}
                    onChange={e => update(c => ({ ...c, button: { ...c.button, icon: e.target.value } }))}>
                    <option value="arrow">→ Changer d'icône</option>
                    <option value="cart">🛒 Panier</option>
                    <option value="bag">🛍️ Sac</option>
                    <option value="check">✓ Valider</option>
                    <option value="none">Aucune icône</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de la bordure</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.buttonBorderColor || '#1beca7'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonBorderColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.buttonBorderColor || '#1beca7'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, buttonBorderColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Largeur de la bordure</label>
                  <input type="range" min="0" max="6" className="w-full mt-2"
                    value={parseInt(config.design?.buttonBorderWidth) || 0}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, buttonBorderWidth: `${e.target.value}px` } }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Coins arrondis</label>
                  <input type="range" min="0" max="40" className="w-full"
                    value={parseInt(config.design?.borderRadius) || 8}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, borderRadius: `${e.target.value}px` } }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ombre</label>
                  <input type="range" min="0" max="30" className="w-full"
                    value={parseInt(config.design?.buttonShadow) || 0}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, buttonShadow: `${e.target.value}` } }))} />
                </div>
              </div>
              </>)}
            </div>
            )}

            {/* ─── Sélectionner les pays ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">Sélectionner les pays du formulaire</h3>
              <input className={inputCls} placeholder="🔍 Sélectionner les pays"
                value={config.general?.countries?.join(', ') || ''}
                onChange={e => update(c => ({ ...c, general: { ...c.general, countries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} />
              {config.general?.countries?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {config.general.countries.map((country, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-xs font-medium text-gray-700 rounded-lg">
                      {country}
                      <button onClick={() => {
                        const next = config.general.countries.filter((_, idx) => idx !== i);
                        update(c => ({ ...c, general: { ...c.general, countries: next } }));
                      }} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Formulaire (champs) ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-gray-800">Formulaire</h3>
                <span className="text-xs text-gray-400">
                  {config.form.fields.filter(f => f.enabled).length}/{config.form.fields.length} actifs
                </span>
              </div>
              <div className="space-y-2">
                {config.form.fields.map((field, idx) => (
                  <FieldCard
                    key={field.name + idx}
                    field={field}
                    index={idx}
                    total={config.form.fields.length}
                    onMove={moveField}
                    onToggle={toggleField}
                    onChange={changeField}
                    onRemove={removeField}
                    shopColor={shopColor}
                  />
                ))}
              </div>

              {/* Add field button + dropdown */}
              <div className="relative">
                <button onClick={() => setAddFieldMenuOpen(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition">
                  <Plus size={14} /> Ajouter un champ
                </button>
                {addFieldMenuOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 max-h-64 overflow-y-auto">
                    {CUSTOM_FIELD_TYPES.map(ft => (
                      <button key={ft.type + ft.defaults.name}
                        onClick={() => { addField(ft); setAddFieldMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition text-sm">
                        <span className="text-base">{ft.icon}</span>
                        <span className="font-medium text-gray-700">{ft.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Modèles ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Modèles</h3>
                <button onClick={() => update(_ => mergeWithDefaults(null))}
                  className="text-[11px] text-gray-400 hover:text-gray-600 font-medium">Restaurer les valeurs par défaut</button>
              </div>
              <div className="flex gap-1.5 mb-3">
                {['All', 'Clean', 'Dark', 'Ocean', 'Orange', 'Rose', 'Green'].map(t => (
                  <button key={t} className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { name: 'Sunset Glow', colors: ['#f97316', '#fb923c', '#fdba74'] },
                  { name: 'Ocean Breeze', colors: ['#0ea5e9', '#38bdf8', '#7dd3fc'] },
                  { name: 'Midnight Luxe', colors: ['#1e1b4b', '#312e81', '#4338ca'] },
                  { name: 'Rose Petal', colors: ['#e11d48', '#f43f5e', '#fb7185'] },
                  { name: 'Forest Mint', colors: ['#047857', '#059669', '#34d399'] },
                ].map(theme => (
                  <button key={theme.name}
                    onClick={() => update(c => ({ ...c, design: { ...c.design, buttonColor: theme.colors[0], backgroundColor: theme.colors[2] } }))}
                    className="group text-center">
                    <div className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-1.5 border border-gray-200 group-hover:border-emerald-400 transition"
                      style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]}, ${theme.colors[2]})` }} />
                    <span className="text-[10px] text-gray-500">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Style de formulaire ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Style de formulaire</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.textColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, textColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.textColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, textColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Taille du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="10" max="24" className={inputCls + ' text-center'}
                      value={parseInt(config.design?.fontSize) || 16}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fontSize: `${e.target.value}px` } }))} />
                    <span className="text-[11px] text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Style</label>
                  <div className="flex gap-1">
                    <button className={`px-3 py-2 rounded-lg border text-xs font-bold transition ${config.design?.formBold ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      onClick={() => update(c => ({ ...c, design: { ...c.design, formBold: !c.design?.formBold } }))}>B</button>
                    <button className={`px-3 py-2 rounded-lg border text-xs italic transition ${config.design?.formItalic ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      onClick={() => update(c => ({ ...c, design: { ...c.design, formItalic: !c.design?.formItalic } }))}>I</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Alignement des étiquettes</label>
                  <div className="flex gap-1">
                    {['left', 'center', 'right'].map(a => (
                      <button key={a}
                        className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition ${(config.design?.labelAlign || 'left') === a ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        onClick={() => update(c => ({ ...c, design: { ...c.design, labelAlign: a } }))}>
                        {a === 'left' ? '⫷' : a === 'center' ? '···' : '⫸'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de l'arrière plan</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.backgroundColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, backgroundColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.backgroundColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, backgroundColor: e.target.value } }))} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de la bordure</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.formBorderColor || '#e5e5e5'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formBorderColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.formBorderColor || '#e5e5e5'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formBorderColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Largeur de la bordure</label>
                  <input type="range" min="0" max="6" className="w-full mt-2"
                    value={parseInt(config.design?.formBorderWidth) || 1}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, formBorderWidth: `${e.target.value}px` } }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Coins arrondis</label>
                  <input type="range" min="0" max="30" className="w-full"
                    value={parseInt(config.design?.formBorderRadius) || 12}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, formBorderRadius: `${e.target.value}px` } }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ombre</label>
                  <input type="range" min="0" max="30" className="w-full"
                    value={parseInt(config.design?.formShadow) || 0}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, formShadow: `${e.target.value}` } }))} />
                </div>
              </div>
            </div>

            {/* ─── Style de champ ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Style de champ</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.fieldTextColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldTextColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.fieldTextColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldTextColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de l'arrière plan</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.fieldBgColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldBgColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.fieldBgColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldBgColor: e.target.value } }))} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur de l'icône</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.fieldIconColor || '#9b9b9b'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldIconColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.fieldIconColor || '#9b9b9b'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldIconColor: e.target.value } }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Fond de l'icône</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.fieldIconBg || '#eCe7e7'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldIconBg: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.fieldIconBg || '#eCe7e7'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, fieldIconBg: e.target.value } }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Panel droit: aperçu en direct ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-600">Aperçu en direct:</span>
            </div>
            <div className="sticky top-[7.5rem]">
              <FormPreview
                config={config}
                shopColor={shopColor}
                offersPreview={offersPreviewData ? {
                  ...offersPreviewData,
                  selectedIdx: offersPreviewSelected,
                  setSelectedIdx: setOffersPreviewSelected,
                } : null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoutiqueFormBuilder;
