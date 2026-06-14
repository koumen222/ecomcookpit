import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, ChevronRight, Download, Eye,
  FileText, Loader2, Palette, Pen, Package, Cpu,
  RefreshCw, Sparkles, X,
} from 'lucide-react';

/* ─────────────────────────── constants ─────────────────────────────────── */

const GOALS = [
  { value: 'guide_utilisation', label: "Guide d'utilisation" },
  { value: 'routine',           label: "Routine / plan d'action" },
  { value: 'erreurs',           label: 'Erreurs à éviter' },
  { value: 'conseils',          label: 'Conseils pratiques' },
  { value: 'rassurance',        label: 'Rassurer avant achat' },
];

const COLOR_PRESETS = [
  { name: 'Émeraude', value: '#0D9488' },
  { name: 'Indigo',   value: '#4F46E5' },
  { name: 'Violet',   value: '#7C3AED' },
  { name: 'Rose',     value: '#E11D48' },
  { name: 'Orange',   value: '#EA580C' },
  { name: 'Bleu',     value: '#2563EB' },
  { name: 'Or',       value: '#D97706' },
  { name: 'Ardoise',  value: '#475569' },
];

const COVER_STYLES = [
  { value: 'light',   label: 'Classique' },
  { value: 'dark',    label: 'Sombre' },
  { value: 'vibrant', label: 'Coloré' },
];

const STEPS = [
  { icon: Cpu,      label: "Analyse produit" },
  { icon: Pen,      label: 'Rédaction chapitres' },
  { icon: BookOpen, label: 'Structure & contenu' },
  { icon: Palette,  label: 'Design PDF' },
  { icon: Package,  label: 'Export final' },
];

const STEP_DURATIONS = [8000, 20000, 15000, 12000, 8000];

const initialForm = {
  theme: '',
  goal: 'guide_utilisation',
  audience: '',
  problem: '',
  offerAngle: '',
  chapterCount: '10',
  accentColor: '#0D9488',
  coverStyle: 'light',
  addAsOffer: true,
};

/* ─────────────────────── mini cover preview ────────────────────────────── */

const MiniCover = ({ color, style }) => {
  const bg =
    style === 'dark'    ? '#0d1117' :
    style === 'vibrant' ? color     :
    '#ffffff';
  const bandColor = style === 'dark' ? color : style === 'vibrant' ? 'rgba(0,0,0,.18)' : color;
  const textLight = style === 'light' ? '#1e293b' : '#ffffff';
  const textMuted = style === 'light' ? '#94a3b8' : 'rgba(255,255,255,.55)';

  return (
    <div style={{ background: bg, width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
      {/* top band */}
      <div style={{ background: bandColor, height: style === 'light' ? '38%' : '6px', flexShrink: 0 }} />
      {/* body */}
      <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: style === 'light' ? 'flex-start' : 'flex-end' }}>
        <div style={{ height: 5, borderRadius: 99, background: textMuted, width: '60%', marginBottom: 4 }} />
        <div style={{ height: 7, borderRadius: 99, background: textLight, width: '90%', marginBottom: 3 }} />
        <div style={{ height: 7, borderRadius: 99, background: textLight, width: '70%', marginBottom: 8 }} />
        <div style={{ height: 4, borderRadius: 99, background: textMuted, width: '45%' }} />
      </div>
    </div>
  );
};

/* ─────────────────────── generating screen ─────────────────────────────── */

