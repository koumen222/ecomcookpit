import React, { useState, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BLOCK_TYPES, BLOCK_CATEGORIES, DEFAULT_EMPTY_SECTIONS } from '../data/exampleSections';
import {
  Plus, GripVertical, Eye, EyeOff, Edit3, Copy, Trash2, 
  Move, Type, Image, Star, HelpCircle, Phone, MousePointer
} from 'lucide-react';

// Block type icons mapping
const BLOCK_ICONS = {
  hero: '🎯',
  products: '🛍️',
  text: '📝',
  image: '🖼️',
  testimonials: '⭐',
  faq: '❓',
  contact: '📞',
  button: '🔘',
  spacer: '📏'
};
  products: {
    name: 'Grille Produits',
    icon: <ShoppingBag className="w-5 h-5" />,
    category: 'E-commerce',
    defaultConfig: {
      title: 'Nos Produits',
      layout: 'grid',
      columns: 3,
      showPrice: true,
      showDescription: true,
      count: 6,
      category: 'all',
      sortBy: 'created_at',
    }
  },
  text: {
    name: 'Bloc Texte',
    icon: <Type className="w-5 h-5" />,
    category: 'Contenu',
    defaultConfig: {
      title: 'Titre de section',
      content: 'Votre contenu ici...',
      alignment: 'left',
      fontSize: 'medium',
      showTitle: true,
    }
  },
  image: {
    name: 'Image',
    icon: <Image className="w-5 h-5" />,
    category: 'Média',
    defaultConfig: {
      src: '',
      alt: '',
      caption: '',
      size: 'medium',
      alignment: 'center',
      link: '',
      rounded: false,
    }
  },
  testimonials: {
    name: 'Témoignages',
    icon: <Star className="w-5 h-5" />,
    category: 'Social Proof',
    defaultConfig: {
      title: 'Ce que disent nos clients',
      testimonials: [
        { name: 'Marie D.', rating: 5, text: 'Excellent service !', avatar: '' },
        { name: 'Paul M.', rating: 5, text: 'Très satisfait de mon achat.', avatar: '' },
      ],
      layout: 'grid',
      showAvatars: true,
      showRatings: true,
    }
  },
  faq: {
    name: 'FAQ',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'Support',
    defaultConfig: {
      title: 'Questions Fréquentes',
      questions: [
        { question: 'Comment passer commande ?', answer: 'Vous pouvez commander directement via WhatsApp.' },
        { question: 'Quels sont les délais de livraison ?', answer: 'Livraison en 24-48h à Yaoundé et Douala.' },
      ],
      style: 'accordion',
    }
  },
  cta: {
    name: 'Call to Action',
    icon: <Target className="w-5 h-5" />,
    category: 'Marketing',
    defaultConfig: {
      title: 'Prêt à commander ?',
      subtitle: 'Contactez-nous dès maintenant',
      buttonText: 'Commander maintenant',
      buttonUrl: '#contact',
      backgroundColor: '#0F6B4F',
      textColor: '#FFFFFF',
      style: 'centered',
    }
  },
  contact: {
    name: 'Contact',
    icon: <Phone className="w-5 h-5" />,
    category: 'Support',
    defaultConfig: {
      title: 'Contactez-nous',
      showPhone: true,
      showWhatsapp: true,
      showEmail: true,
      showAddress: false,
      phone: '+237 6XX XXX XXX',
      whatsapp: '+237 6XX XXX XXX',
      email: 'contact@example.com',
      address: '',
    }
  },
  newsletter: {
    name: 'Newsletter',
    icon: <Mail className="w-5 h-5" />,
    category: 'Marketing',
    defaultConfig: {
      title: 'Restez informé',
      subtitle: 'Recevez nos dernières offres et nouveautés',
      placeholder: 'Votre email...',
      buttonText: 'S\'abonner',
      style: 'inline',
    }
  },
  promo: {
    name: 'Bannière Promo',
    icon: <Gift className="w-5 h-5" />,
    category: 'Marketing',
    defaultConfig: {
      text: 'Livraison gratuite pour toute commande !',
      backgroundColor: '#EF4444',
      textColor: '#FFFFFF',
      closable: true,
      position: 'top',
      animated: false,
    }
  },
  features: {
    name: 'Avantages',
    icon: <Award className="w-5 h-5" />,
    category: 'Marketing',
    defaultConfig: {
      title: 'Pourquoi nous choisir ?',
      features: [
        { icon: '🚚', title: 'Livraison rapide', description: '24-48h dans toute la ville' },
        { icon: '💳', title: 'Paiement sécurisé', description: 'Mobile Money & Carte bancaire' },
        { icon: '🔄', title: 'Retour gratuit', description: '30 jours pour changer d\'avis' },
      ],
      layout: 'grid',
      columns: 3,
    }
  },
  spacer: {
    name: 'Espaceur',
    icon: <div className="w-5 h-1 bg-gray-400 rounded" />,
    category: 'Layout',
    defaultConfig: {
      height: 'medium',
      backgroundColor: 'transparent',
    }
  },
};

