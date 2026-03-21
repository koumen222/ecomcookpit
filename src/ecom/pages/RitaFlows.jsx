import React, { useState, useEffect, useCallback } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

// ── Constantes ───────────────────────────────────────────────────────────────

const CONDITION_TYPES = [
  { value: 'keyword', label: '💬 Message contient' },
  { value: 'keyword_not', label: '🚫 Message ne contient PAS' },
  { value: 'inactivity', label: '⏰ Inactivité (secondes)' },
  { value: 'message_count_gt', label: '📊 Nb messages supérieur à' },
  { value: 'message_count_lt', label: '📊 Nb messages inférieur à' },
  { value: 'has_ordered', label: '✅ Client a commandé' },
  { value: 'has_not_ordered', label: '❌ Client n\'a pas commandé' },
  { value: 'tag_is', label: '🏷️ Tag contact' },
  { value: 'always', label: '♾️ Toujours (fallback)' },
];

const ACTION_TYPES = [
  { value: 'SEND_GROUP_INVITE_LINK', label: '🔗 Envoyer lien groupe' },
  { value: 'ADD_TO_GROUP', label: '➕ Ajouter au groupe' },
  { value: 'SEND_MESSAGE', label: '💬 Envoyer un message' },
  { value: 'TAG_CONTACT', label: '🏷️ Tagger le contact' },
  { value: 'WAIT', label: '⏳ Attendre (secondes)' },
  { value: 'END_FLOW', label: '🛑 Fin du flow' },
];

const TRIGGER_TYPES = [
  { value: 'message_received', label: '📩 Message reçu' },
  { value: 'order_confirmed', label: '📦 Commande confirmée' },
  { value: 'inactivity', label: '⏰ Inactivité détectée' },
  { value: 'keyword_detected', label: '🔍 Mot-clé détecté' },
];

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyRule() {
  return { condition: { type: 'keyword', value: [] }, actions: [{ type: 'SEND_GROUP_INVITE_LINK', groupId: '', groupName: '', message: '', tag: '', waitSeconds: 0 }], priority: 0 };
}

function emptyFlow() {
  return { name: 'Nouveau flow', enabled: true, triggers: ['message_received'], rules: [emptyRule()] };
}