const GeneratingScreen = ({ productName }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const total = STEP_DURATIONS.reduce((s, d) => s + d, 0);
    const id = setInterval(() => {
      elapsed += 200;
      setProgress(Math.min(97, (elapsed / total) * 100));
      let acc = 0;
      for (let i = 0; i < STEP_DURATIONS.length; i++) {
        acc += STEP_DURATIONS[i];
        if (elapsed < acc) { setStepIndex(i); break; }
      }
      if (elapsed >= total) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 64px -12px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06)' }}>

        {/* progress line */}
        <div style={{ height: 3, background: '#f1f5f9' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#0D9488,#6366f1)', borderRadius: 99, transition: 'width .3s ease-out', width: `${progress}%` }} />
        </div>

        <div style={{ padding: '36px 32px 32px' }}>

          {/* animated icon */}
          <div style={{ margin: '0 auto 24px', width: 72, height: 72, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* outer pulse ring */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(13,148,136,.08)', animation: 'ebPulse 2s ease-in-out infinite' }} />
            {/* spinning ring */}
            <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#0D9488', borderRightColor: '#6366f1', animation: 'ebSpin 1.1s linear infinite' }} />
            {/* center */}
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#f0fdf4,#ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#0D9488" />
            </div>
          </div>

          <style>{`
            @keyframes ebSpin  { to { transform: rotate(360deg); } }
            @keyframes ebPulse { 0%,100% { transform: scale(1); opacity:.6; } 50% { transform: scale(1.15); opacity:1; } }
            @keyframes ebBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
          `}</style>

          <h2 style={{ margin: 0, textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-.02em' }}>
            Génération de l'ebook
          </h2>
          {productName && (
            <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              {productName}
            </p>
          )}

          {/* progress percentage */}
          <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-.03em' }}>
            {Math.round(progress)}<span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 500 }}>%</span>
          </p>

          {/* steps */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity .3s', opacity: isActive ? 1 : isDone ? .45 : .18 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? '#f0fdf4' : isActive ? 'linear-gradient(135deg,#f0fdf4,#ede9fe)' : '#f8fafc',
                  }}>
                    {isDone
                      ? <CheckCircle2 size={14} color="#10b981" />
                      : isActive
                        ? <Loader2 size={14} color="#0D9488" style={{ animation: 'ebSpin 1s linear infinite' }} />
                        : <StepIcon size={14} color="#cbd5e1" />
                    }
                  </div>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#1e293b' : isDone ? '#64748b' : '#94a3b8', flex: 1 }}>
                    {step.label}
                  </span>
                  {isActive && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0, 1, 2].map(j => (
                        <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: '#0D9488', animation: 'ebBounce 1.1s ease-in-out infinite', animationDelay: `${j * 160}ms` }} />
                      ))}
                    </div>
                  )}
                  {isDone && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓</span>}
                </div>
              );
            })}
          </div>

          <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: 12, color: '#cbd5e1' }}>
            1 à 3 minutes · Ne fermez pas cette fenêtre
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── shared field components ───────────────────────── */

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12,
  padding: '10px 14px', fontSize: 13.5, color: '#0f172a', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
  fontFamily: 'inherit',
};

const SoftInput = ({ value, onChange, placeholder, type = 'text' }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputStyle, borderColor: focused ? '#0D9488' : '#f1f5f9', boxShadow: focused ? '0 0 0 3px rgba(13,148,136,.1)' : 'none' }}
    />
  );
};

const SoftSelect = ({ value, onChange, children }) => {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', borderColor: focused ? '#0D9488' : '#f1f5f9', boxShadow: focused ? '0 0 0 3px rgba(13,148,136,.1)' : 'none' }}
    >
      {children}
    </select>
  );
};

/* ─────────────────────── section divider ───────────────────────────────── */

const SectionTitle = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#cbd5e1' }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
  </div>
);

/* ─────────────────────── main modal ────────────────────────────────────── */

