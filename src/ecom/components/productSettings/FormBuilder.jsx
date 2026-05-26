import React, { useState } from 'react';
import { ListChecks, ChevronUp, ChevronDown, GripVertical, ChevronRight, Settings2 } from 'lucide-react';
import SectionCard from './SectionCard';
import { ICONS, ANIMATIONS, ButtonAnimationStyles, getAnimationClass } from './ButtonEditor';

// Fields that support inline editing
const EDITABLE_FIELD_TYPES = new Set(['text', 'textarea', 'address', 'city_select', 'cta_button']);
const EDITABLE_FIELD_NAMES = new Set(['address', 'fullname', 'city', 'cta_button']);

const FieldEditor = ({ field, onChange }) => {
  const update = (key, val) => onChange({ ...field, [key]: val });
  const isCta = field.type === 'cta_button';
  const animClass = getAnimationClass(field.animation || 'none');
  const currentIcon = field.icon || (isCta ? 'cart' : 'pin');
  const SelectedIcon = ICONS.find(i => i.id === currentIcon)?.Icon;

  return (
    <div className="mt-3 pt-3 border-t border-[#0F6B4F]/10 space-y-3">
      <ButtonAnimationStyles />

      {/* Label / text preview */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
          {isCta ? 'Texte du bouton' : 'Label du champ'}
        </label>
        <input
          type="text"
          value={field.label || ''}
          onChange={e => update('label', e.target.value)}
          placeholder={isCta ? 'ACHETER MAINTENANT - {total}' : field.name === 'address' ? 'Lieu de livraison' : 'Label'}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] font-medium focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
        />
      </div>

      {/* Placeholder */}
      {!isCta && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Placeholder</label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={e => update('placeholder', e.target.value)}
            placeholder="Ex: Votre quartier, rue..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-500 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
          />
        </div>
      )}

      {/* Icon picker */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Icône</label>
        <div className="grid grid-cols-6 gap-1">
          {ICONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => update('icon', id)}
              title={label}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border-2 transition-all ${
                currentIcon === id
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Icon size={13} />
              <span className="text-[8px] font-medium leading-tight truncate w-full text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animation picker — only for cta_button */}
      {isCta && (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Animation</label>
            <div className="grid grid-cols-3 gap-1">
              {ANIMATIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update('animation', id)}
                  className={`px-2 py-2 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                    (field.animation || 'none') === id
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Live CTA button preview */}
          <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">
              Aperçu du bouton
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                className={`flex items-center gap-2 px-6 py-3 font-extrabold text-white text-sm rounded-xl transition-all pointer-events-none ${animClass}`}
                style={{ backgroundColor: '#D94A1F', boxShadow: '0 4px 16px #D94A1F50', minWidth: 180 }}
              >
                {SelectedIcon && <SelectedIcon size={15} />}
                {(field.label || 'ACHETER MAINTENANT').replace(' - {total}', '')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const FormBuilder = ({ config, onChange }) => {
  const fields = config.fields;
  const [expandedField, setExpandedField] = useState(null);

  const toggleField = (index) => {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, enabled: !f.enabled } : f
    );
    onChange({ ...config, fields: updated });
  };

  const moveField = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange({ ...config, fields: updated });
  };

  const updateField = (index, updatedField) => {
    const updated = fields.map((f, i) => i === index ? updatedField : f);
    onChange({ ...config, fields: updated });
  };

  const isEditable = (field) =>
    EDITABLE_FIELD_NAMES.has(field.name) || EDITABLE_FIELD_TYPES.has(field.type);

  return (
    <div className="space-y-5">
      <SectionCard icon={<ListChecks size={18} />} title="Form Builder" description="Choisissez les champs du formulaire, personnalisez-les et réorganisez-les.">
        <div className="space-y-2">
          {fields.map((field, index) => {
            const editable = isEditable(field);
            const isExpanded = expandedField === index;

            return (
              <div
                key={field.name}
                className={`rounded-xl border transition-all ${
                  field.enabled
                    ? 'border-[#0F6B4F]/20 bg-[#F0FAF5]'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical size={16} className="text-gray-300 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${field.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {field.label}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-2 font-mono">{field.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit toggle — only for editable fields */}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => setExpandedField(isExpanded ? null : index)}
                        title="Personnaliser"
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? 'bg-primary-100 text-primary-600'
                            : 'hover:bg-white text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {isExpanded ? <ChevronRight size={13} className="rotate-90" /> : <Settings2 size={13} />}
                      </button>
                    )}

                    <button
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp size={14} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown size={14} className="text-gray-500" />
                    </button>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.enabled}
                    onClick={() => toggleField(index)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      field.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        field.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Inline editor panel */}
                {isExpanded && editable && (
                  <div className="px-4 pb-4">
                    <FieldEditor
                      field={field}
                      onChange={(updated) => updateField(index, updated)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
};

export default FormBuilder;