function emptyPost() {
  return { type: 'text', content: '', productName: '', days: [], hour: '09:00', enabled: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// Composants internes
// ══════════════════════════════════════════════════════════════════════════════

/* ── Condition Editor ─────────────────────────────────────────────────────── */
function ConditionEditor({ cond, onChange }) {
  const needsArray = cond.type === 'keyword' || cond.type === 'keyword_not';
  const needsNumber = ['inactivity', 'message_count_gt', 'message_count_lt'].includes(cond.type);
  const needsString = cond.type === 'tag_is';
  const noValue = ['has_ordered', 'has_not_ordered', 'always'].includes(cond.type);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 uppercase">SI</span>
      <select value={cond.type} onChange={e => onChange({ ...cond, type: e.target.value, value: null })}
        className="text-sm border rounded-lg px-2 py-1.5 bg-white">
        {CONDITION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {needsArray && (
        <input type="text" placeholder="oui, intéressé, ok"
          value={Array.isArray(cond.value) ? cond.value.join(', ') : cond.value || ''}
          onChange={e => onChange({ ...cond, value: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="text-sm border rounded-lg px-2 py-1.5 flex-1 min-w-[140px]" />
      )}
      {needsNumber && (
        <input type="number" placeholder="3600"
          value={cond.value || ''} onChange={e => onChange({ ...cond, value: Number(e.target.value) || 0 })}
          className="text-sm border rounded-lg px-2 py-1.5 w-24" />
      )}
      {needsString && (
        <input type="text" placeholder="client chaud"
          value={cond.value || ''} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="text-sm border rounded-lg px-2 py-1.5 flex-1" />
      )}
      {noValue && <span className="text-xs text-gray-400 italic">(pas de valeur requise)</span>}
    </div>
  );
}

/* ── Action Editor ────────────────────────────────────────────────────────── */
function ActionEditor({ action, onChange, groups }) {
  const needsGroup = action.type === 'SEND_GROUP_INVITE_LINK' || action.type === 'ADD_TO_GROUP';
  const needsMessage = action.type === 'SEND_MESSAGE';
  const needsTag = action.type === 'TAG_CONTACT';
  const needsWait = action.type === 'WAIT';

  return (
    <div className="flex flex-wrap items-center gap-2 pl-6 border-l-2 border-emerald-200">
      <span className="text-xs font-semibold text-emerald-600 uppercase">ALORS</span>
      <select value={action.type} onChange={e => onChange({ ...action, type: e.target.value })}
        className="text-sm border rounded-lg px-2 py-1.5 bg-white">
        {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
      {needsGroup && (
        <select value={action.groupId || ''} onChange={e => {
          const g = groups.find(g => g.id === e.target.value);
          onChange({ ...action, groupId: e.target.value, groupName: g?.name || '' });
        }}
          className="text-sm border rounded-lg px-2 py-1.5 flex-1 min-w-[140px]">
          <option value="">— Choisir un groupe —</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.participants})</option>)}
        </select>
      )}
      {needsMessage && (
        <input type="text" placeholder="Merci ! Rejoins notre groupe 👇"
          value={action.message || ''} onChange={e => onChange({ ...action, message: e.target.value })}
          className="text-sm border rounded-lg px-2 py-1.5 flex-1" />
      )}
      {needsTag && (
        <input type="text" placeholder="client chaud"
          value={action.tag || ''} onChange={e => onChange({ ...action, tag: e.target.value })}
          className="text-sm border rounded-lg px-2 py-1.5 w-40" />
      )}
      {needsWait && (
        <input type="number" placeholder="5"
          value={action.waitSeconds || ''} onChange={e => onChange({ ...action, waitSeconds: Number(e.target.value) || 0 })}
          className="text-sm border rounded-lg px-2 py-1.5 w-24" />
      )}
    </div>
  );
}

/* ── Rule Editor ──────────────────────────────────────────────────────────── */
function RuleEditor({ rule, index, onChange, onRemove, groups }) {
  const updateCondition = cond => onChange({ ...rule, condition: cond });
  const updateAction = (i, act) => {
    const actions = [...rule.actions];
    actions[i] = act;
    onChange({ ...rule, actions });
  };
  const addAction = () => onChange({ ...rule, actions: [...rule.actions, { type: 'SEND_MESSAGE', message: '', groupId: '', tag: '', waitSeconds: 0 }] });
  const removeAction = i => onChange({ ...rule, actions: rule.actions.filter((_, j) => j !== i) });

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">Règle {index + 1}</span>
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">✕ Supprimer</button>
      </div>
      <ConditionEditor cond={rule.condition} onChange={updateCondition} />
      {rule.actions.map((act, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="flex-1"><ActionEditor action={act} onChange={a => updateAction(i, a)} groups={groups} /></div>
          {rule.actions.length > 1 && <button onClick={() => removeAction(i)} className="text-xs text-red-400 mt-2">✕</button>}
        </div>
      ))}
      <button onClick={addAction} className="text-xs text-emerald-600 font-medium hover:underline">+ Ajouter une action</button>
    </div>
  );
}

/* ── Flow Editor ──────────────────────────────────────────────────────────── */
function FlowEditor({ flow, index, onChange, onRemove, groups }) {
  const update = (key, val) => onChange({ ...flow, [key]: val });
  const updateRule = (i, rule) => { const r = [...flow.rules]; r[i] = rule; update('rules', r); };
  const addRule = () => update('rules', [...flow.rules, emptyRule()]);
  const removeRule = i => update('rules', flow.rules.filter((_, j) => j !== i));

  const toggleTrigger = t => {
    const triggers = flow.triggers.includes(t) ? flow.triggers.filter(x => x !== t) : [...flow.triggers, t];
    update('triggers', triggers);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-3">
        <input type="text" value={flow.name} onChange={e => update('name', e.target.value)}
          className="text-lg font-bold border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none flex-1 bg-transparent" />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={flow.enabled} onChange={e => update('enabled', e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600" />
          Actif
        </label>
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 font-medium">Supprimer</button>
      </div>

      {/* Triggers */}
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">Déclencheurs</span>
        <div className="flex flex-wrap gap-2">
          {TRIGGER_TYPES.map(t => (
            <button key={t.value} onClick={() => toggleTrigger(t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${flow.triggers.includes(t.value)
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-gray-500 uppercase">Règles (évaluées dans l'ordre)</span>
        {flow.rules.map((rule, i) => (
          <RuleEditor key={i} rule={rule} index={i} onChange={r => updateRule(i, r)} onRemove={() => removeRule(i)} groups={groups} />
        ))}
        <button onClick={addRule} className="text-sm text-emerald-600 font-medium hover:underline">+ Ajouter une règle</button>
      </div>
    </div>
  );
}

/* ── Scheduled Post Editor ────────────────────────────────────────────────── */
function ScheduledPostRow({ post, index, onChange, onRemove, products }) {
  const update = (k, v) => onChange({ ...post, [k]: v });
  const toggleDay = d => {
    const days = (post.days || []).includes(d) ? post.days.filter(x => x !== d) : [...(post.days || []), d];
    update('days', days);
  };

  return (
    <div className="bg-gray-50 border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 justify-between">
        <select value={post.type} onChange={e => update('type', e.target.value)}
          className="text-sm border rounded-lg px-2 py-1 bg-white">
          <option value="text">📝 Texte</option>
          <option value="image">🖼️ Image (URL)</option>
          <option value="product">🛍️ Produit</option>
        </select>
        <input type="time" value={post.hour || '09:00'} onChange={e => update('hour', e.target.value)}
          className="text-sm border rounded-lg px-2 py-1" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={post.enabled !== false} onChange={e => update('enabled', e.target.checked)} className="w-3.5 h-3.5 rounded" />
          Actif
        </label>
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">✕</button>
      </div>

      {post.type === 'text' && (
        <textarea value={post.content || ''} onChange={e => update('content', e.target.value)} rows={2}
          placeholder="Message à envoyer dans le groupe..."
          className="w-full text-sm border rounded-lg px-3 py-2 resize-none" />
      )}
      {post.type === 'image' && (
        <input type="text" value={post.content || ''} onChange={e => update('content', e.target.value)}
          placeholder="URL de l'image" className="w-full text-sm border rounded-lg px-3 py-2" />
      )}
      {post.type === 'product' && (
        <select value={post.productName || ''} onChange={e => update('productName', e.target.value)}
          className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white">
          <option value="">— Choisir un produit —</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}

      <div className="flex flex-wrap gap-1">
        {DAYS.map(d => (
          <button key={d} onClick={() => toggleDay(d)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition ${(post.days || []).includes(d) ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold' : 'bg-white border-gray-200 text-gray-400'}`}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Page principale
// ══════════════════════════════════════════════════════════════════════════════

export default function RitaFlows() {
  const { user } = useEcomAuth();
  const userId = user?._id;

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('flows'); // flows | groups | settings
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // ── Chargement initial ──
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [cfgRes, grpRes, ritaRes] = await Promise.all([
        ecomApi.get('/v1/rita-flows/config', { params: { userId } }),
        ecomApi.get('/v1/rita-flows/groups/list', { params: { userId } }).catch(() => ({ data: { groups: [] } })),
        ecomApi.get('/v1/external/whatsapp/rita-config', { params: { userId } }).catch(() => ({ data: { config: null } })),
      ]);
      setConfig(cfgRes.data.config);
      setWhatsappGroups(grpRes.data.groups || []);
      setProducts((ritaRes.data.config?.productCatalog || []).map(p => p.name));
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Sauvegarde ──
  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await ecomApi.post('/v1/rita-flows/config', { userId, config });
      setSaveMsg({ ok: true, text: '✅ Configuration sauvegardée !' });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg({ ok: false, text: '❌ Erreur de sauvegarde' });
    } finally { setSaving(false); }
  };

  // ── Helpers config ──
  const updateConfig = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));
  const updateSettings = (key, val) => setConfig(prev => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
  const updateFlow = (i, flow) => { const f = [...config.flows]; f[i] = flow; updateConfig('flows', f); };
  const addFlow = () => updateConfig('flows', [...(config.flows || []), emptyFlow()]);
  const removeFlow = i => updateConfig('flows', config.flows.filter((_, j) => j !== i));

  // ── Gestion groupes ──
  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/create', { userId, name: newGroupName.trim() });
      if (data.success && data.group) {
        setWhatsappGroups(prev => [...prev, { id: data.group.groupJid, name: data.group.name, participants: 0 }]);
        // Refresh la config pour avoir le groupe dans groups[]
        const cfgRes = await ecomApi.get('/v1/rita-flows/config', { params: { userId } });
        setConfig(cfgRes.data.config);
        setNewGroupName('');
      }
    } catch (err) { console.error(err); }
    finally { setCreatingGroup(false); }
  };

  // ── Post planifié ──
  const addScheduledPost = (groupIdx) => {
    const groups = [...config.groups];
    groups[groupIdx].scheduledPosts = [...(groups[groupIdx].scheduledPosts || []), emptyPost()];
    updateConfig('groups', groups);
  };
  const updateScheduledPost = (gi, pi, post) => {
    const groups = [...config.groups];
    groups[gi].scheduledPosts[pi] = post;
    updateConfig('groups', groups);
  };
  const removeScheduledPost = (gi, pi) => {
    const groups = [...config.groups];
    groups[gi].scheduledPosts.splice(pi, 1);
    updateConfig('groups', groups);
  };

  // ── Render ──
  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">🔄 Rita Flows</h1>
          <p className="text-sm text-gray-500 mt-1">Qualification automatique, groupes WhatsApp, animation</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2">
            <input type="checkbox" checked={config.enabled} onChange={e => updateConfig('enabled', e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600" />
            <span className="text-sm font-semibold">{config.enabled ? 'Activé' : 'Désactivé'}</span>
          </label>
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
            {saving ? 'Enregistrement...' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`text-sm px-4 py-2 rounded-xl ${saveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {saveMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'flows', label: '🔄 Flows', count: config.flows?.length || 0 },
          { id: 'groups', label: '👥 Groupes', count: config.groups?.length || 0 },
          { id: 'settings', label: '⚙️ Paramètres' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} {t.count !== undefined && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ Flows Tab ═══ */}
      {tab === 'flows' && (
        <div className="space-y-4">
          {!config.flows?.length && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔄</p>
              <p className="text-sm">Aucun flow configuré. Crée ton premier flow !</p>
            </div>
          )}
          {config.flows?.map((flow, i) => (
            <FlowEditor key={i} flow={flow} index={i}
              onChange={f => updateFlow(i, f)} onRemove={() => removeFlow(i)} groups={whatsappGroups} />
          ))}
          <button onClick={addFlow}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition">
            + Nouveau flow
          </button>
        </div>
      )}

      {/* ═══ Groups Tab ═══ */}
      {tab === 'groups' && (
        <div className="space-y-4">
          {/* Créer un groupe */}
          <div className="bg-white border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700">➕ Créer un nouveau groupe WhatsApp</h3>
            <div className="flex gap-2">
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Nom du groupe (ex: 🛒 Clients VIP)"
                className="flex-1 text-sm border rounded-lg px-3 py-2" />
              <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition whitespace-nowrap">
                {creatingGroup ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>

          {/* Groupes existants sur l'appareil */}
          <div className="bg-white border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700">📱 Groupes disponibles sur WhatsApp ({whatsappGroups.length})</h3>
            {whatsappGroups.length === 0 && (
              <p className="text-xs text-gray-400">Aucun groupe trouvé sur l'instance WhatsApp.</p>
            )}
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {whatsappGroups.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{g.participants} membres</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{g.id?.slice(0, 20)}…</span>
                </div>
              ))}
            </div>
          </div>

          {/* Groupes gérés avec animation */}
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">📢 Groupes gérés & Animation</h3>
            {!config.groups?.length && (
              <p className="text-xs text-gray-400">Crée un groupe ou ajoute-le à tes flows pour le voir ici.</p>
            )}
            {config.groups?.map((group, gi) => (
              <div key={gi} className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold">{group.name || group.groupJid}</h4>
                    {group.inviteUrl && (
                      <a href={group.inviteUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">
                        🔗 {group.inviteUrl}
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{group.role}</span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Posts planifiés</span>
                  {(group.scheduledPosts || []).map((post, pi) => (
                    <ScheduledPostRow key={pi} post={post} index={pi} products={products}
                      onChange={p => updateScheduledPost(gi, pi, p)} onRemove={() => removeScheduledPost(gi, pi)} />
                  ))}
                  <button onClick={() => addScheduledPost(gi)}
                    className="text-xs text-emerald-600 font-medium hover:underline">
                    + Ajouter un post planifié
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Settings Tab ═══ */}
      {tab === 'settings' && (
        <div className="bg-white border rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-bold text-gray-700">⚙️ Paramètres globaux</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Inactivité par défaut (secondes)</label>
              <input type="number" value={config.settings?.defaultInactivitySeconds || 3600}
                onChange={e => updateSettings('defaultInactivitySeconds', Number(e.target.value) || 3600)}
                className="mt-1 w-full text-sm border rounded-lg px-3 py-2" />
              <p className="text-xs text-gray-400 mt-1">Durée sans message avant de considérer le client comme inactif</p>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" checked={config.settings?.autoCreateGroupPerProduct || false}
                onChange={e => updateSettings('autoCreateGroupPerProduct', e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600" />
              <div>
                <span className="text-sm font-medium text-gray-700">Créer un groupe automatiquement par produit</span>
                <p className="text-xs text-gray-400">Quand une commande est confirmée, Rita crée un groupe pour ce produit</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Template nom de groupe</label>
              <input type="text" value={config.settings?.groupNameTemplate || '🛒 {productName} — Clients'}
                onChange={e => updateSettings('groupNameTemplate', e.target.value)}
                className="mt-1 w-full text-sm border rounded-lg px-3 py-2" />
              <p className="text-xs text-gray-400 mt-1">Utilise {'{productName}'} pour insérer le nom du produit</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