const DigitalProductEbookModal = ({
  open, productName = '', existingEbook = null,
  loading = false, error = '', generatedResult = null,
  onClose, onGenerate, onRegenerate, onSave, onDelete,
}) => {
  const [form, setForm] = useState(initialForm);
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [addAsOffer, setAddAsOffer] = useState(true);
  const existingEbookRef = React.useRef(existingEbook);
  existingEbookRef.current = existingEbook;

  useEffect(() => {
    if (!open) { setShowPreview(false); setShowGenerateForm(false); return; }
    const eb = existingEbookRef.current;
    setAddAsOffer(eb?.addAsOffer !== false);
    setForm({
      ...initialForm,
      theme: eb?.title || '',
      audience: eb?.target_reader || '',
      offerAngle: eb?.main_promise || '',
      accentColor: eb?.cover?.color_palette?.[0] || '#0D9488',
      coverStyle: eb?.cover?.cover_style || 'light',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (generatedResult) setShowPreview(true); }, [generatedResult]);

  const isEdit = useMemo(() => !!existingEbook, [existingEbook]);

  if (!open) return null;
  if (loading) return <GeneratingScreen productName={productName} />;

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  /* ── Existing ebook view ─────────────────────────────────────────────── */

  const existingPdfUrl = existingEbook?.pdf?.url || existingEbook?.pdfUrl || null;
  const existingTitle  = existingEbook?.title || 'Ebook généré';
  const existingCover  = existingEbook?.cover || {};

  if (isEdit && !showPreview && !showGenerateForm) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(6px)' }}>
        <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 64px -12px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={18} color="#0D9488" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Ebook bonus</div>
                {productName && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{productName}</div>}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #f1f5f9', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <X size={16} />
            </button>
          </div>

          {/* body */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ebook card */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #f1f5f9' }}>
              {/* mini cover */}
              <div style={{ width: 70, height: 92, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                <MiniCover color={existingCover.color_palette?.[0] || '#0D9488'} style={existingCover.cover_style || 'light'} />
              </div>
              {/* info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 20, padding: '2px 10px', marginBottom: 8 }}>
                  <CheckCircle2 size={11} color="#10b981" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Actif</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4, marginBottom: 8 }}>{existingTitle}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {existingPdfUrl ? (
                    <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#0f172a', textDecoration: 'none', cursor: 'pointer' }}>
                      <Eye size={13} />Voir le PDF
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>PDF non disponible</span>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete?.()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>
                      <X size={13} />Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* offer toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 14, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>Activer comme offre</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{"L'ebook apparaît comme bonus sur la page produit"}</div>
              </div>
              <button
                onClick={() => setAddAsOffer(v => !v)}
                style={{ position: 'relative', width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0, background: addAsOffer ? '#0D9488' : '#e2e8f0', transition: 'background .2s' }}
              >
                <span style={{ position: 'absolute', top: 2, left: addAsOffer ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
              </button>
            </div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={() => setShowGenerateForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
              <RefreshCw size={14} />
              {"Régénérer"}
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: 6, padding: '2px 6px' }}>3 crédits</span>
            </button>
            <button
              onClick={() => onSave?.({ addAsOffer })}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0D9488', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              <CheckCircle2 size={14} />Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    onGenerate?.({
      theme: form.theme.trim(),
      goal: form.goal,
      audience: form.audience.trim(),
      problem: form.problem.trim(),
      offerAngle: form.offerAngle.trim(),
      chapterCount: Number(form.chapterCount) || 10,
      accentColor: form.accentColor,
      coverStyle: form.coverStyle,
      addAsOffer: form.addAsOffer !== false,
    });
  };

  /* ── Preview ─────────────────────────────────────────────────────────── */

  const pdfUrl = generatedResult?.pdf?.url || generatedResult?.ebook?.pdf?.url || null;
  const ebookTitle = String(generatedResult?.ebook?.title || generatedResult?.title || '');
  const ebookChapters = Array.isArray(generatedResult?.ebook?.chapters) ? generatedResult.ebook.chapters : [];

  if (showPreview && generatedResult) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(6px)' }}>
        <div style={{ width: '100%', maxWidth: 860, maxHeight: '90vh', background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 64px -12px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} color="#0D9488" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Ebook généré avec succès</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{ebookTitle || productName}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #f1f5f9', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <X size={16} />
            </button>
          </div>

          {/* body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* pdf preview */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={13} />Aperçu PDF
              </div>
              {pdfUrl ? (
                <div style={{ aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <iframe src={pdfUrl} title="Aperçu ebook PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
                </div>
              ) : (
                <div style={{ aspectRatio: '3/4', borderRadius: 14, border: '1.5px dashed #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, color: '#cbd5e1' }}>Aperçu non disponible</span>
                </div>
              )}
            </div>

            {/* chapters + info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} />Contenu
              </div>
              {ebookTitle && (
                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0D9488', marginBottom: 4 }}>Titre</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ebookTitle}</div>
                </div>
              )}
              {ebookChapters.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #f1f5f9', flex: 1, minHeight: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>
                    {ebookChapters.length} chapitres
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {ebookChapters.map((ch, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#475569' }}>
                        <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{String(ch?.chapter_title || ch?.title || ch || '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {generatedResult?.digitalProduct?.offer && (
                <div style={{ background: '#faf5ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #ede9fe' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7c3aed', marginBottom: 4 }}>Offre bonus activée</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#4c1d95' }}>
                    {generatedResult.digitalProduct.offer.label || 'Ebook offert avec la commande'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={() => { setShowPreview(false); onRegenerate?.(); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
              <RefreshCw size={14} />Régénérer
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#0D9488', textDecoration: 'none' }}>
                  <Download size={14} />Télécharger
                </a>
              )}
              <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0D9488', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                <CheckCircle2 size={14} />Terminé
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Config form ─────────────────────────────────────────────────────── */

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '92vh', background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 64px -12px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-.02em' }}>
              {isEdit ? "Régénérer l'ebook" : "Créer l'ebook bonus"}
            </div>
            {productName && (
              <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{productName}</div>
            )}
          </div>
          <button onClick={showGenerateForm ? () => setShowGenerateForm(false) : onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid #f1f5f9', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>

          {/* two-column: form (left) + live preview (right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 24, alignItems: 'start' }}>

            {/* ── Left: form fields ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Contenu */}
              <div>
                <SectionTitle>Contenu</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <Label>Thème de l'ebook</Label>
                    <SoftInput value={form.theme} onChange={e => update('theme', e.target.value)} placeholder="Ex: Guide complet d'utilisation" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Label>Objectif</Label>
                      <SoftSelect value={form.goal} onChange={e => update('goal', e.target.value)}>
                        {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </SoftSelect>
                    </div>
                    <div>
                      <Label>Chapitres</Label>
                      <SoftSelect value={form.chapterCount} onChange={e => update('chapterCount', e.target.value)}>
                        {[5,6,7,8,9,10,11,12].map(n => <option key={n} value={String(n)}>{n} chapitres</option>)}
                      </SoftSelect>
                    </div>
                  </div>
                  <div>
                    <Label>Audience cible</Label>
                    <SoftInput value={form.audience} onChange={e => update('audience', e.target.value)} placeholder="Ex: femmes actives, sportifs…" />
                  </div>
                  <div>
                    <Label>Problème à résoudre</Label>
                    <SoftInput value={form.problem} onChange={e => update('problem', e.target.value)} placeholder="Ex: ne sait pas comment utiliser le produit" />
                  </div>
                </div>
              </div>

              {/* Design */}
              <div>
                <SectionTitle>Design</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Color */}
                  <div>
                    <Label>Couleur principale</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.name}
                          onClick={() => update('accentColor', c.value)}
                          style={{
                            width: 30, height: 30, borderRadius: '50%', background: c.value, border: 'none', cursor: 'pointer', flexShrink: 0,
                            outline: form.accentColor === c.value ? `3px solid ${c.value}` : 'none',
                            outlineOffset: 2,
                            transform: form.accentColor === c.value ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform .15s, outline .15s',
                            boxShadow: form.accentColor === c.value ? `0 0 0 2px #fff, 0 0 0 4px ${c.value}` : '0 1px 3px rgba(0,0,0,.1)',
                          }}
                        />
                      ))}
                      {/* custom */}
                      <label title="Couleur personnalisée" style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px dashed #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                        <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 300, lineHeight: 1 }}>+</span>
                        <input type="color" value={form.accentColor} onChange={e => update('accentColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                      </label>
                    </div>
                  </div>

                  {/* Style */}
                  <div>
                    <Label>Style de couverture</Label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {COVER_STYLES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => update('coverStyle', s.value)}
                          style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                            borderRadius: 12, border: `1.5px solid ${form.coverStyle === s.value ? form.accentColor : '#f1f5f9'}`,
                            padding: '10px 8px 8px',
                            background: form.coverStyle === s.value ? 'rgba(13,148,136,.04)' : '#f8fafc',
                            cursor: 'pointer', transition: 'border-color .15s, background .15s',
                          }}
                        >
                          <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,0,0,.06)' }}>
                            <MiniCover color={form.accentColor} style={s.value} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: form.coverStyle === s.value ? 700 : 500, color: form.coverStyle === s.value ? '#0f172a' : '#64748b' }}>
                            {s.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Offre */}
              <div>
                <SectionTitle>Offre commerciale</SectionTitle>
                <button
                  type="button"
                  onClick={() => update('addAsOffer', !form.addAsOffer)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    borderRadius: 14, border: `1.5px solid ${form.addAsOffer ? '#d1fae5' : '#f1f5f9'}`,
                    padding: '14px 16px',
                    background: form.addAsOffer ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: form.addAsOffer ? '#0f172a' : '#475569' }}>
                      Offre bonus sur la fiche produit
                    </div>
                    <div style={{ fontSize: 12, color: form.addAsOffer ? '#0D9488' : '#94a3b8', marginTop: 2, fontWeight: 500 }}>
                      {form.addAsOffer
                        ? 'Affiché comme "1 unité achetée + PDF offert"'
                        : 'Ebook généré sans être proposé en offre'}
                    </div>
                  </div>
                  {/* pill toggle */}
                  <div style={{
                    width: 44, height: 24, borderRadius: 99, flexShrink: 0,
                    background: form.addAsOffer ? '#0D9488' : '#e2e8f0',
                    position: 'relative', transition: 'background .2s',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: form.addAsOffer ? 23 : 3,
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </div>
                </button>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                  {error}
                </div>
              )}
            </div>

            {/* ── Right: live cover preview ── */}
            <div style={{ position: 'sticky', top: 0 }}>
              <Label>Aperçu couverture</Label>
              <div style={{ aspectRatio: '2/3', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px -4px rgba(15,23,42,.14), 0 0 0 1px rgba(15,23,42,.06)', background: '#f8fafc' }}>
                <MiniCover color={form.accentColor} style={form.coverStyle} />
              </div>
              {/* color hex */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: form.accentColor, border: '1px solid rgba(0,0,0,.08)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{form.accentColor}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f8fafc', background: '#fff' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg, ${form.accentColor}, ${form.accentColor}cc)`, border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 14px -2px ${form.accentColor}66`, transition: 'opacity .15s' }}>
            <Sparkles size={16} />
            Générer le PDF ebook
            <span style={{ marginLeft: 4, padding: '2px 7px', background: 'rgba(255,255,255,0.22)', borderRadius: 20, fontSize: 11, fontWeight: 900, border: '1px solid rgba(255,255,255,0.3)', lineHeight: 1 }}>3 crédits</span>
            <ChevronRight size={15} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default DigitalProductEbookModal;
