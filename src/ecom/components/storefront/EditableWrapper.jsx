import React, { useState, useCallback } from 'react';
import { Pencil, GripVertical, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useEditMode } from '../../contexts/EditModeContext';

/**
 * EditableWrapper - Enveloppe une section pour la rendre éditable
 * 
 * Affiche un overlay avec des contrôles quand le mode édition est actif.
 * Permet de modifier, masquer, ou réorganiser les sections.
 */
export function EditableWrapper({
  children,
  sectionId,
  sectionType,
  sectionData,
  onEdit,
  canReorder = true,
  canDelete = false,
  canHide = true,
}) {
  const {
    isEditMode,
    canEdit,
    editingSection,
    startEditing,
    updateSection,
  } = useEditMode();

  const [isHovered, setIsHovered] = useState(false);
  const isCurrentlyEditing = editingSection?.id === sectionId;

  // Gérer le toggle de visibilité
  const handleToggleVisibility = useCallback(() => {
    updateSection(sectionId, { visible: !sectionData?.visible });
  }, [sectionId, sectionData?.visible, updateSection]);

  // Gérer le clic sur "Modifier"
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(sectionId, sectionData);
    } else {
      startEditing(sectionId, sectionData);
    }
  }, [sectionId, sectionData, onEdit, startEditing]);

  // Si pas en mode édition ou pas de droits, afficher normalement
  if (!isEditMode || !canEdit) {
    return <>{children}</>;
  }

  const isVisible = sectionData?.visible !== false;

  return (
    <div
      className="editable-section-wrapper"
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Overlay au hover */}
      {isHovered && !isCurrentlyEditing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '2px dashed #3B82F6',
            borderRadius: 8,
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}

      {/* Barre d'outils au hover */}
      {isHovered && !isCurrentlyEditing && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
            zIndex: 20,
            backgroundColor: '#fff',
            padding: '6px 8px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {/* Handle pour drag & drop */}
          {canReorder && (
            <button
              style={{
                ...toolbarButtonStyle,
                cursor: 'grab',
              }}
              title="Réorganiser"
            >
              <GripVertical size={16} />
            </button>
          )}

          {/* Toggle visibilité */}
          {canHide && (
            <button
              onClick={handleToggleVisibility}
              style={{
                ...toolbarButtonStyle,
                color: isVisible ? '#6B7280' : '#EF4444',
              }}
              title={isVisible ? 'Masquer cette section' : 'Afficher cette section'}
            >
              {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}

          {/* Bouton Modifier */}
          <button
            onClick={handleEdit}
            style={{
              ...toolbarButtonStyle,
              backgroundColor: '#3B82F6',
              color: '#fff',
              padding: '6px 12px',
              gap: 6,
            }}
            title="Modifier cette section"
          >
            <Pencil size={14} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Modifier</span>
          </button>

          {/* Supprimer (si autorisé) */}
          {canDelete && (
            <button
              style={{
                ...toolbarButtonStyle,
                color: '#EF4444',
              }}
              title="Supprimer cette section"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

      {/* Label de section */}
      {isHovered && !isCurrentlyEditing && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: '#3B82F6',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            zIndex: 20,
          }}
        >
          {sectionType || sectionId}
        </div>
      )}

      {/* Overlay si masqué */}
      {!isVisible && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '12px 20px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            <EyeOff size={18} color="#6B7280" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Section masquée
            </span>
          </div>
        </div>
      )}

      {/* Contenu de la section */}
      <div style={{ opacity: isVisible ? 1 : 0.4 }}>
        {children}
      </div>
    </div>
  );
}

// Styles communs pour les boutons de la toolbar
const toolbarButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  borderRadius: 6,
  border: 'none',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

/**
 * EditToolbar - Barre d'outils flottante pour le mode édition
 */
export function EditToolbar() {
  const {
    isEditMode,
    canEdit,
    hasUnsavedChanges,
    isSaving,
    saveChanges,
    discardChanges,
    toggleEditMode,
  } = useEditMode();

  if (!canEdit) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        backgroundColor: '#1F2937',
        borderRadius: 50,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 9999,
      }}
    >
      {/* Toggle Mode Édition */}
      <button
        onClick={toggleEditMode}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 30,
          border: 'none',
          backgroundColor: isEditMode ? '#3B82F6' : '#374151',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <Pencil size={16} />
        {isEditMode ? 'Mode Édition Actif' : 'Activer Mode Édition'}
      </button>

      {/* Actions quand modifications en attente */}
      {isEditMode && hasUnsavedChanges && (
        <>
          <div
            style={{
              width: 1,
              height: 24,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          />
          
          <button
            onClick={discardChanges}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 30,
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'transparent',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
            Annuler
          </button>
          
          <button
            onClick={saveChanges}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              borderRadius: 30,
              border: 'none',
              backgroundColor: '#10B981',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            <Check size={14} />
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </>
      )}
    </div>
  );
}

export default EditableWrapper;
