import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, GripVertical, Eye, EyeOff, Plus, ChevronUp, ChevronDown, Settings2, ShoppingCart, Layers, Phone, User, MapPin, Trash2, Mail, FileText, Hash, Calendar, Type, Image, Minus, Shield, CheckCircle, Clock, PhoneCall, MessageSquare, ListOrdered, CheckSquare, Link2, Globe, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { storeManageApi, storeProductsApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';
import defaultConfig from '../components/productSettings/defaultConfig.js';
import { PHONE_CODES } from '../utils/phoneCodes.js';

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
  title: Type, product_info: ShoppingCart, summary: ShoppingCart, shipping: Globe,
  call_schedule: PhoneCall, urgency: Clock, cta_button: CheckCircle,
  text: Type, phone: Phone, city_select: MapPin,
  email: Mail, textarea: MessageSquare, number: Hash, date: Calendar,
  whatsapp: MessageSquare, timer: Clock, select: ListOrdered, checkbox: CheckSquare,
  radio: CheckCircle, address: MapPin, consent: Shield, html: FileText,
  image: Image, divider: Minus, trust_badge: Shield, guarantee: CheckCircle,
  testimonials: Star, country: Globe,
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

const FieldCard = ({ field, index, total, onMove, onToggle, onChange, onRemove, shopColor, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, isDragging }) => {
  const [expanded, setExpanded] = useState(false);
  const isSpecial = false; // All fields are now editable
  const FieldIcon = field.icon ? FIELD_ICON_MAP[field.icon] : null;
  const FallbackIcon = FIELD_TYPE_ICONS[field.type] || Type;
  const iconColor = field.iconColor || shopColor || '#0F6B4F';

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(index); }}
      onDrop={e => { e.preventDefault(); onDrop(index); }}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl border-2 transition-all ${isDragOver ? 'border-emerald-400 shadow-lg scale-[1.02]' : field.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
        {FieldIcon ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconColor + '20' }}>
            <FieldIcon size={15} style={{ color: iconColor }} />
          </div>
        ) : (
          <FallbackIcon size={16} className="text-gray-500 flex-shrink-0" />
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
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
          {/* Label + placeholder (for input types) */}
          {!['divider', 'image'].includes(field.type) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Libellé</label>
              <input className={inputCls} value={field.label || ''}
                onChange={e => onChange(index, 'label', e.target.value)} placeholder="Nom du champ" />
            </div>
            {!['title', 'html', 'summary', 'urgency', 'call_schedule', 'trust_badge', 'guarantee', 'consent', 'divider'].includes(field.type) && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Placeholder</label>
              <input className={inputCls} value={field.placeholder || ''}
                onChange={e => onChange(index, 'placeholder', e.target.value)} placeholder="Texte indicatif" />
            </div>
            )}
          </div>
          )}

          {/* ── Type-specific editors ── */}

          {/* HTML content */}
          {field.type === 'html' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Code HTML</label>
              <textarea className={inputCls + ' font-mono text-[11px]'} rows={5}
                value={field.htmlContent || ''}
                onChange={e => onChange(index, 'htmlContent', e.target.value)}
                placeholder="<p>Votre contenu HTML ici</p>" />
            </div>
          )}

          {/* Image URL + Upload */}
          {field.type === 'image' && (
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Image</label>
              <div className="flex gap-2">
                <input className={inputCls + ' flex-1'} value={field.imageUrl || ''}
                  onChange={e => onChange(index, 'imageUrl', e.target.value)}
                  placeholder="https://exemple.com/image.jpg" />
                <label className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-lg border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition shrink-0">
                  {field._uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Upload
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      onChange(index, '_uploading', true);
                      try {
                        const res = await storeProductsApi.uploadImages([file]);
                        const urls = res.data?.urls || res.data?.images || [];
                        if (urls.length > 0) {
                          onChange(index, 'imageUrl', urls[0]);
                        }
                      } catch (err) {
                        console.error('Upload failed:', err);
                      }
                      onChange(index, '_uploading', false);
                      e.target.value = '';
                    }} />
                </label>
              </div>
              {field.imageUrl && (
                <img src={field.imageUrl} alt="Aperçu" className="rounded-lg max-h-32 object-contain border border-gray-200" />
              )}
            </div>
          )}

          {/* Options for select, radio, checkbox */}
          {['select', 'radio', 'checkbox'].includes(field.type) && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Options (une par ligne)</label>
              <textarea className={inputCls + ' text-[11px]'} rows={4}
                value={(field.options || []).join('\n')}
                onChange={e => onChange(index, 'options', e.target.value.split('\n'))}
                placeholder="Option 1&#10;Option 2&#10;Option 3" />
            </div>
          )}

          {/* Consent text */}
          {field.type === 'consent' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Texte du consentement</label>
              <input className={inputCls} value={field.label || ''}
                onChange={e => onChange(index, 'label', e.target.value)}
                placeholder="J'accepte les conditions générales" />
            </div>
          )}

          {/* Trust badge / Guarantee text */}
          {['trust_badge', 'guarantee'].includes(field.type) && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Texte affiché</label>
              <input className={inputCls} value={field.label || ''}
                onChange={e => onChange(index, 'label', e.target.value)}
                placeholder={field.type === 'trust_badge' ? 'Paiement sécurisé' : 'Satisfait ou remboursé'} />
            </div>
          )}

          {/* Urgency countdown settings */}
          {field.type === 'urgency' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Texte d'urgence</label>
                <input className={inputCls} value={field.urgencyText || ''}
                  onChange={e => onChange(index, 'urgencyText', e.target.value)}
                  placeholder="Stock presque épuisé !" />
              </div>

              {/* Style */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Style</label>
                <div className="flex gap-1.5">
                  {[{ v: 'banner', l: 'Bannière' }, { v: 'bar', l: 'Barre' }, { v: 'floating', l: 'Flottant' }].map(s => (
                    <button key={s.v} type="button"
                      onClick={() => onChange(index, 'urgencyStyle', s.v)}
                      className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition ${(field.urgencyStyle || 'banner') === s.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Couleur de fond</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                      value={field.urgencyBgColor || '#ef4444'}
                      onChange={e => onChange(index, 'urgencyBgColor', e.target.value)} />
                    <input className={inputCls + ' text-[10px] flex-1'} value={field.urgencyBgColor || '#ef4444'}
                      onChange={e => onChange(index, 'urgencyBgColor', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Couleur du texte</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                      value={field.urgencyTextColor || '#ffffff'}
                      onChange={e => onChange(index, 'urgencyTextColor', e.target.value)} />
                    <input className={inputCls + ' text-[10px] flex-1'} value={field.urgencyTextColor || '#ffffff'}
                      onChange={e => onChange(index, 'urgencyTextColor', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Border radius */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Arrondi (px)</label>
                <input type="range" min="0" max="24" className="w-full accent-emerald-600"
                  value={parseInt(field.urgencyRadius || 12)}
                  onChange={e => onChange(index, 'urgencyRadius', e.target.value + 'px')} />
                <span className="text-[10px] text-gray-400">{field.urgencyRadius || '12px'}</span>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Icône</label>
                <div className="flex gap-1.5">
                  {[{ v: 'fire', l: '🔥' }, { v: 'warning', l: '⚠️' }, { v: 'clock', l: '⏰' }, { v: 'bolt', l: '⚡' }, { v: 'none', l: '❌' }].map(ic => (
                    <button key={ic.v} type="button"
                      onClick={() => onChange(index, 'urgencyIcon', ic.v)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border text-sm transition ${(field.urgencyIcon || 'fire') === ic.v ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      {ic.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Animation */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1">Animation</label>
                <select className={inputCls + ' text-[11px]'}
                  value={field.urgencyAnimation || 'pulse'}
                  onChange={e => onChange(index, 'urgencyAnimation', e.target.value)}>
                  <option value="none">Aucune</option>
                  <option value="pulse">Pulsation</option>
                  <option value="shake">Secousse</option>
                  <option value="glow">Brillance</option>
                </select>
              </div>

              {/* Countdown */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                    checked={field.showCountdown !== false}
                    onChange={e => onChange(index, 'showCountdown', e.target.checked)} />
                  <span className="text-[11px] text-gray-600 font-medium">Compte à rebours</span>
                </label>
                <div>
                  <input type="number" min="1" max="120" className={inputCls + ' text-center text-[11px]'}
                    value={field.countdownMinutes || 15}
                    onChange={e => onChange(index, 'countdownMinutes', parseInt(e.target.value))} />
                  <span className="text-[10px] text-gray-400 ml-1">minutes</span>
                </div>
              </div>

              {/* Countdown label text */}
              {field.showCountdown !== false && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Texte du compteur</label>
                  <input className={inputCls} value={field.countdownText || ''}
                    onChange={e => onChange(index, 'countdownText', e.target.value)}
                    placeholder="Offre expire dans :" />
                </div>
              )}

              {/* Progress bar */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                  checked={field.showProgressBar === true}
                  onChange={e => onChange(index, 'showProgressBar', e.target.checked)} />
                <span className="text-[11px] text-gray-600 font-medium">Barre de progression</span>
              </label>
            </div>
          )}

          {/* Testimonials editor */}
          {field.type === 'testimonials' && (
            <div className="space-y-3">
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Témoignages</label>
              {(field.testimonials || []).map((t, ti) => (
                <div key={ti} className="border border-gray-200 rounded-lg p-2.5 space-y-2 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500">#{ti + 1}</span>
                    <button type="button" onClick={() => {
                      const arr = [...(field.testimonials || [])];
                      arr.splice(ti, 1);
                      onChange(index, 'testimonials', arr);
                    }} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <input className={inputCls + ' text-[11px]'} placeholder="Nom" value={t.name || ''}
                    onChange={e => {
                      const arr = [...(field.testimonials || [])];
                      arr[ti] = { ...arr[ti], name: e.target.value };
                      onChange(index, 'testimonials', arr);
                    }} />
                  <textarea className={inputCls + ' text-[11px]'} rows={2} placeholder="Témoignage..." value={t.text || ''}
                    onChange={e => {
                      const arr = [...(field.testimonials || [])];
                      arr[ti] = { ...arr[ti], text: e.target.value };
                      onChange(index, 'testimonials', arr);
                    }} />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 mr-1">Note :</span>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => {
                        const arr = [...(field.testimonials || [])];
                        arr[ti] = { ...arr[ti], rating: s };
                        onChange(index, 'testimonials', arr);
                      }}>
                        <Star size={14} className={s <= (t.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => {
                const arr = [...(field.testimonials || []), { name: '', text: '', rating: 5 }];
                onChange(index, 'testimonials', arr);
              }} className="w-full py-1.5 border border-dashed border-gray-300 rounded-lg text-[11px] text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
                <Plus size={12} /> Ajouter un témoignage
              </button>

              {/* Auto-scroll */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="rounded accent-emerald-600 w-3.5 h-3.5"
                  checked={field.autoScroll !== false}
                  onChange={e => onChange(index, 'autoScroll', e.target.checked)} />
                <span className="text-[11px] text-gray-600 font-medium">Défilement automatique</span>
              </label>
            </div>
          )}

          {/* Call schedule options */}
          {field.type === 'call_schedule' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Options horaires (une par ligne)</label>
              <textarea className={inputCls + ' text-[11px]'} rows={4}
                value={(field.scheduleOptions || ['Matin (8h-12h)', 'Après-midi (12h-17h)', 'Soir (17h-20h)']).join('\n')}
                onChange={e => onChange(index, 'scheduleOptions', e.target.value.split('\n'))}
                placeholder="Matin (8h-12h)&#10;Après-midi (12h-17h)&#10;Soir (17h-20h)" />
            </div>
          )}

          {/* Toggle row: show label, show icon, required */}
          {!['divider', 'html', 'image', 'trust_badge', 'guarantee'].includes(field.type) && (
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
          )}

          {/* City auto mode toggle */}
          {field.type === 'city_select' && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-[11px] text-blue-700 font-semibold">Mode ville :</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="radio" name={`city_mode_${index}`} className="accent-emerald-600 w-3.5 h-3.5"
                  checked={field.cityAuto !== false}
                  onChange={() => onChange(index, 'cityAuto', true)} />
                <span className="text-[11px] text-gray-700 font-medium">Auto (liste déroulante)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="radio" name={`city_mode_${index}`} className="accent-emerald-600 w-3.5 h-3.5"
                  checked={field.cityAuto === false}
                  onChange={() => onChange(index, 'cityAuto', false)} />
                <span className="text-[11px] text-gray-700 font-medium">Manuel (saisie libre)</span>
              </label>
            </div>
          )}

          {/* Icon picker + icon color */}
          {field.showIcon !== false && !['divider', 'html', 'image', 'consent', 'trust_badge', 'guarantee', 'title', 'summary'].includes(field.type) && (
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
  // ── Entrées ──
  { category: 'Entrées', type: 'text', label: 'Champ texte', Icon: Type, defaults: { name: 'custom_text', label: 'Champ texte', placeholder: 'Saisir...', icon: 'user', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'phone', label: 'Téléphone', Icon: Phone, defaults: { name: 'custom_phone', label: 'Téléphone', placeholder: 'Numéro', icon: 'phone', showLabel: true, showIcon: true, required: true } },
  { category: 'Entrées', type: 'email', label: 'Email', Icon: Mail, defaults: { name: 'custom_email', label: 'Email', placeholder: 'email@exemple.com', icon: 'mail', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'textarea', label: 'Saisie multi-lignes', Icon: MessageSquare, defaults: { name: 'custom_textarea', label: 'Message', placeholder: 'Écrire ici...', icon: 'file', showLabel: true, showIcon: false, required: false } },
  { category: 'Entrées', type: 'number', label: 'Nombre', Icon: Hash, defaults: { name: 'custom_number', label: 'Quantité', placeholder: '1', icon: 'hash', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'date', label: 'Saisie des dates', Icon: Calendar, defaults: { name: 'custom_date', label: 'Date', placeholder: 'JJ/MM/AAAA', icon: 'calendar', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'select', label: 'Liste de sélection', Icon: ListOrdered, defaults: { name: 'custom_select', label: 'Choisir', placeholder: 'Sélectionner...', icon: 'none', showLabel: true, showIcon: false, required: false, options: ['Option 1', 'Option 2'] } },
  { category: 'Entrées', type: 'radio', label: 'Choix unique', Icon: CheckCircle, defaults: { name: 'custom_radio', label: 'Choisir une option', showLabel: true, showIcon: false, required: false, options: ['Option 1', 'Option 2'] } },
  { category: 'Entrées', type: 'checkbox', label: 'Choix multiples', Icon: CheckSquare, defaults: { name: 'custom_checkbox', label: 'Sélectionner', showLabel: true, showIcon: false, required: false, options: ['Option 1', 'Option 2'] } },
  { category: 'Entrées', type: 'city_select', label: 'Ville', Icon: MapPin, defaults: { name: 'custom_city', label: 'Ville', placeholder: 'Ex : Douala', icon: 'map', showLabel: true, showIcon: true, required: false, cityAuto: false } },
  { category: 'Entrées', type: 'address', label: 'Adresse complète', Icon: MapPin, defaults: { name: 'custom_address', label: 'Adresse', placeholder: 'Rue, quartier...', icon: 'pin', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'country', label: 'Pays', Icon: Globe, defaults: { name: 'custom_country', label: 'Pays', placeholder: 'Sélectionner un pays', icon: 'map', showLabel: true, showIcon: true, required: false } },
  { category: 'Entrées', type: 'consent', label: 'Consentement / CGV', Icon: Shield, defaults: { name: 'custom_consent', label: 'J\'accepte les conditions générales', type: 'consent', showLabel: true, showIcon: false, required: true } },

  // ── Contenu ──
  { category: 'Contenu', type: 'title', label: 'Titre / Texte', Icon: Type, defaults: { name: 'custom_title', label: 'Veuillez remplir le formulaire', type: 'title', editable: false, enabled: true } },
  { category: 'Contenu', type: 'html', label: 'Texte / HTML', Icon: FileText, defaults: { name: 'custom_html', label: 'Contenu HTML', type: 'html', htmlContent: '<p>Votre texte ici</p>', editable: false, enabled: true } },
  { category: 'Contenu', type: 'image', label: 'Image', Icon: Image, defaults: { name: 'custom_image', label: 'Image', type: 'image', imageUrl: '', editable: false, enabled: true } },
  { category: 'Contenu', type: 'divider', label: 'Séparateur', Icon: Minus, defaults: { name: 'custom_divider', label: 'Séparateur', type: 'divider', editable: false, enabled: true } },
  { category: 'Contenu', type: 'summary', label: 'Récapitulatif', Icon: ShoppingCart, defaults: { name: 'custom_summary', label: 'Récapitulatif de la commande', type: 'summary', editable: false, enabled: true } },

  // ── Conversion ──
  { category: 'Conversion', type: 'urgency', label: 'Compte à rebours', Icon: Clock, defaults: { name: 'custom_timer', label: 'Compte à rebours', editable: false, enabled: true } },
  { category: 'Conversion', type: 'call_schedule', label: 'Horaire d\'appel', Icon: PhoneCall, defaults: { name: 'custom_call', label: 'Quand vous appeler ?', editable: false, enabled: true } },
  { category: 'Conversion', type: 'trust_badge', label: 'Badge de confiance', Icon: Shield, defaults: { name: 'custom_trust', label: 'Paiement sécurisé', type: 'trust_badge', editable: false, enabled: true } },
  { category: 'Conversion', type: 'guarantee', label: 'Garantie', Icon: CheckCircle, defaults: { name: 'custom_guarantee', label: 'Satisfait ou remboursé', type: 'guarantee', editable: false, enabled: true } },
  { category: 'Conversion', type: 'testimonials', label: 'Témoignages', Icon: Star, defaults: { name: 'custom_testimonials', label: 'Ce que disent nos clients', type: 'testimonials', editable: false, enabled: true, testimonials: [
    { name: 'Marie K.', text: 'Produit excellent, livraison rapide !', rating: 5 },
    { name: 'Jean P.', text: 'Très satisfait de ma commande.', rating: 5 },
    { name: 'Aïcha D.', text: 'Je recommande à 100% !', rating: 4 }
  ] } },
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
  const btnColor = design.formButtonColor || shopColor || '#0F6B4F';
  const btnRadius = design.formInputRadius || '8px';
  const isEmbedded = config.general?.formType === 'embedded';
  const callSchedule = config.callSchedule || {};
  const urgency = config.urgency || {};

  const showOffers = offersPreview?.offersEnabled && offersPreview?.offers?.length > 0;

  const formBorderRadius = design.formBorderRadius || '12px';
  const formBorderColor = design.formBorderColor || '#e5e5e5';
  const formBorderWidth = design.formBorderWidth || '1px';
  const formShadowVal = parseInt(design.formShadow) || 0;
  const formShadow = formShadowVal > 0 ? `0 ${formShadowVal}px ${formShadowVal * 2}px rgba(0,0,0,${Math.min(formShadowVal * 0.02, 0.3).toFixed(2)})` : 'none';
  const formBgColor = design.formBgColor || '#ffffff';
  const formTextColor = design.formTextColor || '#1F2937';
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
        const isCityAuto = field.cityAuto !== false;
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
              {isCityAuto && <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
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
      case 'urgency': {
        const uf = fields[i] || {};
        const bgColor = uf.urgencyBgColor || urgency.bgColor || btnColor;
        const textColor = uf.urgencyTextColor || '#ffffff';
        const radius = uf.urgencyRadius || '12px';
        const style = uf.urgencyStyle || 'banner';
        const icon = uf.urgencyIcon || 'fire';
        const anim = uf.urgencyAnimation || 'pulse';
        const iconMap = { fire: '🔥', warning: '⚠️', clock: '⏰', bolt: '⚡', none: '' };
        const animCls = anim === 'pulse' ? 'animate-pulse' : anim === 'shake' ? 'animate-bounce' : '';
        return urgency.enabled !== false ? (
          <div key={i} className={`p-3 text-xs text-white ${animCls} ${style === 'floating' ? 'shadow-lg' : ''}`}
            style={{ backgroundColor: bgColor, color: textColor, borderRadius: radius }}>
            <p className="leading-relaxed font-medium">
              {iconMap[icon] ? <span className="mr-1">{iconMap[icon]}</span> : null}
              {uf.urgencyText || urgency.text || 'Stock presque épuisé. La promotion se termine bientôt.'}
            </p>
            {(uf.showCountdown !== false && urgency.countdown !== false) && (
              <div className="mt-1.5 flex items-center gap-2">
                {uf.countdownText && <span className="text-xs opacity-90">{uf.countdownText}</span>}
                <span className="inline-block font-mono font-bold text-sm bg-white/20 px-2.5 py-1 rounded">
                  {String(uf.countdownMinutes || urgency.countdownMinutes || 15).padStart(2, '0')}:47
                </span>
              </div>
            )}
            {uf.showProgressBar && (
              <div className="mt-2 w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/70 rounded-full" style={{ width: '65%' }} />
              </div>
            )}
          </div>
        ) : null;
      }
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
      case 'image':
        return field.imageUrl ? (
          <img key={i} src={field.imageUrl} alt={field.label || 'Image'} className="w-full rounded-xl object-contain max-h-48" />
        ) : (
          <div key={i} className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
            <Image size={20} className="mr-2" /> Aucune image
          </div>
        );
      case 'divider':
        return <hr key={i} className="border-t border-gray-200 my-1" />;
      case 'html':
        return (
          <div key={i} className="text-xs text-gray-600 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: field.htmlContent || '<p>Contenu HTML</p>' }} />
        );
      case 'trust_badge':
        return (
          <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-green-50 border border-green-200">
            <Shield size={16} className="text-green-600 flex-shrink-0" />
            <span className="text-xs font-medium text-green-700">{field.label || 'Paiement sécurisé'}</span>
          </div>
        );
      case 'guarantee':
        return (
          <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
            <span className="text-xs font-medium text-blue-700">{field.label || 'Satisfait ou remboursé'}</span>
          </div>
        );
      case 'testimonials': {
        const testimonials = field.testimonials || [
          { name: 'Marie K.', text: 'Produit excellent !', rating: 5 },
          { name: 'Jean P.', text: 'Très satisfait.', rating: 5 },
        ];
        return (
          <div key={i} className="space-y-2">
            {field.showLabel !== false && <p className="text-xs font-bold" style={{ color: formTextColor }}>{field.label}</p>}
            <div className="relative overflow-hidden">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {testimonials.map((t, ti) => (
                  <div key={ti} className="min-w-[200px] max-w-[220px] flex-shrink-0 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= (t.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">"{t.text}"</p>
                    <p className="text-[10px] font-semibold text-gray-800">— {t.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'country':
        return (
          <div key={i} className="border h-12 flex items-center gap-0 overflow-hidden"
            style={{ borderColor, backgroundColor: fieldBg, borderRadius: fieldRadius, borderWidth: formBorderWidth }}>
            {showIcon && (
              <div className="flex items-center justify-center px-3 h-full flex-shrink-0"
                style={{ backgroundColor: fieldIconBg }}>
                <Globe size={18} style={{ color: fIconColor }} />
              </div>
            )}
            <div className="flex-1 px-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: '#9ca3af' }}>{placeholderText}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        );
      case 'consent':
        return (
          <label key={i} className="flex items-start gap-2.5 text-xs cursor-pointer py-1">
            <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0 mt-0.5" />
            <span style={{ color: design.textColor || '#4b5563' }}>{field.label}</span>
          </label>
        );
      case 'radio':
        return (
          <div key={i} className="space-y-2 pt-1">
            {field.showLabel !== false && <p className="text-xs font-semibold" style={{ color: formTextColor }}>{field.label}</p>}
            {(field.options || ['Option 1', 'Option 2']).map((opt, j) => (
              <label key={j} className="flex items-center gap-2 text-xs cursor-pointer">
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                <span style={{ color: design.textColor || '#4b5563' }}>{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div key={i} className="space-y-2 pt-1">
            {field.showLabel !== false && <p className="text-xs font-semibold" style={{ color: formTextColor }}>{field.label}</p>}
            {(field.options || ['Option 1', 'Option 2']).map((opt, j) => (
              <label key={j} className="flex items-center gap-2 text-xs cursor-pointer">
                <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
                <span style={{ color: design.textColor || '#4b5563' }}>{opt}</span>
              </label>
            ))}
          </div>
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
  const [countrySectionOpen, setCountrySectionOpen] = useState(false);
  const [fieldsSectionOpen, setFieldsSectionOpen] = useState(true);
  const [formStyleSectionOpen, setFormStyleSectionOpen] = useState(false);
  const [fieldStyleSectionOpen, setFieldStyleSectionOpen] = useState(false);
  const [addFieldMenuOpen, setAddFieldMenuOpen] = useState(false);
  const [addFieldTab, setAddFieldTab] = useState('Entrées');
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
      // Deep merge design to avoid overwriting theme properties
      const mergedConfig = {
        ...existing,
        ...config,
        design: { ...existing.design, ...config.design },
      };
      await storeManageApi.updateStoreConfig({ productPageConfig: mergedConfig });
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
  const [dragFromIdx, setDragFromIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleDragStart = (idx) => { setDragFromIdx(idx); };
  const handleDragOver = (idx) => { setDragOverIdx(idx); };
  const handleDragEnd = () => { setDragFromIdx(null); setDragOverIdx(null); };
  const handleDrop = (toIdx) => {
    if (dragFromIdx !== null && dragFromIdx !== toIdx) {
      const next = [...config.form.fields];
      const [moved] = next.splice(dragFromIdx, 1);
      next.splice(toIdx, 0, moved);
      update(c => ({ ...c, form: { ...c.form, fields: next } }));
    }
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

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
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 lg:left-[240px] right-0 z-30">
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
              <button onClick={() => { if (window.confirm('Réinitialiser tous les réglages du formulaire ?')) setConfig(deepClone(defaultConfig)); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                Réinitialiser
              </button>
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-6 sm:pb-8">
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
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du bouton</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.ctaButtonColor || '#0F6B4F'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, ctaButtonColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.ctaButtonColor || '#0F6B4F'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, ctaButtonColor: e.target.value } }))} />
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
                    value={parseInt(config.design?.ctaBorderRadius) || 14}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, ctaBorderRadius: `${e.target.value}px` } }))} />
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
              <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setCountrySectionOpen(v => !v)}>
                <h3 className="text-sm font-bold text-gray-800">Pays du formulaire (indicatif téléphone)</h3>
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  {countrySectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>
              {countrySectionOpen && (<>
              <p className="text-xs text-gray-500">Le premier pays sélectionné détermine l'indicatif par défaut du formulaire.</p>
              {config.general?.countries?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {config.general.countries.map((countryName, i) => {
                    const pc = PHONE_CODES.find(c => c.name === countryName);
                    return (
                      <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border ${i === 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                        {pc ? `${pc.label.split(' ')[0]} ` : ''}{countryName}{pc ? ` (${pc.code})` : ''}
                        <button onClick={() => {
                          const next = config.general.countries.filter((_, idx) => idx !== i);
                          update(c => ({ ...c, general: { ...c.general, countries: next } }));
                        }} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                {PHONE_CODES.map(pc => {
                  const selected = (config.general?.countries || []).includes(pc.name);
                  return (
                    <button key={pc.code} type="button"
                      onClick={() => {
                        const current = config.general?.countries || [];
                        const next = selected ? current.filter(c => c !== pc.name) : [...current, pc.name];
                        update(c => ({ ...c, general: { ...c.general, countries: next } }));
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                        selected ? 'bg-green-50 border border-green-400 text-green-800' : 'bg-gray-50 border border-transparent text-gray-600 hover:bg-gray-100'
                      }`}>
                      <span>{pc.label.split(' ')[0]}</span>
                      <span className="truncate">{pc.name}</span>
                      {selected && <Check className="w-3 h-3 ml-auto flex-shrink-0 text-green-600" />}
                    </button>
                  );
                })}
              </div>
              </>)}
            </div>

            {/* ─── Formulaire (champs) ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setFieldsSectionOpen(v => !v)}>
                <h3 className="text-sm font-bold text-gray-800">Formulaire</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {config.form.fields.filter(f => f.enabled).length}/{config.form.fields.length} actifs
                  </span>
                  <span className="flex items-center text-[11px] text-emerald-600 font-semibold">
                    {fieldsSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>
              {fieldsSectionOpen && (<>
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
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    isDragOver={dragOverIdx === idx && dragFromIdx !== idx}
                    isDragging={dragFromIdx === idx}
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
                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                    <div className="flex border-b border-gray-200 shrink-0">
                      {['Entrées', 'Contenu', 'Conversion'].map(cat => (
                        <button key={cat} onClick={() => setAddFieldTab(cat)}
                          className={`flex-1 py-2.5 text-xs font-semibold transition ${addFieldTab === cat ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-400 hover:text-gray-600'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="overflow-y-auto">
                      {CUSTOM_FIELD_TYPES.filter(ft => ft.category === addFieldTab).map(ft => (
                        <button key={ft.type + ft.defaults.name}
                          onClick={() => { addField(ft); setAddFieldMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition text-sm">
                          <ft.Icon size={16} className="text-gray-500" />
                          <span className="font-medium text-gray-700">{ft.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </>)}
            </div>

            {/* ─── Style de formulaire ─── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setFormStyleSectionOpen(v => !v)}>
                <h3 className="text-sm font-bold text-gray-800">Style de formulaire</h3>
                <span className="flex items-center text-[11px] text-emerald-600 font-semibold">
                  {formStyleSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>
              {formStyleSectionOpen && (<>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du texte</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.design?.formTextColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formTextColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.formTextColor || '#1F2937'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formTextColor: e.target.value } }))} />
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
                    <input type="color" value={config.design?.formBgColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formBgColor: e.target.value } }))}
                      className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                    <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.formBgColor || '#ffffff'}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, formBgColor: e.target.value } }))} />
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
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du bouton</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.design?.formButtonColor || '#0F6B4F'}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, formButtonColor: e.target.value } }))}
                    className="w-7 h-7 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                  <input className={inputCls + ' font-mono text-[11px]'} value={config.design?.formButtonColor || '#0F6B4F'}
                    onChange={e => update(c => ({ ...c, design: { ...c.design, formButtonColor: e.target.value } }))} />
                </div>
              </div>

              <hr className="border-gray-100 my-2" />
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Champs</h4>

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
              </>)}
            </div>
          </div>

          {/* ── Panel droit: aperçu en direct ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-600">Aperçu en direct:</span>
            </div>
            <div className="sticky top-[7.5rem]">
              {/* Aperçu bouton CTA (popup uniquement) */}
              {(config.general?.formType || 'popup') === 'popup' && (
                <div className="mb-4">
                  <button className="w-full flex flex-col items-center justify-center gap-1" style={{
                    padding: '18px 24px',
                    borderRadius: config.design?.ctaBorderRadius || '14px',
                    border: config.design?.buttonBorderWidth && parseInt(config.design?.buttonBorderWidth) > 0
                      ? `${config.design.buttonBorderWidth} solid ${config.design?.buttonBorderColor || 'transparent'}`
                      : 'none',
                    backgroundColor: config.design?.ctaButtonColor || '#0F6B4F',
                    color: config.design?.buttonTextColor || '#fff',
                    fontWeight: config.design?.buttonBold ? 700 : 700,
                    fontSize: parseInt(config.design?.buttonFontSize) || 17,
                    fontStyle: config.design?.buttonItalic ? 'italic' : 'normal',
                    boxShadow: config.design?.buttonShadow && parseInt(config.design?.buttonShadow) > 0
                      ? `0 ${config.design.buttonShadow}px ${parseInt(config.design.buttonShadow)*2}px rgba(0,0,0,0.12)`
                      : '0 4px 16px rgba(0,0,0,0.12)',
                    cursor: 'default',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <ShoppingCart size={18} /> {config.button?.text || 'Commander maintenant'}
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>
                      {config.button?.subtext || 'Paiement à la livraison'}
                    </span>
                  </button>
                </div>
              )}
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
