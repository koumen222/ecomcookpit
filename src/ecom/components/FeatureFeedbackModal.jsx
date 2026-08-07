import React, { useEffect, useState } from 'react';
import { X, Send, CheckCircle, Loader2 } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

// ─────────────────────────────────────────────────────────────────────────────
// FeatureFeedbackModal — petit modal d'avis affiché juste après une génération
// réussie (page produit, créas, vidéo, image…).
//
// Usage dans un composant :
//   import FeatureFeedbackModal, { shouldAskFeedback } from './FeatureFeedbackModal.jsx';
//   const [feedbackOpen, setFeedbackOpen] = useState(false);
//   // au moment du succès :
//   if (shouldAskFeedback('creative_generator')) setTimeout(() => setFeedbackOpen(true), 2000);
//   // dans le JSX :
//   {feedbackOpen && <FeatureFeedbackModal feature="creative_generator" meta={{...}} onClose={() => setFeedbackOpen(false)} />}
//
// Règles d'affichage (gérées ici, via localStorage) :
//   - max 1 sollicitation par fonctionnalité tous les 7 jours
//   - max 1 sollicitation toutes les 2 heures toutes fonctionnalités confondues
//   - opt-out définitif par fonctionnalité ("Ne plus me demander")
// Le compteur est marqué dès l'OUVERTURE du modal : fermer sans répondre
// compte aussi, l'utilisateur n'est jamais harcelé.
// ─────────────────────────────────────────────────────────────────────────────

const ASK_COOLDOWN_PER_FEATURE_MS = 7 * 24 * 3600 * 1000; // 7 jours
const ASK_COOLDOWN_GLOBAL_MS = 2 * 3600 * 1000;           // 2 heures

const LS_LAST_PREFIX = 'scalor_fb_last_';
const LS_OPTOUT_PREFIX = 'scalor_fb_optout_';
const LS_LAST_GLOBAL = 'scalor_fb_last_any';

const FEATURE_TEXTS = {
  product_page_generator: 'la génération de votre page produit',
  creative_generator: 'la génération de vos créas publicitaires',
  builder_ai_image: 'la génération de votre image',
  creative_video: 'la génération de votre vidéo',
  creative_montage: 'le montage de votre vidéo',
  creative_voice: 'la génération de votre voix off',
  creative_lipsync: 'la création de votre avatar parlant',
  creative_translation: 'la traduction de votre vidéo',
  creative_clone: 'le clonage de votre page produit',
  creative_text: 'la génération de votre texte',
  assistant_chat: "l'assistant IA",
  other: 'cette fonctionnalité',
};

const RATINGS = [
  { value: 1, emoji: '😖', label: 'Très mauvaise' },
  { value: 2, emoji: '😕', label: 'Mauvaise' },
  { value: 3, emoji: '😐', label: 'Moyenne' },
  { value: 4, emoji: '🙂', label: 'Bonne' },
  { value: 5, emoji: '🤩', label: 'Excellente' },
];

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/** À appeler au moment d'un succès de génération : true si on peut solliciter l'utilisateur. */
export function shouldAskFeedback(feature) {
  if (lsGet(`${LS_OPTOUT_PREFIX}${feature}`) === '1') return false;

  const now = Date.now();
  const lastFeature = Number(lsGet(`${LS_LAST_PREFIX}${feature}`) || 0);
  if (now - lastFeature < ASK_COOLDOWN_PER_FEATURE_MS) return false;

  const lastGlobal = Number(lsGet(LS_LAST_GLOBAL) || 0);
  if (now - lastGlobal < ASK_COOLDOWN_GLOBAL_MS) return false;

  return true;
}

const FeatureFeedbackModal = ({ feature = 'other', meta, onClose }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Marquer la sollicitation dès l'ouverture (fermer sans répondre compte aussi)
  useEffect(() => {
    const now = String(Date.now());
    lsSet(`${LS_LAST_PREFIX}${feature}`, now);
    lsSet(LS_LAST_GLOBAL, now);
  }, [feature]);

  const close = () => { if (!sending) onClose?.(); };

  const optOut = () => {
    lsSet(`${LS_OPTOUT_PREFIX}${feature}`, '1');
    close();
  };

  const submit = async () => {
    if (!rating || sending) return;
    setSending(true);
    try {
      await ecomApi.post('/feedback', {
        feature,
        rating,
        comment: comment.trim(),
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
        meta,
      });
    } catch (err) {
      // Best-effort : on ne bloque jamais l'utilisateur pour un feedback
      console.warn('[Feedback] envoi échoué:', err?.message);
    }
    setSending(false);
    setSent(true);
    setTimeout(() => onClose?.(), 1400);
  };

  const featureText = FEATURE_TEXTS[feature] || FEATURE_TEXTS.other;

  return (
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={close}>
      <div
        className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée mobile */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {sent ? (
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="text-base font-bold text-gray-900">Merci pour votre retour !</p>
            <p className="text-xs text-gray-500 mt-1">Il nous aide à améliorer l'outil.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900">Votre avis compte 🙏</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Comment s'est passée {featureText} ?
                </p>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Notes emoji */}
              <div className="flex justify-between gap-1.5">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                      rating === r.value
                        ? 'border-emerald-500 bg-emerald-50 scale-105 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    aria-label={r.label}
                  >
                    <span className={`text-2xl leading-none transition-transform ${rating === r.value ? 'scale-110' : ''}`}>{r.emoji}</span>
                    <span className={`text-[10px] font-semibold ${rating === r.value ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Commentaire libre */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Dites-nous ce qui a plu ou ce qu'on doit améliorer… (optionnel)"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
                >
                  Passer
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!rating || sending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Envoyer
                </button>
              </div>

              <button
                type="button"
                onClick={optOut}
                className="w-full text-center text-[11px] text-gray-400 hover:text-gray-600 transition underline underline-offset-2"
              >
                Ne plus me demander pour cette fonctionnalité
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeatureFeedbackModal;
