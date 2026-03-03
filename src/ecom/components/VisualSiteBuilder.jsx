import React, { useState, useRef, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Eye, Settings, Palette, Type, Image, Layout, 
  Plus, Trash2, Copy, Move, Monitor, Smartphone, Tablet,
  Save, Undo, Redo, Download, Upload
} from 'lucide-react';

// Section Templates
const SECTION_TEMPLATES = {
  hero: {
    id: 'hero',
    type: 'hero',
    label: 'Section Hero',
    icon: '🦸',
    config: {
      title: 'Bienvenue dans notre boutique',
      subtitle: 'Découvrez nos produits exceptionnels',
      ctaText: 'Voir nos produits',
      bgImage: '',
      bgColor: '#f8fafc',
      textAlign: 'center',
      height: 'large'
    }
  },
  products: {
    id: 'products',
    type: 'featured_products',
    label: 'Grille Produits',
    icon: '🛍️',
    config: {
      title: 'Nos Produits',
      count: 8,
      columns: 4,
      showCategories: true
    }
  },
  text: {
    id: 'text',
    type: 'text',
    label: 'Section Texte',
    icon: '📝',
    config: {
      title: 'Titre de section',
      content: 'Votre contenu ici...',
      textAlign: 'left'
    }
  },
  testimonials: {
    id: 'testimonials',
    type: 'reviews',
    label: 'Témoignages',
    icon: '⭐',
    config: {
      title: 'Ce que disent nos clients',
      items: []
    }
  },
  cta: {
    id: 'cta',
    type: 'cta',
    label: 'Appel à l\'action',
    icon: '🎯',
    config: {
      title: 'Prêt à commander ?',
      buttonText: 'Commander maintenant',
      buttonUrl: '#products'
    }
  }
};

