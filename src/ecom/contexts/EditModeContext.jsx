import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../../lib/api';

const EditModeContext = createContext(null);

/**
 * EditModeProvider - Gère le mode édition du storefront
 * 
 * Permet au propriétaire de la boutique de modifier les sections
 * directement depuis le storefront en mode WYSIWYG.
 */
export function EditModeProvider({ children, storeId, isOwner = false }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Vérifier si l'utilisateur peut éditer
  const canEdit = isOwner;

  // Toggle mode édition
  const toggleEditMode = useCallback(() => {
    if (!canEdit) return;
    setIsEditMode(prev => !prev);
    if (isEditMode) {
      // Quand on quitte le mode édition, réinitialiser
      setEditingSection(null);
    }
  }, [canEdit, isEditMode]);

  // Activer l'édition d'une section spécifique
  const startEditing = useCallback((sectionId, sectionData) => {
    if (!canEdit || !isEditMode) return;
    setEditingSection({ id: sectionId, data: sectionData });
  }, [canEdit, isEditMode]);

  // Arrêter l'édition de la section courante
  const stopEditing = useCallback(() => {
    setEditingSection(null);
  }, []);

  // Enregistrer une modification locale (pas encore persistée)
  const updateSection = useCallback((sectionId, updates) => {
    setPendingChanges(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), ...updates }
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Sauvegarder toutes les modifications
  const saveChanges = useCallback(async () => {
    if (!storeId || Object.keys(pendingChanges).length === 0) return;
    
    setIsSaving(true);
    try {
      await api.put(`/store/${storeId}/sections`, { sections: pendingChanges });
      setPendingChanges({});
      setHasUnsavedChanges(false);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [storeId, pendingChanges]);

  // Annuler toutes les modifications
  const discardChanges = useCallback(() => {
    setPendingChanges({});
    setHasUnsavedChanges(false);
    setEditingSection(null);
  }, []);

  // Obtenir les données d'une section avec les modifications en attente
  const getSectionData = useCallback((sectionId, originalData) => {
    const changes = pendingChanges[sectionId];
    if (!changes) return originalData;
    return { ...originalData, ...changes };
  }, [pendingChanges]);

  // Avertir avant de quitter si modifications non sauvegardées
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const value = {
    // État
    isEditMode,
    canEdit,
    editingSection,
    hasUnsavedChanges,
    isSaving,
    pendingChanges,
    
    // Actions
    toggleEditMode,
    startEditing,
    stopEditing,
    updateSection,
    saveChanges,
    discardChanges,
    getSectionData,
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte du mode édition
 */
export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    // Si pas de provider, retourner un état par défaut (lecture seule)
    return {
      isEditMode: false,
      canEdit: false,
      editingSection: null,
      hasUnsavedChanges: false,
      isSaving: false,
      pendingChanges: {},
      toggleEditMode: () => {},
      startEditing: () => {},
      stopEditing: () => {},
      updateSection: () => {},
      saveChanges: async () => ({ success: false }),
      discardChanges: () => {},
      getSectionData: (_, data) => data,
    };
  }
  return context;
}

export default EditModeContext;
