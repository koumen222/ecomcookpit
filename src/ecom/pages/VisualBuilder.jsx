import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useBroadcastTheme } from '../hooks/useThemeSocket';
import {
  ArrowLeft, Save, Check, Loader2,
  Palette, Type, Square, LayoutGrid, Monitor,
  Smartphone, Tablet, RotateCcw, Zap, ExternalLink,
  RefreshCw, GripVertical, Trash2
} from 'lucide-react';

// ─── Templates ──────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'classic',  name: 'Classique', desc: 'Standard e-commerce' },
  { id: 'premium',  name: 'Premium',   desc: 'Haut-de-gamme' },
  { id: 'minimal',  name: 'Minimal',   desc: 'Épuré et rapide' },
];

const SECTION_FIELD_SCHEMAS = {
  hero: [
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'subtitle', label: 'Sous-titre', type: 'textarea' },
    { key: 'ctaText', label: 'Texte CTA', type: 'text' },
    { key: 'bgImage', label: 'Image de fond (URL)', type: 'image' },
  ],
  featured_products: [
    { key: 'title', label: 'Titre section', type: 'text' },
    { key: 'count', label: 'Nombre de produits', type: 'number' },
  ],
  promo_banner: [
    { key: 'text', label: 'Texte promo', type: 'text' },
    { key: 'bgColor', label: 'Couleur de fond', type: 'color' },
  ],
  reviews: [{ key: 'title', label: 'Titre', type: 'text' }],
  faq: [{ key: 'title', label: 'Titre', type: 'text' }],
  cta: [
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'buttonText', label: 'Texte du bouton', type: 'text' },
    { key: 'buttonUrl', label: 'Lien du bouton', type: 'text' },
  ],
  newsletter: [{ key: 'title', label: 'Titre', type: 'text' }],
  custom: [
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'content', label: 'Contenu', type: 'textarea' },
    { key: 'image', label: 'Image (URL)', type: 'image' },
  ],
};

function inferFieldType(key, value) {
  if (Array.isArray(value)) return 'list';
  if (value && typeof value === 'object') return 'json';
  if (typeof value === 'number') return 'number';
  if (key.toLowerCase().includes('color')) return 'color';
  if (key.toLowerCase().includes('image') || key.toLowerCase().includes('bgimage')) return 'image';
  if (typeof value === 'string' && value.length > 80) return 'textarea';
  return 'text';
}

function getSectionFields(section) {
  const schema = SECTION_FIELD_SCHEMAS[section.type];
  const dynamic = Object.entries(section.config || {}).map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    type: inferFieldType(key, value),
  }));

  if (!schema) return dynamic;

  const existingKeys = new Set(schema.map((f) => f.key));
  const extras = dynamic.filter((f) => !existingKeys.has(f.key));
  return [...schema, ...extras];
}

function buildDefaultSubItem(list = []) {
  const first = list[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return Object.keys(first).reduce((acc, key) => {
      acc[key] = typeof first[key] === 'number' ? 0 : '';
      return acc;
    }, {});
  }
  if (typeof first === 'number') return 0;
  if (typeof first === 'string') return '';
  return { title: '', content: '' };
}

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function renderInlineScalarInput(value, onChange) {
  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={Number(value) || 0}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
    />
  );
}