const CATEGORIES = [
  'Tous',
  'Marketing',
  'E-commerce',
  'Contenu',
  'Média',
  'Social Proof',
  'Support',
  'Layout'
];

// Draggable block item
function DraggableBlock({ type, block, onAdd }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'NEW_BLOCK',
    item: { type, block },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      onClick={() => onAdd(type)}
      className={`p-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-gray-500 group-hover:text-blue-500 transition-colors">
          {block.icon}
        </div>
        <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
          {block.name}
        </span>
      </div>
    </div>
  );
}

// Page section item
function PageSection({ section, index, onMove, onEdit, onToggle, onDelete, onDuplicate }) {
  const { theme, getThemeColor } = useTheme();
  const ref = useRef(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'PAGE_SECTION',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ['PAGE_SECTION', 'NEW_BLOCK'],
    drop: (item, monitor) => {
      if (monitor.getItemType() === 'NEW_BLOCK') {
        onMove(-1, index, item.type); // Add new block
      } else if (item.index !== index) {
        onMove(item.index, index); // Reorder existing
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  const blockInfo = BLOCK_TYPES[section.type] || { name: section.type, icon: <Layout className="w-5 h-5" /> };

  return (
    <div
      ref={ref}
      className={`relative group border rounded-xl transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${
        isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      } ${
        !section.enabled ? 'opacity-60' : ''
      }`}
    >
      {/* Drop indicator */}
      {isOver && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />
      )}
      
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="cursor-move text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1"
              title="Glisser pour réorganiser"
            >
              <GripVertical className="w-4 h-4" />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-gray-500">
                {blockInfo.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  {section.config?.title || blockInfo.name}
                </h3>
                <p className="text-xs text-gray-500 capitalize">
                  {section.type}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggle(index)}
              className={`p-2 rounded-lg transition-colors ${
                section.enabled 
                  ? 'text-green-600 hover:bg-green-50' 
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
              title={section.enabled ? 'Masquer' : 'Afficher'}
            >
              {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            
            <button
              onClick={() => onEdit(index)}
              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
              title="Modifier"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onDuplicate(index)}
              className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
              title="Dupliquer"
            >
              <Copy className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onDelete(index)}
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section preview */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Aperçu:</div>
          <SectionPreview section={section} />
        </div>
      </div>
    </div>
  );
}

