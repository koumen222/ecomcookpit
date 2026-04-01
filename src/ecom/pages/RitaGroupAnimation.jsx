import React, { useState, useEffect, useCallback } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ROLES = [
  { value: 'clients', label: '🛒 Clients' },
  { value: 'prospects', label: '🎯 Prospects' },
  { value: 'vip', label: '⭐ VIP' },
  { value: 'custom', label: '🔧 Personnalisé' },
];

// ══════════════════════════════════════════════════════════════════════════════
// Post planifié – Ligne éditable
// ══════════════════════════════════════════════════════════════════════════════

function ScheduledPostEditor({ post, onChange, onRemove, products }) {
  const update = (k, v) => onChange({ ...post, [k]: v });
  const toggleDay = d => {
    const days = (post.days || []).includes(d) ? post.days.filter(x => x !== d) : [...(post.days || []), d];
    update('days', days);
  };

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={post.type} onChange={e => update('type', e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5 bg-gray-50 font-medium">
          <option value="text">📝 Texte</option>
          <option value="image">🖼️ Image (URL)</option>
          <option value="product">🛍️ Produit</option>
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">⏰</span>
          <input type="time" value={post.hour || '09:00'} onChange={e => update('hour', e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5" />
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
          <div className={`relative w-9 h-5 rounded-full transition ${post.enabled !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${post.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <input type="checkbox" checked={post.enabled !== false} onChange={e => update('enabled', e.target.checked)} className="sr-only" />
          <span className="text-xs font-medium text-gray-600">{post.enabled !== false ? 'Actif' : 'Pause'}</span>
        </label>

        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition p-1" title="Supprimer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Contenu selon le type */}
      {post.type === 'text' && (
        <textarea value={post.content || ''} onChange={e => update('content', e.target.value)} rows={3}
          placeholder="Message à envoyer dans le groupe... 💬"
          className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" />
      )}
      {post.type === 'image' && (
        <div className="space-y-2">
          <input type="text" value={post.content || ''} onChange={e => update('content', e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" />
          {post.content && (
            <img src={post.content} alt="Aperçu" className="h-20 w-20 object-cover rounded-lg border"
              onError={e => { e.target.style.display = 'none'; }} />
          )}
        </div>
      )}
      {post.type === 'product' && (
        <select value={post.productName || ''} onChange={e => update('productName', e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-1.5 bg-gray-50 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400">
          <option value="">— Choisir un produit du catalogue —</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}

      {/* Jours de la semaine */}
      <div>
        <span className="text-xs font-medium text-gray-500 mb-1 block">Jours d'envoi :</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${(post.days || []).includes(d) ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </button>
          ))}
          <button onClick={() => update('days', DAYS.slice())}
            className="text-[10px] px-2 py-0.5 text-emerald-600 hover:underline font-medium">Tous</button>
          <button onClick={() => update('days', [])}
            className="text-[10px] px-2 py-0.5 text-gray-400 hover:underline font-medium">Aucun</button>
        </div>
      </div>

      {/* Résumé */}
      {post.days?.length > 0 && (
        <p className="text-[11px] text-gray-400 italic">
          📅 Envoi à {post.hour || '09:00'} — {post.days.length === 7 ? 'Tous les jours' : post.days.join(', ')}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Carte d'un groupe géré
// ══════════════════════════════════════════════════════════════════════════════

function ManagedGroupCard({ group, groupIndex, onUpdate, products, onCopyInvite, onRefreshInvite, onSendTest }) {
  const [expanded, setExpanded] = useState(true);

  const updateGroup = (key, val) => onUpdate({ ...group, [key]: val });
  const addPost = () => {
    const newPosts = [...(group.scheduledPosts || []), { type: 'text', content: '', productName: '', days: [], hour: '09:00', enabled: true }];
    updateGroup('scheduledPosts', newPosts);
  };
  const updatePost = (pi, post) => {
    const posts = [...(group.scheduledPosts || [])];
    posts[pi] = post;
    updateGroup('scheduledPosts', posts);
  };
  const removePost = (pi) => {
    const posts = [...(group.scheduledPosts || [])];
    posts.splice(pi, 1);
    updateGroup('scheduledPosts', posts);
  };

  const postsCount = group.scheduledPosts?.length || 0;
  const activeCount = (group.scheduledPosts || []).filter(p => p.enabled !== false).length;

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      {/* Header du groupe */}
      <div className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
          {group.role === 'clients' ? '🛒' : group.role === 'prospects' ? '🎯' : group.role === 'vip' ? '⭐' : '👥'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{group.name || group.groupJid}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${group.role === 'vip' ? 'bg-amber-50 text-amber-700' : group.role === 'clients' ? 'bg-emerald-50 text-emerald-700' : group.role === 'prospects' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {ROLES.find(r => r.value === group.role)?.label || group.role}
            </span>
            <span className="text-[10px] text-gray-400">
              {postsCount} post{postsCount > 1 ? 's' : ''} • {activeCount} actif{activeCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t">
          {/* Actions rapides */}
          <div className="flex flex-wrap gap-2 pt-3">
            <select value={group.role} onChange={e => updateGroup('role', e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 bg-gray-50 font-medium">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            {group.inviteUrl ? (
              <button onClick={() => onCopyInvite(group.inviteUrl)}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition font-medium">
                📋 Copier le lien d'invitation
              </button>
            ) : (
              <button onClick={() => onRefreshInvite(group.groupJid, groupIndex)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium">
                🔗 Générer lien d'invitation
              </button>
            )}

            <button onClick={() => onSendTest(group.groupJid)}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium">
              🧪 Envoyer un message test
            </button>
          </div>

          {/* Invite URL */}
          {group.inviteUrl && (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
              <span className="text-xs text-emerald-600 truncate flex-1">{group.inviteUrl}</span>
              <button onClick={() => onRefreshInvite(group.groupJid, groupIndex)}
                className="text-[10px] text-emerald-700 hover:underline font-medium whitespace-nowrap">🔄 Régénérer</button>
            </div>
          )}

          {/* Posts planifiés */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">📢 Posts planifiés</h4>
              <button onClick={addPost}
                className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition">
                + Ajouter
              </button>
            </div>

            {!postsCount && (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <p className="text-2xl mb-1">📭</p>
                <p className="text-xs text-gray-400">Aucun post planifié. Rita peut animer ce groupe automatiquement !</p>
                <button onClick={addPost}
                  className="mt-2 text-xs text-emerald-600 font-medium hover:underline">
                  + Créer le premier post
                </button>
              </div>
            )}

            {(group.scheduledPosts || []).map((post, pi) => (
              <ScheduledPostEditor key={pi} post={post} products={products}
                onChange={p => updatePost(pi, p)} onRemove={() => removePost(pi)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Page principale – Animation des groupes
// ══════════════════════════════════════════════════════════════════════════════

export default function RitaGroupAnimation() {
  const { user } = useEcomAuth();
  const userId = user?._id;

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingExisting, setAddingExisting] = useState(false);
  const [selectedGroupToAdd, setSelectedGroupToAdd] = useState('');
  const [testMsg, setTestMsg] = useState(null);

  // ─── Chargement ───
  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [cfgRes, grpRes, ritaRes] = await Promise.all([
        ecomApi.get('/v1/rita-flows/config', { params: { userId } }).catch(() => ({ data: { config: null } })),
        ecomApi.get('/v1/rita-flows/groups/list', { params: { userId } }).catch(() => ({ data: { groups: [] } })),
        ecomApi.get('/v1/external/whatsapp/rita-config', { params: { userId } }).catch(() => ({ data: { config: null } })),
      ]);
      setConfig(cfgRes.data.config || { enabled: false, flows: [], groups: [], settings: {} });
      setWhatsappGroups(grpRes.data.groups || []);
      setProducts((ritaRes.data.config?.productCatalog || []).map(p => p.name));
    } catch (err) {
      console.error('Erreur chargement:', err);
      setConfig({ enabled: false, flows: [], groups: [], settings: {} });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ─── Sauvegarde ───
  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await ecomApi.post('/v1/rita-flows/config', { userId, config });
      setSaveMsg({ ok: true, text: '✅ Animation sauvegardée !' });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg({ ok: false, text: '❌ Erreur de sauvegarde' });
    } finally { setSaving(false); }
  };

  // ─── Helpers ───
  const updateConfig = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const updateGroup = (gi, group) => {
    const groups = [...config.groups];
    groups[gi] = group;
    updateConfig('groups', groups);
  };

  // ─── Créer un nouveau groupe ───
  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/create', { userId, name: newGroupName.trim() });
      if (data.success && data.group) {
        const cfgRes = await ecomApi.get('/v1/rita-flows/config', { params: { userId } });
        setConfig(cfgRes.data.config);
        const grpRes = await ecomApi.get('/v1/rita-flows/groups/list', { params: { userId } });
        setWhatsappGroups(grpRes.data.groups || []);
        setNewGroupName('');
      }
    } catch (err) { console.error(err); }
    finally { setCreatingGroup(false); }
  };

  // ─── Ajouter un groupe existant ───
  const addExistingGroup = () => {
    if (!selectedGroupToAdd) return;
    const wa = whatsappGroups.find(g => g.id === selectedGroupToAdd);
    if (!wa) return;
    const alreadyManaged = (config.groups || []).some(g => g.groupJid === wa.id);
    if (alreadyManaged) {
      setTestMsg({ ok: false, text: 'Ce groupe est déjà géré.' });
      setTimeout(() => setTestMsg(null), 3000);
      return;
    }
    const newGroup = { groupJid: wa.id, name: wa.name, inviteUrl: '', role: 'custom', autoCreated: false, scheduledPosts: [] };
    updateConfig('groups', [...(config.groups || []), newGroup]);
    setSelectedGroupToAdd('');
    setAddingExisting(false);
  };

  // ─── Copier le lien ───
  const copyInvite = (url) => {
    navigator.clipboard.writeText(url);
    setTestMsg({ ok: true, text: '📋 Lien copié !' });
    setTimeout(() => setTestMsg(null), 2000);
  };

  // ─── Régénérer lien d'invitation ───
  const refreshInvite = async (groupJid, gi) => {
    try {
      const { data } = await ecomApi.post('/v1/rita-flows/groups/invite-link', { userId, groupJid });
      if (data.success && data.inviteUrl) {
        const groups = [...config.groups];
        groups[gi] = { ...groups[gi], inviteUrl: data.inviteUrl };
        updateConfig('groups', groups);
        setTestMsg({ ok: true, text: '🔗 Lien d\'invitation mis à jour !' });
        setTimeout(() => setTestMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setTestMsg({ ok: false, text: '❌ Erreur génération du lien' });
      setTimeout(() => setTestMsg(null), 3000);
    }
  };

  // ─── Envoyer message test ───
  const sendTest = async (groupJid) => {
    try {
      // On utilise un post text simple via la config save + on fait un appel direct
      setTestMsg({ ok: true, text: '🧪 Envoi du message test...' });
      await ecomApi.post('/v1/rita-flows/groups/scheduled-post', {
        userId,
        groupJid,
        post: { type: 'text', content: '🤖 Test Rita — L\'animation du groupe fonctionne ! 🎉', days: [], hour: '00:00', enabled: false }
      });
      // Reload config to get the post, then trigger would send it
      setTestMsg({ ok: true, text: '✅ Message test ajouté (sera envoyé au prochain cycle)' });
      setTimeout(() => setTestMsg(null), 3000);
      // Refresh
      const cfgRes = await ecomApi.get('/v1/rita-flows/config', { params: { userId } });
      setConfig(cfgRes.data.config);
    } catch (err) {
      console.error(err);
      setTestMsg({ ok: false, text: '❌ Erreur envoi test' });
      setTimeout(() => setTestMsg(null), 3000);
    }
  };

  // ─── Supprimer un groupe géré ───
  const removeGroup = (gi) => {
    const groups = [...config.groups];
    groups.splice(gi, 1);
    updateConfig('groups', groups);
  };

  // ─── Render ───
  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const managedCount = config.groups?.length || 0;
  const totalPosts = (config.groups || []).reduce((sum, g) => sum + (g.scheduledPosts?.length || 0), 0);
  const activePosts = (config.groups || []).reduce((sum, g) => sum + (g.scheduledPosts || []).filter(p => p.enabled !== false).length, 0);
  // groupes WhatsApp pas encore gérés
  const unmanagedGroups = whatsappGroups.filter(w => !(config.groups || []).some(g => g.groupJid === w.id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📢 Animation des groupes</h1>
          <p className="text-sm text-gray-500 mt-1">Rita anime automatiquement vos groupes WhatsApp avec du contenu planifié.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
          {saving ? 'Enregistrement...' : '💾 Sauvegarder'}
        </button>
      </div>

      {/* ─── Messages flash ─── */}
      {(saveMsg || testMsg) && (
        <div className={`text-sm px-4 py-2.5 rounded-xl ${(saveMsg || testMsg).ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {(saveMsg || testMsg).text}
        </div>
      )}

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{managedCount}</p>
          <p className="text-xs text-gray-500">Groupes gérés</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{activePosts}</p>
          <p className="text-xs text-gray-500">Posts actifs</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-600">{totalPosts - activePosts}</p>
          <p className="text-xs text-gray-500">Posts en pause</p>
        </div>
      </div>

      {/* ─── Ajouter un groupe ─── */}
      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-700">➕ Ajouter un groupe à animer</h2>

        <div className="flex gap-3 flex-wrap">
          {/* Créer nouveau */}
          <div className="flex-1 min-w-[250px] space-y-2">
            <span className="text-xs font-medium text-gray-500">Créer un nouveau groupe :</span>
            <div className="flex gap-2">
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Ex: 🛒 Clients Premium"
                className="flex-1 text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                onKeyDown={e => e.key === 'Enter' && createGroup()} />
              <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition whitespace-nowrap">
                {creatingGroup ? '...' : 'Créer'}
              </button>
            </div>
          </div>

          {/* Ajouter existant */}
          {unmanagedGroups.length > 0 && (
            <div className="flex-1 min-w-[250px] space-y-2">
              <span className="text-xs font-medium text-gray-500">Ajouter un groupe existant ({unmanagedGroups.length} disponibles) :</span>
              <div className="flex gap-2">
                <select value={selectedGroupToAdd} onChange={e => setSelectedGroupToAdd(e.target.value)}
                  className="flex-1 text-sm border rounded-lg px-3 py-2 bg-gray-50">
                  <option value="">— Choisir un groupe —</option>
                  {unmanagedGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.participants} membres)</option>
                  ))}
                </select>
                <button onClick={addExistingGroup} disabled={!selectedGroupToAdd}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap">
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Groupes gérés ─── */}
      {!managedCount ? (
        <div className="text-center py-16 bg-white border rounded-2xl">
          <p className="text-5xl mb-3">📢</p>
          <p className="text-lg font-bold text-gray-700">Aucun groupe à animer</p>
          <p className="text-sm text-gray-400 mt-1">Créez un groupe ou ajoutez-en un existant pour que Rita l'anime automatiquement.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {config.groups.map((group, gi) => (
            <div key={gi} className="relative">
              <ManagedGroupCard
                group={group}
                groupIndex={gi}
                products={products}
                onUpdate={g => updateGroup(gi, g)}
                onCopyInvite={copyInvite}
                onRefreshInvite={refreshInvite}
                onSendTest={sendTest}
              />
              <button onClick={() => removeGroup(gi)}
                className="absolute top-3 right-12 text-xs text-gray-400 hover:text-red-500 transition"
                title="Retirer ce groupe de l'animation">
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Info ─── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-bold">💡 Comment fonctionne l'animation ?</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li>Rita vérifie toutes les minutes si un post planifié doit être envoyé.</li>
          <li>Les posts sont envoyés au jour et à l'heure configurés (fuseau Africa/Douala).</li>
          <li>Pour les posts de type <strong>produit</strong>, Rita envoie automatiquement la fiche + la photo.</li>
          <li>Vous pouvez mettre un post en pause sans le supprimer avec le switch Actif/Pause.</li>
        </ul>
      </div>
    </div>
  );
}