// ─── Section editor modal ────────────────────────────────────────────────────
function SectionEditor({ section, onSave, onClose, onDelete }) {
  const [config, setConfig] = useState(section?.config || {});
  if (!section) return null;
  const fields = getSectionFields(section);
  const update = (k, v) => setConfig((p) => ({ ...p, [k]: v }));
  const updateArrayItem = (key, index, nextItem) => {
    const nextList = [...(config?.[key] || [])];
    nextList[index] = nextItem;
    update(key, nextList);
  };

  const removeArrayItem = (key, index) => {
    const nextList = (config?.[key] || []).filter((_, i) => i !== index);
    update(key, nextList);
  };

  const addArrayItem = (key) => {
    const current = config?.[key] || [];
    update(key, [...current, buildDefaultSubItem(current)]);
  };

  const renderField = ({ key, label, type }) => {
    const value = config?.[key] ?? '';

    if (type === 'textarea') {
      return (
        <textarea
          value={String(value)}
          onChange={(e) => update(key, e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
        />
      );
    }

    if (type === 'json') {
      return (
        <textarea
          value={JSON.stringify(value || {}, null, 2)}
          rows={4}
          onChange={(e) => {
            try {
              update(key, JSON.parse(e.target.value || '{}'));
            } catch {
              // keep invalid JSON as-is in UI without crashing
            }
          }}
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
        />
      );
    }

    if (type === 'list') {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-[11px] text-gray-400">Aucune sous-section.</p>
          )}

          {list.map((item, idx) => (
            <div key={`${key}-${idx}`} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-600">Sous-section {idx + 1}</p>
                <button
                  type="button"
                  onClick={() => removeArrayItem(key, idx)}
                  className="text-[11px] text-red-500 hover:text-red-600"
                >
                  Supprimer
                </button>
              </div>

              {item && typeof item === 'object' && !Array.isArray(item) ? (
                <div className="space-y-2">
                  {Object.entries(item).map(([subKey, subValue]) => (
                    <div key={subKey}>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                        {humanizeKey(subKey)}
                      </label>
                      {renderInlineScalarInput(subValue, (nextValue) => {
                        updateArrayItem(key, idx, { ...item, [subKey]: nextValue });
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                renderInlineScalarInput(item, (nextValue) => {
                  updateArrayItem(key, idx, nextValue);
                })
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => addArrayItem(key)}
            className="w-full py-2 text-xs font-semibold text-[#0F6B4F] bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
          >
            + Ajouter une sous-section
          </button>
        </div>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          value={Number(value) || 0}
          onChange={(e) => update(key, parseInt(e.target.value, 10) || 0)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
        />
      );
    }

    if (type === 'color') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value || '#000000')}
            onChange={(e) => update(key, e.target.value)}
            className="w-10 h-10 rounded-lg border border-gray-200"
          />
          <input
            type="text"
            value={String(value)}
            onChange={(e) => update(key, e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
          />
        </div>
      );
    }

    if (type === 'image') {
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={String(value)}
            placeholder="https://..."
            onChange={(e) => update(key, e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
          />
          {value ? (
            <img
              src={String(value)}
              alt="preview"
              className="w-full h-24 object-cover rounded-lg border border-gray-200"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : null}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => update(key, e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Modifier : {section.label || section.type}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                {field.label}
              </label>
              {renderField(field)}
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-gray-400">Aucun champ éditable pour cette section.</p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition"
            title="Supprimer cette section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="flex-1 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">Annuler</button>
          <button onClick={() => { onSave({ ...section, config }); onClose(); }}
            className="flex-1 py-2 text-xs font-bold text-white bg-[#0F6B4F] rounded-xl hover:bg-[#0A5740] transition">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const NEW_SECTION_TEMPLATES = {
  hero: {
    label: 'Hero / Bannière',
    config: { title: 'Bienvenue', subtitle: 'Découvrez nos nouveautés', ctaText: 'Voir les produits', bgImage: '' },
  },
  featured_products: {
    label: 'Produits vedettes',
    config: { count: 8, title: 'Nos Produits' },
  },
  promo_banner: {
    label: 'Bandeau promo',
    config: { text: 'Livraison offerte aujourd’hui', bgColor: '#EF4444' },
  },
  reviews: {
    label: 'Avis clients',
    config: { title: 'Ce que disent nos clients' },
  },
  faq: {
    label: 'FAQ',
    config: { title: 'Questions fréquentes', items: [] },
  },
  cta: {
    label: 'Call to Action',
    config: { title: 'Prêt à commander ?', buttonText: 'Commander', buttonUrl: '' },
  },
  newsletter: {
    label: 'Newsletter',
    config: { title: 'Recevez nos offres' },
  },
  custom: {
    label: 'Section personnalisée',
    config: { title: 'Nouveau bloc', content: '', image: '' },
  },
};

const SECTION_GROUPS = [
  {
    id: 'header',
    title: 'En-tête',
    test: (type) => ['horizontal_ticker', 'announcement_bar', 'header', 'cart_drawer'].includes(type),
  },
  {
    id: 'model',
    title: 'Modèle',
    test: (type) => !['horizontal_ticker', 'announcement_bar', 'header', 'cart_drawer', 'footer'].includes(type),
  },
  {
    id: 'footer',
    title: 'Pied de page',
    test: (type) => type === 'footer',
  },
];

// ─── Theme helpers ─────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { id: 'inter',        label: 'Inter',          css: 'Inter, system-ui, sans-serif' },
  { id: 'poppins',      label: 'Poppins',         css: 'Poppins, sans-serif' },
  { id: 'dm-sans',      label: 'DM Sans',         css: '"DM Sans", sans-serif' },
  { id: 'montserrat',   label: 'Montserrat',      css: 'Montserrat, sans-serif' },
  { id: 'playfair',     label: 'Playfair Display',css: '"Playfair Display", serif' },
  { id: 'space-grotesk',label: 'Space Grotesk',   css: '"Space Grotesk", sans-serif' },
];

const RADIUS_OPTIONS = [
  { id: 'none', label: 'Aucun',    px: '0px' },
  { id: 'sm',   label: 'Léger',   px: '6px' },
  { id: 'md',   label: 'Moyen',   px: '12px' },
  { id: 'lg',   label: 'Large',   px: '16px' },
  { id: 'xl',   label: 'Extra',   px: '24px' },
  { id: 'full', label: 'Pilule',  px: '9999px' },
];

const DEFAULT_THEME = {
  template: 'classic',
  primaryColor: '#0F6B4F',
  ctaColor: '#0F6B4F',
  textColor: '#111827',
  backgroundColor: '#FFFFFF',
  font: 'inter',
  borderRadius: 'lg',
  sections: {
    showReviews: true,
    showFaq: true,
    showStockCounter: false,
    showPromoBanner: true,
    showTrustBadges: true,
    showRelatedProducts: true,
    showWhatsappButton: true,
    showBenefits: true,
    showNewsletter: false,
  },
};

const PRODUCT_PAGE_TOGGLES = [
  { key: 'showReviews',         label: 'Avis clients',         desc: 'Section témoignages' },
  { key: 'showFaq',             label: 'FAQ',                  desc: 'Questions fréquentes' },
  { key: 'showStockCounter',    label: 'Compteur de stock',    desc: 'Pièces restantes' },
  { key: 'showPromoBanner',     label: 'Bandeau promo',        desc: 'Promo en haut' },
  { key: 'showTrustBadges',     label: 'Badges confiance',     desc: 'Livraison, retours...' },
  { key: 'showRelatedProducts', label: 'Produits similaires',  desc: 'Recommandations' },
  { key: 'showBenefits',        label: 'Bénéfices produit',    desc: 'Points forts' },
  { key: 'showWhatsappButton',  label: 'Bouton WhatsApp',      desc: 'Commander via WA' },
  { key: 'showNewsletter',      label: 'Newsletter',           desc: 'Abonnement email' },
];

// ─── Iframe live preview ──────────────────────────────────────────────────────
function IframePreview({ subdomain, device, iframeKey, onLoad }) {
  const deviceConfig = {
    desktop: { width: '100%',  scale: 1,    label: 'Bureau' },
    tablet:  { width: '768px', scale: 0.85, label: 'Tablette' },
    mobile:  { width: '390px', scale: 0.75, label: 'Mobile' },
  };
  const { width } = deviceConfig[device] || deviceConfig.desktop;

  // Build the iframe URL — same origin React SPA route
  const iframeSrc = subdomain ? `/store/${subdomain}` : null;

  if (!subdomain) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🏪</div>
          <p className="text-sm font-medium">Boutique introuvable</p>
          <p className="text-xs mt-1">Configurez un sous-domaine dans les paramètres</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#e8eaed] flex flex-col overflow-hidden">
      {/* Device chrome */}
      {device !== 'desktop' && (
        <div className="flex justify-center pt-3 pb-1 text-xs text-gray-400 font-medium select-none">
          {deviceConfig[device].label} — {width}
        </div>
      )}

      {/* Iframe wrapper */}
      <div className="flex-1 flex items-start justify-center overflow-auto p-3 pt-2">
        <div
          className="shadow-xl rounded-b-none rounded-t-lg overflow-hidden bg-white"
          style={{
            width,
            maxWidth: '100%',
            transformOrigin: 'top center',
          }}
        >
          {/* Browser chrome bar */}
          <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-3 gap-2 select-none">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-400 font-mono border border-gray-200 truncate">
              {window.location.origin}/store/{subdomain}
            </div>
          </div>

          <iframe
            key={iframeKey}
            src={iframeSrc}
            title="Store Preview"
            onLoad={onLoad}
            className="block w-full border-0"
            style={{ height: device === 'mobile' ? '780px' : '860px' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Color picker row ─────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
        />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono bg-gray-50"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ─── Section toggle row ───────────────────────────────────────────────────────
function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ─── Accordion section ────────────────────────────────────────────────────────
function AccordionSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-3 space-y-0.5">{children}</div>}
    </div>
  );
}

// ─── Section list for the Sections tab ──────────────────────────────────────
const SECTION_LABELS = {
  hero:             { label: 'Section Hero',       icon: '🦸' },
  featured_products:{ label: 'Grille Produits',    icon: '🛍️' },
  promo_banner:     { label: 'Bandeau Promo',      icon: '📢' },
  trust_badges:     { label: 'Badges Confiance',   icon: '🛡️' },
  reviews:          { label: 'Avis Clients',       icon: '⭐' },
  faq:              { label: 'FAQ',                icon: '❓' },
  newsletter:       { label: 'Newsletter',         icon: '📧' },
  cta:              { label: 'Call to Action',     icon: '🎯' },
  footer:           { label: 'Pied de page',       icon: '🔻' },
};

// ─── Main VisualBuilder ──────────────────────────────────────────────────────
const VisualBuilder = () => {
  const navigate = useNavigate();

  // Theme state
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoingRef = useRef(false);

  // Store meta
  const [subdomain, setSubdomain] = useState('');
  const [storeName, setStoreName] = useState('');

  // Sections (storePages)
  const [sections, setSections] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('theme'); // 'theme' | 'sections'
  const [device, setDevice] = useState('desktop');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [dragIdx, setDragIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);

  const { broadcast, isConnected } = useBroadcastTheme(subdomain);

  // Always reflects latest sections in broadcast without stale closures
  const sectionsRef = useRef([]);
  sectionsRef.current = sections;
  
  // Track last broadcast time for visual feedback
  const [lastBroadcast, setLastBroadcast] = useState(null);
  
  // Clear broadcast indicator after 1 second
  useEffect(() => {
    if (!lastBroadcast) return;
    const timer = setTimeout(() => setLastBroadcast(null), 1000);
    return () => clearTimeout(timer);
  }, [lastBroadcast]);

  // ── Load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [themeRes, domainsRes, pagesRes, settingsRes] = await Promise.all([
          api.get('/store/theme').catch(() => ({ data: { data: {} } })),
          api.get('/store/domains').catch(() => ({ data: { data: {} } })),
          api.get('/store/pages').catch(() => ({ data: { data: { sections: [] } } })),
          api.get('/store/settings').catch(() => ({ data: { data: {} } })),
        ]);

        const loaded = { ...DEFAULT_THEME, ...(themeRes.data?.data || {}) };
        setTheme(loaded);
        historyRef.current = [loaded];
        historyIndexRef.current = 0;

        setSubdomain(domainsRes.data?.data?.subdomain || '');
        setSections(pagesRes.data?.data?.sections || []);
        setStoreName(settingsRes.data?.data?.name || '');
      } catch (e) {
        console.error('[VisualBuilder] load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Theme update + undo history + socket broadcast ───────────────────────
  const updateTheme = useCallback((patch) => {
    setTheme(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      if (!isUndoingRef.current) {
        const sliced = historyRef.current.slice(0, historyIndexRef.current + 1);
        sliced.push(next);
        historyRef.current = sliced.slice(-30);
        historyIndexRef.current = historyRef.current.length - 1;
      }
      broadcast({ ...next, _pages: sectionsRef.current });
      setLastBroadcast(Date.now());
      return next;
    });
    setSaved(false);
  }, [broadcast]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const prev = historyRef.current[historyIndexRef.current];
    isUndoingRef.current = true;
    setTheme(prev);
    broadcast({ ...prev, _pages: sectionsRef.current });
    setLastBroadcast(Date.now());
    setSaved(false);
    isUndoingRef.current = false;
  }, [broadcast]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const next = historyRef.current[historyIndexRef.current];
    isUndoingRef.current = true;
    setTheme(next);
    broadcast({ ...next, _pages: sectionsRef.current });
    setLastBroadcast(Date.now());
    setSaved(false);
    isUndoingRef.current = false;
  }, [broadcast]);

  // ── Broadcast sections whenever they change (e.g. toggle, move, add, delete) ──
  const themeRef = useRef(theme);
  themeRef.current = theme;
  useEffect(() => {
    if (!subdomain || loading) return;
    broadcast({ ...themeRef.current, _pages: sections });
    setLastBroadcast(Date.now());
  }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section (storePages) operations ─────────────────────────────────────
  const toggleSection = useCallback((idx) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
    setSaved(false);
  }, []);

  const moveSection = useCallback((from, to) => {
    setSections(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSaved(false);
  }, []);

  const updateSectionConfig = useCallback((updated) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSaved(false);
  }, []);

  const addSection = useCallback((type = 'custom') => {
    const tpl = NEW_SECTION_TEMPLATES[type] || NEW_SECTION_TEMPLATES.custom;
    setSections(prev => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        label: tpl.label,
        enabled: true,
        config: { ...tpl.config },
      },
    ]);
    setSaved(false);
  }, []);

  const removeSection = useCallback((idx) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }, []);

  const handleDragStart = useCallback((e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) return;
    moveSection(dragIdx, dropIdx);
    setDragIdx(null);
  }, [dragIdx, moveSection]);

  // ── Publish (theme + sections → DB, reload iframe) ────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const saves = [api.put('/store/theme', theme)];
      if (sections.length > 0) saves.push(api.put('/store/pages', { sections }));
      await Promise.all(saves);
      setSaved(true);
      setIframeKey(k => k + 1); // reload iframe with saved sections
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      alert('Erreur: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const groupedSections = useMemo(() => {
    return SECTION_GROUPS.map((group) => ({
      ...group,
      items: sections
        .map((section, idx) => ({ section, idx }))
        .filter(({ section }) => group.test(section.type)),
    }));
  }, [sections]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Chargement du builder…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ecom/boutique')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Retour</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-sm font-bold text-gray-800 tracking-tight">Site Builder</h1>
          <div 
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all ${
              isConnected 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-orange-50 border border-orange-200'
            }`}
            title={isConnected ? 'Aperçu en temps réel actif' : 'Connexion au serveur...'}
          >
            <Zap className={`w-3 h-3 ${isConnected ? 'text-emerald-600' : 'text-orange-500 animate-pulse'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${
              isConnected ? 'text-emerald-700' : 'text-orange-600'
            }`}>
              {isConnected ? 'Live' : 'Connexion...'}
            </span>
            {lastBroadcast && isConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <button onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)"
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-25 transition text-gray-500">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Rétablir"
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-25 transition text-gray-500"
            style={{ transform: 'scaleX(-1)' }}>
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Device switcher */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'desktop', icon: <Monitor className="w-3.5 h-3.5" />, title: 'Bureau' },
              { id: 'tablet',  icon: <Tablet className="w-3.5 h-3.5" />,  title: 'Tablette' },
              { id: 'mobile',  icon: <Smartphone className="w-3.5 h-3.5" />, title: 'Mobile' },
            ].map(({ id, icon, title }) => (
              <button key={id} onClick={() => setDevice(id)} title={title}
                className={`p-1.5 rounded-md transition ${device === id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              >{icon}</button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Reload iframe */}
          <button onClick={() => { setIframeLoaded(false); setIframeKey(k => k + 1); }}
            title="Recharger l'aperçu"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Open in new tab */}
          {subdomain && (
            <a href={`https://${subdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
              title="Ouvrir la boutique"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Publish */}
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg transition-all shadow-sm disabled:opacity-60 ml-1 ${
              saved ? 'bg-emerald-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
            }`}>
            {saving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : saved
              ? <Check className="w-3.5 h-3.5" />
              : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Publié !' : 'Publier'}
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Left panel ──────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {[
              { id: 'theme',    label: 'Thème',    icon: <Palette className="w-3.5 h-3.5" /> },
              { id: 'sections', label: 'Sections', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#0F6B4F] text-[#0F6B4F]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── THÈME TAB ── */}
            {activeTab === 'theme' && (
              <>
                {/* Template */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Template</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => updateTheme({ template: t.id })}
                        className={`py-2 px-1 text-[10px] font-semibold rounded-lg border transition flex flex-col items-center gap-0.5 ${
                          theme.template === t.id
                            ? 'border-[#0F6B4F] bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50'
                        }`}>
                        {t.name}
                        <span className="text-[9px] font-normal text-gray-400">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <AccordionSection title="Couleurs" icon={<Palette className="w-4 h-4" />} defaultOpen>
                  <ColorRow label="Couleur principale"
                    value={theme.primaryColor}
                    onChange={v => updateTheme({ primaryColor: v })} />
                  <ColorRow label="Boutons CTA"
                    value={theme.ctaColor}
                    onChange={v => updateTheme({ ctaColor: v })} />
                  <ColorRow label="Couleur texte"
                    value={theme.textColor}
                    onChange={v => updateTheme({ textColor: v })} />
                  <ColorRow label="Fond de page"
                    value={theme.backgroundColor}
                    onChange={v => updateTheme({ backgroundColor: v })} />
                  {/* Live preview strip */}
                  <div className="mt-2 p-2.5 rounded-xl border border-gray-200" style={{ backgroundColor: theme.backgroundColor }}>
                    <div className="flex gap-1.5 mb-1.5">
                      <div className="flex-1 h-1.5 rounded" style={{ backgroundColor: theme.primaryColor }} />
                      <div className="flex-1 h-1.5 rounded" style={{ backgroundColor: theme.ctaColor }} />
                    </div>
                    <button className="w-full py-1 text-[10px] font-bold text-white rounded-lg" style={{ backgroundColor: theme.ctaColor }}>
                      Aperçu bouton
                    </button>
                  </div>
                </AccordionSection>

                <AccordionSection title="Typographie" icon={<Type className="w-4 h-4" />} defaultOpen>
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block">Police</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FONT_OPTIONS.map(f => (
                        <button key={f.id} onClick={() => updateTheme({ font: f.id })}
                          className={`px-2 py-2 text-xs rounded-lg border transition text-left truncate leading-tight ${
                            theme.font === f.id
                              ? 'border-[#0F6B4F] bg-emerald-50 text-emerald-700 font-semibold'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-gray-50'
                          }`}
                          style={{ fontFamily: f.css }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection title="Formes" icon={<Square className="w-4 h-4" />} defaultOpen>
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block">Arrondi des boutons & cartes</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {RADIUS_OPTIONS.map(r => (
                        <button key={r.id} onClick={() => updateTheme({ borderRadius: r.id })}
                          className={`py-2 text-[11px] font-medium border transition flex flex-col items-center gap-1.5 ${
                            theme.borderRadius === r.id
                              ? 'border-[#0F6B4F] bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50'
                          }`}
                          style={{ borderRadius: r.px }}>
                          <div className="w-6 h-4 border-2 border-current" style={{ borderRadius: r.px }} />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </AccordionSection>
              </>
            )}

            {/* ── SECTIONS TAB ── */}
            {activeTab === 'sections' && (
              <div className="p-3 space-y-3">
                {sections.length === 0 && (
                  <div className="text-center py-6 text-gray-400 bg-gray-50 border border-gray-200 rounded-xl">
                    <LayoutGrid className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucune section configurée</p>
                  </div>
                )}

                {groupedSections.map((group) => (
                  <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{group.title}</p>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {group.items.length === 0 && (
                        <p className="text-[11px] text-gray-400 px-1 py-2">Aucune section</p>
                      )}

                      {group.items.map(({ section, idx }) => {
                        const meta = SECTION_LABELS[section.type] || { label: section.label || section.type, icon: '📄' };
                        return (
                          <div
                            key={section.id || idx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all group cursor-grab ${
                              dragIdx === idx
                                ? 'border-[#0F6B4F] shadow-md bg-emerald-50'
                                : section.enabled
                                  ? 'bg-white border-gray-200'
                                  : 'bg-gray-50 border-gray-100 opacity-60'
                            }`}
                          >
                            <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <span className="text-sm leading-none flex-shrink-0">{meta.icon}</span>
                            <button
                              type="button"
                              onClick={() => setEditingIdx(idx)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <p className={`text-xs font-semibold truncate ${section.enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                                {meta.label}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate">{section.type}</p>
                            </button>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => setEditingIdx(idx)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 text-[10px]"
                                title="Modifier"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => removeSection(idx)}
                                className="p-1 rounded hover:bg-red-50 text-red-500"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => toggleSection(idx)}
                              className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${section.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${section.enabled ? 'translate-x-4' : ''}`} />
                            </button>
                          </div>
                        );
                      })}

                      <div className="pt-1">
                        <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide px-1 block mb-1">Ajouter une section</label>
                        <select
                          onChange={(e) => {
                            if (!e.target.value) return;
                            addSection(e.target.value);
                            e.target.value = '';
                          }}
                          defaultValue=""
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent"
                        >
                          <option value="" disabled>Choisir...</option>
                          {Object.entries(NEW_SECTION_TEMPLATES).map(([type, tpl]) => (
                            <option key={type} value={type}>{tpl.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Product page toggles */}
                <div className="pt-1">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide px-1 pb-2">Page Produit</p>
                  {PRODUCT_PAGE_TOGGLES.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-1.5">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs font-medium text-gray-700 truncate">{label}</p>
                        <p className="text-[10px] text-gray-400 truncate">{desc}</p>
                      </div>
                      <button
                        onClick={() => updateTheme((prev) => ({ ...prev, sections: { ...prev.sections, [key]: !(prev.sections?.[key] ?? true) } }))}
                        className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${theme.sections?.[key] !== false ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${theme.sections?.[key] !== false ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>

                {sections.length > 0 && (
                  <p className="text-[10px] text-gray-400 text-center pt-1">Publiez pour appliquer les changements live</p>
                )}
              </div>
            )}

            {/* Section editor modal */}
            {editingIdx !== null && sections[editingIdx] && (
              <SectionEditor
                section={sections[editingIdx]}
                onSave={updateSectionConfig}
                onDelete={() => removeSection(editingIdx)}
                onClose={() => setEditingIdx(null)}
              />
            )}
          </div>

          {/* Bottom info */}
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-500" />
              Thème appliqué en temps réel aux visiteurs
            </p>
          </div>
        </aside>

        {/* ─── Right panel — Real iframe preview ───────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Loading overlay while iframe loads */}
          {!iframeLoaded && subdomain && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-[#0F6B4F]" />
                <p className="text-sm text-gray-500 font-medium">Chargement de la boutique…</p>
              </div>
            </div>
          )}

          <IframePreview
            subdomain={subdomain}
            device={device}
            iframeKey={iframeKey}
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

      </div>
    </div>
  );
};

export default VisualBuilder;
