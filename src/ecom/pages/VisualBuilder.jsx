import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';
import VisualSiteBuilder from '../components/VisualSiteBuilder.jsx';

const VisualBuilder = () => {
  const [sections, setSections] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Charger les sections et paramètres de la boutique
        const [pagesRes, settingsRes] = await Promise.all([
          api.get('/store/pages').catch(() => ({ data: { data: { sections: [] } } })),
          api.get('/store/settings').catch(() => ({ data: { data: {} } }))
        ]);

        const sectionsData = pagesRes.data?.data?.sections || [];
        const settingsData = settingsRes.data?.data || {};

        setSections(sectionsData);
        setStoreSettings(settingsData);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Sauvegarder les sections
  const handleSave = async (updatedSections) => {
    setSaving(true);
    try {
      await api.put('/store/pages', { sections: updatedSections });
      setSections(updatedSections);
      
      // Notification de succès
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '✓ Site sauvegardé avec succès !';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      
      // Notification d'erreur
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '❌ Erreur lors de la sauvegarde';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  // Configuration du thème pour le preview
  const theme = {
    cta: storeSettings.themeColor || '#0F6B4F',
    text: storeSettings.textColor || '#111827',
    bg: storeSettings.backgroundColor || '#FFFFFF',
    font: storeSettings.font || 'Inter, system-ui, sans-serif',
    radius: storeSettings.borderRadius || '0.75rem',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <VisualSiteBuilder
        initialSections={sections}
        theme={theme}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
};

export default VisualBuilder;