// Draggable Section Component
const SortableSection = ({ section, isSelected, onSelect, onDelete, onDuplicate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border-2 rounded-xl p-3 cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-md'
      }`}
      onClick={() => onSelect(section.id)}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
        >
          <Move className="w-4 h-4" />
        </div>
        
        <span className="text-lg">{SECTION_TEMPLATES[section.type]?.icon || '📦'}</span>
        
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{section.label || section.type}</h4>
          <p className="text-xs text-gray-500">{section.type}</p>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(section.id); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            title="Dupliquer"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
            className="p-1.5 hover:bg-red-100 rounded-lg transition"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Property Editor Panel
const PropertyEditor = ({ section, onChange, theme }) => {
  if (!section) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Sélectionnez une section pour la modifier</p>
      </div>
    );
  }

  const updateConfig = (key, value) => {
    onChange({
      ...section,
      config: { ...section.config, [key]: value }
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span>{SECTION_TEMPLATES[section.type]?.icon}</span>
          {section.label || section.type}
        </h3>
        <p className="text-xs text-gray-500 mt-1">Personnalisez cette section</p>
      </div>

      {/* Hero Section Properties */}
      {section.type === 'hero' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Titre</label>
            <input
              type="text"
              value={section.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Titre principal"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Sous-titre</label>
            <textarea
              value={section.config.subtitle || ''}
              onChange={(e) => updateConfig('subtitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Description"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Texte du bouton</label>
            <input
              type="text"
              value={section.config.ctaText || ''}
              onChange={(e) => updateConfig('ctaText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Voir nos produits"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Image de fond</label>
            <input
              type="url"
              value={section.config.bgImage || ''}
              onChange={(e) => updateConfig('bgImage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://..."
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Hauteur</label>
            <select
              value={section.config.height || 'large'}
              onChange={(e) => updateConfig('height', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="small">Petite</option>
              <option value="medium">Moyenne</option>
              <option value="large">Grande</option>
              <option value="full">Plein écran</option>
            </select>
          </div>
        </>
      )}

      {/* Products Section Properties */}
      {section.type === 'featured_products' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Titre</label>
            <input
              type="text"
              value={section.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nos Produits"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Nombre de produits</label>
            <input
              type="number"
              value={section.config.count || 8}
              onChange={(e) => updateConfig('count', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="20"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Colonnes</label>
            <select
              value={section.config.columns || 4}
              onChange={(e) => updateConfig('columns', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="2">2 colonnes</option>
              <option value="3">3 colonnes</option>
              <option value="4">4 colonnes</option>
              <option value="5">5 colonnes</option>
            </select>
          </div>
        </>
      )}

      {/* Text Section Properties */}
      {section.type === 'text' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Titre</label>
            <input
              type="text"
              value={section.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Titre de section"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Contenu</label>
            <textarea
              value={section.config.content || ''}
              onChange={(e) => updateConfig('content', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Votre contenu ici..."
            />
          </div>
        </>
      )}

      {/* CTA Section Properties */}
      {section.type === 'cta' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Titre</label>
            <input
              type="text"
              value={section.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Prêt à commander ?"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Texte du bouton</label>
            <input
              type="text"
              value={section.config.buttonText || ''}
              onChange={(e) => updateConfig('buttonText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Commander maintenant"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Lien du bouton</label>
            <input
              type="text"
              value={section.config.buttonUrl || ''}
              onChange={(e) => updateConfig('buttonUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="#products"
            />
          </div>
        </>
      )}
    </div>
  );
};

// Preview Component
const SectionPreview = ({ section, theme }) => {
  const { config } = section;
  
  switch (section.type) {
    case 'hero':
      const heightClasses = {
        small: 'py-12',
        medium: 'py-20',
        large: 'py-32',
        full: 'min-h-screen flex items-center'
      };
      
      return (
        <section 
          className={`relative overflow-hidden ${heightClasses[config.height] || heightClasses.large}`}
          style={{
            backgroundColor: config.bgImage ? '#000' : (config.bgColor || '#f8fafc'),
            backgroundImage: config.bgImage ? `url(${config.bgImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {config.bgImage && <div className="absolute inset-0 bg-black/40" />}
          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <h1 
              className="text-4xl md:text-6xl font-black mb-6"
              style={{ 
                color: config.bgImage ? '#fff' : (theme?.text || '#111827'),
                fontFamily: theme?.font || 'Inter'
              }}
            >
              {config.title || 'Titre du hero'}
            </h1>
            {config.subtitle && (
              <p 
                className="text-lg md:text-xl mb-8 opacity-90"
                style={{ color: config.bgImage ? '#fff' : (theme?.text || '#111827') }}
              >
                {config.subtitle}
              </p>
            )}
            {config.ctaText && (
              <button
                className="inline-block px-8 py-4 font-bold text-white shadow-lg transition hover:scale-105"
                style={{ 
                  backgroundColor: theme?.cta || '#0F6B4F',
                  borderRadius: theme?.radius || '0.75rem'
                }}
              >
                {config.ctaText}
              </button>
            )}
          </div>
        </section>
      );
      
    case 'featured_products':
      return (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 
              className="text-3xl md:text-4xl font-black text-center mb-10"
              style={{ color: theme?.text || '#111827', fontFamily: theme?.font || 'Inter' }}
            >
              {config.title || 'Nos Produits'}
            </h2>
            <div className={`grid gap-6 grid-cols-${config.columns || 4}`}>
              {Array.from({ length: Math.min(config.count || 8, 8) }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300" style={{ borderRadius: theme?.radius || '0.75rem' }}>
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Produit {i + 1}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Produit exemple</h3>
                    <p className="text-lg font-black" style={{ color: theme?.cta || '#0F6B4F' }}>25,000 XAF</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
      
    case 'text':
      return (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            {config.title && (
              <h2 
                className="text-2xl md:text-3xl font-black mb-6"
                style={{ color: theme?.text || '#111827', fontFamily: theme?.font || 'Inter' }}
              >
                {config.title}
              </h2>
            )}
            {config.content && (
              <div 
                className="prose prose-lg max-w-none"
                style={{ color: theme?.text || '#111827', fontFamily: theme?.font || 'Inter' }}
                dangerouslySetInnerHTML={{ __html: config.content.replace(/\n/g, '<br/>') }}
              />
            )}
          </div>
        </section>
      );
      
    case 'cta':
      return (
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto text-center p-8 bg-white border border-gray-100" style={{ borderRadius: theme?.radius || '0.75rem' }}>
            {config.title && (
              <h2 
                className="text-2xl md:text-3xl font-black mb-6"
                style={{ color: theme?.text || '#111827', fontFamily: theme?.font || 'Inter' }}
              >
                {config.title}
              </h2>
            )}
            {config.buttonText && (
              <button
                className="inline-block px-8 py-4 text-white font-bold transition hover:opacity-90"
                style={{ 
                  backgroundColor: theme?.cta || '#0F6B4F',
                  borderRadius: theme?.radius || '0.75rem'
                }}
              >
                {config.buttonText}
              </button>
            )}
          </div>
        </section>
      );
      
    default:
      return (
        <section className="py-8 px-4 bg-gray-50 border-2 border-dashed border-gray-300">
          <div className="text-center text-gray-500">
            <p>Section: {section.type}</p>
            <p className="text-sm">Aperçu non disponible</p>
          </div>
        </section>
      );
  }
};

// Main Visual Site Builder Component
const VisualSiteBuilder = ({ initialSections = [], theme = {}, onSave }) => {
  const [sections, setSections] = useState(initialSections);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [saving, setSaving] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addSection = (templateId) => {
    const template = SECTION_TEMPLATES[templateId];
    if (!template) return;
    
    const newSection = {
      ...template,
      id: `${template.type}_${Date.now()}`,
      enabled: true,
    };
    
    setSections([...sections, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const deleteSection = (sectionId) => {
    setSections(sections.filter(s => s.id !== sectionId));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const duplicateSection = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newSection = {
      ...section,
      id: `${section.type}_${Date.now()}`,
      label: `${section.label} (copie)`,
    };
    
    const index = sections.findIndex(s => s.id === sectionId);
    const newSections = [...sections];
    newSections.splice(index + 1, 0, newSection);
    setSections(newSections);
  };

  const updateSection = (updatedSection) => {
    setSections(sections.map(s => s.id === updatedSection.id ? updatedSection : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.(sections);
    } finally {
      setSaving(false);
    }
  };

  const previewWidths = {
    desktop: 'w-full',
    tablet: 'w-3/4 mx-auto',
    mobile: 'w-80 mx-auto'
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Sections List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Site Builder</h2>
          <p className="text-sm text-gray-500">Glissez-déposez pour réorganiser</p>
        </div>
        
        {/* Add Section Templates */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ajouter une section</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SECTION_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => addSection(key)}
                className="flex flex-col items-center gap-1 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition text-center"
              >
                <span className="text-lg">{template.icon}</span>
                <span className="text-xs font-medium text-gray-600">{template.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Sections List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  isSelected={selectedSectionId === section.id}
                  onSelect={setSelectedSectionId}
                  onDelete={deleteSection}
                  onDuplicate={duplicateSection}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        
        {/* Save Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Center - Preview */}
      <div className="flex-1 flex flex-col">
        {/* Preview Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-900">Aperçu</h3>
            
            {/* Device Selector */}
            <div className="flex items-center border border-gray-200 rounded-lg p-1">
              {[
                { key: 'desktop', icon: Monitor, label: 'Desktop' },
                { key: 'tablet', icon: Tablet, label: 'Tablet' },
                { key: 'mobile', icon: Smartphone, label: 'Mobile' }
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setPreviewMode(key)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition ${
                    previewMode === key 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{sections.length} sections</span>
          </div>
        </div>
        
        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#f8fafc' }}>
          <div className={`${previewWidths[previewMode]} transition-all duration-300`}>
            <div className="bg-white shadow-lg" style={{ borderRadius: theme?.radius || '0.75rem' }}>
              {sections.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                  <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ajoutez des sections pour voir l'aperçu</p>
                </div>
              ) : (
                sections.map((section) => (
                  <div 
                    key={section.id}
                    className={`relative group ${selectedSectionId === section.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <SectionPreview section={section} theme={theme} />
                    
                    {/* Section Overlay */}
                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    {/* Section Label */}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-2 py-1 bg-gray-900/75 text-white text-xs rounded">
                        {section.label || section.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-80 bg-white border-l border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Propriétés</h3>
        </div>
        <div className="overflow-y-auto">
          <PropertyEditor 
            section={selectedSection}
            onChange={updateSection}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
};

export default VisualSiteBuilder;
