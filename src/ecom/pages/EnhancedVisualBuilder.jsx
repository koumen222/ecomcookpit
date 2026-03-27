import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useBroadcastTheme } from '../hooks/useThemeSocket';
import { BlockLibrary, BuilderCanvas } from '../components/PageBuilder';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import api from '../../lib/api';
import {
  ArrowLeft, Save, Check, Loader2, Palette, LayoutGrid, Monitor,
  Smartphone, Tablet, RefreshCw, ExternalLink, Zap, Eye, Settings
} from 'lucide-react';

// Theme customization panel
function ThemeCustomizer({ theme, onThemeUpdate }) {
  const [localTheme, setLocalTheme] = useState(theme);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const updateTheme = useCallback((updates) => {
    const newTheme = { ...localTheme, ...updates };
    setLocalTheme(newTheme);
    onThemeUpdate(newTheme);
  }, [localTheme, onThemeUpdate]);

  const colorOptions = [
    { key: 'primaryColor', label: 'Couleur principale' },
    { key: 'ctaColor', label: 'Boutons CTA' },
    { key: 'backgroundColor', label: 'Arrière-plan' },
    { key: 'textColor', label: 'Texte' },
  ];

  const fontOptions = [
    { id: 'inter', name: 'Inter' },
    { id: 'poppins', name: 'Poppins' },
    { id: 'dm-sans', name: 'DM Sans' },
    { id: 'montserrat', name: 'Montserrat' },
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Colors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Couleurs</h3>
        <div className="space-y-3">
          {colorOptions.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localTheme[key] || '#000000'}
                  onChange={(e) => updateTheme({ [key]: e.target.value })}
                  className="w-8 h-6 rounded border border-gray-200"
                />
                <input
                  type="text"
                  value={localTheme[key] || ''}
                  onChange={(e) => updateTheme({ [key]: e.target.value })}
                  className="w-20 px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Police</h3>
        <div className="grid grid-cols-2 gap-2">
          {fontOptions.map((font) => (
            <button
              key={font.id}
              onClick={() => updateTheme({ font: font.id })}
              className={`p-2 text-xs font-medium rounded border transition ${
                localTheme.font === font.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Arrondis</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'none', label: 'Aucun' },
            { id: 'sm', label: 'Petit' },
            { id: 'md', label: 'Moyen' },
            { id: 'lg', label: 'Large' },
            { id: 'xl', label: 'Extra' },
            { id: 'full', label: 'Rond' },
          ].map((radius) => (
            <button
              key={radius.id}
              onClick={() => updateTheme({ borderRadius: radius.id })}
              className={`p-2 text-xs font-medium rounded border transition ${
                localTheme.borderRadius === radius.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {radius.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Aperçu</h3>
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            backgroundColor: localTheme.backgroundColor,
            color: localTheme.textColor,
          }}
        >
          <h4 className="text-sm font-semibold mb-2">Titre d'exemple</h4>
          <p className="text-xs mb-3 opacity-80">Voici un texte d'exemple pour voir le rendu.</p>
          <div className="flex gap-2">
            <button 
              className="px-3 py-1 text-xs font-medium text-white rounded"
              style={{ backgroundColor: localTheme.primaryColor }}
            >
              Bouton principal
            </button>
            <button 
              className="px-3 py-1 text-xs font-medium text-white rounded"
              style={{ backgroundColor: localTheme.ctaColor }}
            >
              CTA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Device preview frame
function DeviceFrame({ device, subdomain, iframeKey }) {
  const deviceConfigs = {
    desktop: { width: '100%', height: '800px', label: 'Bureau' },
    tablet: { width: '768px', height: '1024px', label: 'Tablette' },
    mobile: { width: '375px', height: '667px', label: 'Mobile' },
  };

  const config = deviceConfigs[device] || deviceConfigs.desktop;
  const iframeSrc = subdomain ? `/store/${subdomain}` : null;

  if (!subdomain) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🏪</div>
          <p className="text-sm font-medium">Aucune boutique configurée</p>
          <p className="text-xs mt-1">Configurez un sous-domaine dans les paramètres</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-100 flex flex-col items-center justify-start p-6 overflow-auto">
      <div className="text-center mb-4">
        <span className="text-xs text-gray-500 font-medium">{config.label}</span>
      </div>
      
      <div
        className="bg-white rounded-lg shadow-xl overflow-hidden"
        style={{ width: config.width, maxWidth: '100%' }}
      >
        {/* Browser chrome */}
        <div className="h-8 bg-gray-100 border-b flex items-center px-3 gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded px-2 py-0.5 text-xs text-gray-500 font-mono">
            {window.location.origin}/store/{subdomain}
          </div>
        </div>
        
        <iframe
          key={iframeKey}
          src={iframeSrc}
          className="w-full border-0"
          style={{ height: config.height }}
          title="Store Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}

const EnhancedVisualBuilder = () => {
  const navigate = useNavigate();
  const { theme, updateTheme } = useTheme();
  
  // Store data
  const [subdomain, setSubdomain] = useState('');
  const [sections, setSections] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'theme' | 'settings'
  const [device, setDevice] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(0);

  // Real-time broadcasting
  const { broadcast, isConnected } = useBroadcastTheme(subdomain);
  const [lastBroadcast, setLastBroadcast] = useState(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [domainsRes, pagesRes] = await Promise.all([
          api.get('/store/domains').catch(() => ({ data: { data: {} } })),
          api.get('/store/pages').catch(() => ({ data: { data: { sections: [] } } })),
        ]);

        setSubdomain(domainsRes.data?.data?.subdomain || '');
        setSections(pagesRes.data?.data?.sections || []);
      } catch (error) {
        console.error('[VisualBuilder] Load error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Broadcast theme changes
  useEffect(() => {
    if (subdomain && !loading) {
      broadcast({ ...theme, _pages: sections });
      setLastBroadcast(Date.now());
    }
  }, [theme, sections, subdomain, loading, broadcast]);

  // Handle theme updates
  const handleThemeUpdate = useCallback((themeUpdates) => {
    updateTheme(themeUpdates, false); // Don't persist immediately
  }, [updateTheme]);

  // Handle sections update
  const handleSectionsUpdate = useCallback((newSections) => {
    setSections(newSections);
    setSaved(false);
  }, []);

  // Save/publish changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [
        updateTheme(theme, true), // Persist theme
      ];
      
      if (sections.length > 0) {
        promises.push(api.put('/store/pages', { sections }));
      }

      await Promise.all(promises);
      setSaved(true);
      setIframeKey(k => k + 1); // Reload preview
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Save error:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Chargement du builder...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/ecom/boutique')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
            
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="text-lg font-bold text-gray-900">Site Builder</h1>
            
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isConnected ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-600'
            }`}>
              <Zap className="w-3 h-3" />
              <span className="font-medium">{isConnected ? 'Live' : 'Connexion...'}</span>
              {lastBroadcast && isConnected && (
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode switcher: Edit / Preview */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('builder')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab !== 'preview' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Éditer
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === 'preview' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                Aperçu
              </button>
            </div>

            {activeTab === 'preview' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                {[
                  { id: 'desktop', icon: <Monitor className="w-4 h-4" />, label: 'Bureau' },
                  { id: 'tablet', icon: <Tablet className="w-4 h-4" />, label: 'Tablette' },
                  { id: 'mobile', icon: <Smartphone className="w-4 h-4" />, label: 'Mobile' },
                ].map(({ id, icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setDevice(id)}
                    className={`p-2 rounded-md transition ${
                      device === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title={label}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}

            <div className="w-px h-6 bg-gray-200" />

            <button
              onClick={() => setIframeKey(k => k + 1)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 transition"
              title="Rafraîchir l'aperçu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {subdomain && (
              <a
                href={`https://${subdomain}.scalor.net`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 transition"
                title="Ouvrir la boutique"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition ${
                saved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved ? <Check className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
              {saved ? 'Publié !' : 'Publier'}
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Mode Édition ─────────────────────────────────────────── */}
          {activeTab !== 'preview' && (
            <>
              {/* Sidebar gauche : onglets Blocs / Thème / Config */}
              <div className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
                <div className="flex border-b border-gray-200">
                  {[
                    { id: 'builder', label: 'Blocs',  icon: <LayoutGrid className="w-4 h-4" /> },
                    { id: 'theme',   label: 'Thème',  icon: <Palette className="w-4 h-4" /> },
                    { id: 'settings',label: 'Config', icon: <Settings className="w-4 h-4" /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'builder' && <BlockLibrary />}
                  {activeTab === 'theme' && (
                    <ThemeCustomizer theme={theme} onThemeUpdate={handleThemeUpdate} />
                  )}
                  {activeTab === 'settings' && (
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sous-domaine</label>
                        <input
                          type="text"
                          value={subdomain}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">{subdomain}.scalor.net</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sections</label>
                        <p className="text-sm text-gray-600">
                          {sections.length} section{sections.length !== 1 ? 's' : ''} configurée{sections.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Canvas principal — glisser-déposer */}
              <div className="flex-1 overflow-hidden">
                <BuilderCanvas
                  sections={sections}
                  onUpdateSections={handleSectionsUpdate}
                />
              </div>
            </>
          )}

          {/* ── Mode Aperçu ───────────────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="flex-1 flex flex-col">
              <DeviceFrame device={device} subdomain={subdomain} iframeKey={iframeKey} />
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
};

export default EnhancedVisualBuilder;
