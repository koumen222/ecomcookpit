import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Phone, MapPin, Package, RefreshCw, Wifi, WifiOff, User } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { useSocket } from '../hooks/useSocket.js';

const STATE_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export default function RitaConversations() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [lastRefresh, setLastRefresh]     = useState(null);
  const bottomRef = useRef(null);
  const { on, off, isConnected } = useSocket();

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await ecomApi.get('/v1/external/whatsapp/rita-conversations');
      if (data.success) {
        setConversations(data.conversations || []);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.error('rita-conversations fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling toutes les 5s
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Refresh instantané sur événement socket
  useEffect(() => {
    const handler = () => fetchConversations();
    on('rita:message:new', handler);
    return () => off('rita:message:new', handler);
  }, [on, off, fetchConversations]);

  // Auto-scroll bas de la conversation sélectionnée
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected]);

  // Sync la conversation sélectionnée quand les données se mettent à jour
  useEffect(() => {
    if (selected) {
      const updated = conversations.find(c => c.key === selected.key);
      if (updated) setSelected(updated);
    }
  }, [conversations]); // eslint-disable-line

  const selectedConv = selected
    ? conversations.find(c => c.key === selected.key) || selected
    : null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar liste ── */}
      <div className="w-72 flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h1 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              Conversations Rita
            </h1>
            <div className="flex items-center gap-2">
              {isConnected
                ? <Wifi className="w-4 h-4 text-emerald-500" title="Connecté" />
                : <WifiOff className="w-4 h-4 text-gray-400" title="Déconnecté" />
              }
              <button onClick={fetchConversations} className="text-gray-400 hover:text-gray-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {conversations.length} active{conversations.length !== 1 ? 's' : ''}
            {lastRefresh && ` · màj ${timeAgo(lastRefresh)}`}
          </p>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 text-center text-gray-400 text-sm">Chargement…</div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              Aucune conversation active.<br />
              Les conversations apparaîtront ici en temps réel dès qu'un client écrit.
            </div>
          )}
          {conversations.map(conv => {
            const lastMsg = conv.messages?.[conv.messages.length - 1];
            const isActive = selectedConv?.key === conv.key;
            return (
              <button
                key={conv.key}
                onClick={() => setSelected(conv)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${isActive ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {conv.state?.nom || conv.phone}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                    {timeAgo(conv.tracker?.lastClientMessage || conv.lastActivity)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{conv.phone}</p>
                {conv.state?.produit && (
                  <p className="text-xs text-emerald-600 truncate mt-0.5">{conv.state.produit}</p>
                )}
                {lastMsg && (
                  <p className="text-xs text-gray-400 truncate mt-1">
                    {lastMsg.role === 'assistant' ? '🤖 ' : '👤 '}
                    {lastMsg.content?.substring(0, 60)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel conversation ── */}
      {!selectedConv ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Sélectionnez une conversation</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header client */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {selectedConv.state?.nom || 'Client inconnu'}
                </h2>
                <div className="flex flex-wrap gap-3 mt-2">
                  {selectedConv.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />
                      {selectedConv.phone}
                    </span>
                  )}
                  {selectedConv.state?.telephoneAppel && selectedConv.state.telephoneAppel !== selectedConv.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3 text-blue-400" />
                      {selectedConv.state.telephoneAppel} (appel)
                    </span>
                  )}
                  {selectedConv.state?.ville && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {selectedConv.state.ville}
                      {selectedConv.state?.adresse && ` – ${selectedConv.state.adresse}`}
                    </span>
                  )}
                  {selectedConv.state?.produit && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Package className="w-3 h-3" />
                      {selectedConv.state.produit}
                      {selectedConv.state?.prix && ` · ${selectedConv.state.prix}`}
                    </span>
                  )}
                  {selectedConv.state?.quantite && selectedConv.state.quantite > 1 && (
                    <span className="text-xs text-gray-500">x{selectedConv.state.quantite}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {selectedConv.tracker?.ordered && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATE_COLORS.confirmed}`}>
                    Commande validée
                  </span>
                )}
                {selectedConv.state?.statut && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATE_COLORS[selectedConv.state.statut] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedConv.state.statut}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {selectedConv.messageCount} message{selectedConv.messageCount !== 1 ? 's' : ''}
                  {selectedConv.tracker?.relanceCount > 0 && ` · ${selectedConv.tracker.relanceCount} relance(s)`}
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(selectedConv.messages || []).map((msg, i) => {
              const isRita = msg.role === 'assistant';
              return (
                <div key={i} className={`flex ${isRita ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isRita
                      ? 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                      : 'bg-emerald-500 text-white rounded-br-sm'
                  }`}>
                    {!isRita && (
                      <p className="text-xs font-medium mb-0.5 opacity-75">
                        {selectedConv.state?.nom || selectedConv.phone}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
