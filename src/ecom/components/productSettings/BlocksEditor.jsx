import React, { useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';

const SECTION_META = {
  heroSlogan:       { icon: '✍️', desc: 'Sous-titre marketing généré par IA' },
  heroBaseline:     { icon: '✅', desc: 'Phrase de réassurance sous le titre' },
  reviews:          { icon: '⭐', desc: 'Étoiles et nombre d\'avis' },
  statsBar:         { icon: '📊', desc: 'Chiffres de preuve sociale' },
  stockCounter:     { icon: '📦', desc: 'Stock restant urgence' },
  urgencyBadge:     { icon: '🔥', desc: 'Badge d\'urgence IA' },
  urgencyElements:  { icon: '⏰', desc: 'Stock limité, preuve sociale' },
  benefitsBullets:  { icon: '💥', desc: 'Liste des bénéfices' },
  conversionBlocks: { icon: '🛡️', desc: 'Blocs de réassurance' },
  offerBlock:       { icon: '🎁', desc: 'Garantie / offre spéciale' },
  description:      { icon: '📝', desc: 'Description complète' },
  problemSection:   { icon: '😰', desc: 'Points de douleur client' },
  solutionSection:  { icon: '💡', desc: 'Solution persuasive' },
  faq:              { icon: '❓', desc: 'Questions fréquentes' },
  testimonials:     { icon: '💬', desc: 'Témoignages clients' },
  relatedProducts:  { icon: '🔗', desc: 'Produits similaires' },
  stickyOrderBar:   { icon: '📌', desc: 'Barre fixe Commander' },
  upsell:           { icon: '🚀', desc: 'Produit de valeur supérieure' },
  orderBump:        { icon: '🛒', desc: 'Produit complémentaire' },
};

const SortableBlock = ({ section, index, onToggle }) => {
  const meta = SECTION_META[section.id] || { icon: '📄', desc: '' };
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-indigo-300/40' : ''
      } ${
        section.enabled
          ? 'border-emerald-200/60 bg-emerald-50/40 hover:bg-emerald-50/70'
          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 -ml-1 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/70 transition-colors touch-none"
        tabIndex={-1}
      >
        <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400" />
      </button>

      {/* Position */}
      <span className="w-5 h-5 rounded-md bg-white text-gray-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
        {index + 1}
      </span>

      {/* Icon */}
      <span className="text-sm shrink-0">{meta.icon}</span>

      {/* Label + desc */}
      <div className="flex-1 min-w-0">
        <span className={`text-[13px] font-semibold leading-tight block ${
          section.enabled ? 'text-gray-800' : 'text-gray-400'
        }`}>
          {section.label}
        </span>
        <span className="text-[10px] text-gray-400 leading-tight block mt-0.5 truncate">
          {meta.desc}
        </span>
      </div>

      {/* Toggle */}
      <button
        onClick={() => onToggle(section.id)}
        className={`relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          section.enabled ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition duration-200 ${
          section.enabled ? 'translate-x-[18px]' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
};

const BlocksEditor = ({ sections, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const ids = useMemo(() => sections.map(s => s.id), [sections]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex(s => s.id === active.id);
    const newIdx = sections.findIndex(s => s.id === over.id);
    onChange(arrayMove(sections, oldIdx, newIdx));
  };

  const handleToggle = (id) => {
    onChange(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const enabledCount = sections.filter(s => s.enabled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            {enabledCount}/{sections.length} sections actives
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onChange(sections.map(s => ({ ...s, enabled: true })))}
            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Eye size={11} className="inline mr-1" />Tout activer
          </button>
          <button
            onClick={() => onChange(sections.map(s => ({ ...s, enabled: false })))}
            className="text-[10px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <EyeOff size={11} className="inline mr-1" />Tout masquer
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {sections.map((section, index) => (
              <SortableBlock
                key={section.id}
                section={section}
                index={index}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default BlocksEditor;