// Mini preview of section content
function SectionPreview({ section }) {
  const { config, type } = section;

  switch (type) {
    case 'hero':
      return (
        <div className="text-center py-4 px-2 rounded" style={{ backgroundColor: config?.backgroundColor || '#0F6B4F' }}>
          <div className="text-sm font-bold" style={{ color: config?.textColor || '#FFFFFF' }}>
            {config?.title || 'Titre Hero'}
          </div>
          <div className="text-xs mt-1 opacity-80" style={{ color: config?.textColor || '#FFFFFF' }}>
            {config?.subtitle || 'Sous-titre'}
          </div>
        </div>
      );
    
    case 'products':
      return (
        <div>
          <div className="text-xs font-medium mb-2">{config?.title || 'Nos Produits'}</div>
          <div className={`grid gap-2 ${config?.columns === 2 ? 'grid-cols-2' : config?.columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {Array.from({ length: Math.min(config?.count || 6, 6) }).map((_, i) => (
              <div key={i} className="bg-white border rounded p-1">
                <div className="bg-gray-200 aspect-square rounded mb-1"></div>
                <div className="h-2 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'text':
      return (
        <div>
          {config?.showTitle && (
            <div className="text-xs font-medium mb-1">{config?.title || 'Titre'}</div>
          )}
          <div className="text-xs text-gray-600 line-clamp-2">
            {config?.content || 'Contenu du bloc texte...'}
          </div>
        </div>
      );
    
    case 'testimonials':
      return (
        <div>
          <div className="text-xs font-medium mb-2">{config?.title || 'Témoignages'}</div>
          <div className="space-y-1">
            {config?.testimonials?.slice(0, 2).map((testimonial, i) => (
              <div key={i} className="bg-white border rounded p-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-medium">{testimonial.name}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: testimonial.rating || 5 }).map((_, j) => (
                      <span key={j} className="text-yellow-400 text-xs">★</span>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-600">{testimonial.text}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'cta':
      return (
        <div className="text-center py-3 px-2 rounded" style={{ backgroundColor: config?.backgroundColor || '#0F6B4F' }}>
          <div className="text-xs font-bold" style={{ color: config?.textColor || '#FFFFFF' }}>
            {config?.title || 'Call to Action'}
          </div>
          <div className="text-xs mt-1 opacity-80" style={{ color: config?.textColor || '#FFFFFF' }}>
            {config?.subtitle || 'Subtitle'}
          </div>
        </div>
      );

    default:
      return (
        <div className="text-xs text-gray-500 text-center py-2">
          Section {type}
        </div>
      );
  }
}

// Drop zone for empty page
function EmptyDropZone({ onAdd }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'NEW_BLOCK',
    drop: (item) => {
      onAdd(item.type, 0);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`min-h-[200px] border-2 border-dashed rounded-xl flex items-center justify-center transition-all ${
        isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="text-center text-gray-500">
        <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">Votre page est vide</p>
        <p className="text-xs">Glissez un bloc ici pour commencer</p>
      </div>
    </div>
  );
}

export default function PageBuilder({ sections = [], onUpdateSections }) {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [editingSection, setEditingSection] = useState(null);

  const filteredBlocks = Object.entries(BLOCK_TYPES).filter(([type, block]) => 
    selectedCategory === 'Tous' || block.category === selectedCategory
  );

  const handleAddBlock = useCallback((type, position = -1) => {
    const blockConfig = BLOCK_TYPES[type];
    if (!blockConfig) return;

    const newSection = {
      id: `${type}-${Date.now()}`,
      type,
      enabled: true,
      config: { ...blockConfig.defaultConfig }
    };

    const newSections = [...sections];
    if (position >= 0) {
      newSections.splice(position, 0, newSection);
    } else {
      newSections.push(newSection);
    }

    onUpdateSections(newSections);
  }, [sections, onUpdateSections]);

  const handleMoveSection = useCallback((fromIndex, toIndex, newBlockType = null) => {
    if (newBlockType) {
      handleAddBlock(newBlockType, toIndex);
      return;
    }

    if (fromIndex === toIndex) return;

    const newSections = [...sections];
    const [movedSection] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, movedSection);
    onUpdateSections(newSections);
  }, [sections, onUpdateSections, handleAddBlock]);

  const handleToggleSection = useCallback((index) => {
    const newSections = [...sections];
    newSections[index] = { 
      ...newSections[index], 
      enabled: !newSections[index].enabled 
    };
    onUpdateSections(newSections);
  }, [sections, onUpdateSections]);

  const handleDeleteSection = useCallback((index) => {
    const newSections = sections.filter((_, i) => i !== index);
    onUpdateSections(newSections);
  }, [sections, onUpdateSections]);

  const handleDuplicateSection = useCallback((index) => {
    const sectionToDuplicate = sections[index];
    const duplicatedSection = {
      ...sectionToDuplicate,
      id: `${sectionToDuplicate.type}-${Date.now()}`,
      config: { ...sectionToDuplicate.config }
    };
    
    const newSections = [...sections];
    newSections.splice(index + 1, 0, duplicatedSection);
    onUpdateSections(newSections);
  }, [sections, onUpdateSections]);

  const handleEditSection = useCallback((index) => {
    setEditingSection(sections[index]);
  }, [sections]);

  const handleSaveSection = useCallback((updatedSection) => {
    const newSections = sections.map(section => 
      section.id === updatedSection.id ? updatedSection : section
    );
    onUpdateSections(newSections);
    setEditingSection(null);
  }, [sections, onUpdateSections]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full">
        {/* Blocks sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Blocs disponibles</h2>
            
            {/* Category filter */}
            <div className="flex flex-wrap gap-1 mb-4">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              {filteredBlocks.map(([type, block]) => (
                <DraggableBlock
                  key={type}
                  type={type}
                  block={block}
                  onAdd={handleAddBlock}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Page canvas */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Constructeur de page</h1>
              <p className="text-sm text-gray-600">
                Glissez et déposez des blocs pour construire votre page
              </p>
            </div>

            {sections.length === 0 ? (
              <EmptyDropZone onAdd={handleAddBlock} />
            ) : (
              <div className="space-y-4">
                {sections.map((section, index) => (
                  <PageSection
                    key={section.id}
                    section={section}
                    index={index}
                    onMove={handleMoveSection}
                    onEdit={handleEditSection}
                    onToggle={handleToggleSection}
                    onDelete={handleDeleteSection}
                    onDuplicate={handleDuplicateSection}
                  />
                ))}
                
                {/* Drop zone at bottom */}
                <div className="mt-8">
                  <EmptyDropZone onAdd={handleAddBlock} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section editor modal */}
      {editingSection && (
        <SectionEditorModal
          section={editingSection}
          onSave={handleSaveSection}
          onClose={() => setEditingSection(null)}
        />
      )}
    </DndProvider>
  );
}

// Section editor modal (simplified for now)
function SectionEditorModal({ section, onSave, onClose }) {
  const [config, setConfig] = useState(section.config);

  const handleSave = () => {
    onSave({ ...section, config });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Modifier: {BLOCK_TYPES[section.type]?.name || section.type}
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {Object.entries(config).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={String(value)}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
