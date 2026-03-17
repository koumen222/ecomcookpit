import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../services/ecommApi';

const ICON_MAP = {
  order: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  stock: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  alert: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  user: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  report: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  import: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  system: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  message: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
};

const TYPE_COLORS = {
  course: 'bg-amber-50 text-amber-600',
  new_delivery: 'bg-amber-50 text-amber-600',
  order_assigned_to_you: 'bg-emerald-50 text-emerald-700',
  order_taken: 'bg-gray-50 text-gray-600',
  order_new: 'bg-emerald-50 text-emerald-600',
  order_confirmed: 'bg-emerald-50 text-emerald-600',
  order_shipped: 'bg-emerald-50 text-emerald-700',
  order_delivered: 'bg-green-50 text-green-600',
  order_cancelled: 'bg-red-50 text-red-600',
  order_returned: 'bg-orange-50 text-orange-600',
  order_status: 'bg-emerald-50 text-emerald-600',
  stock_low: 'bg-amber-50 text-amber-600',
  stock_out: 'bg-red-50 text-red-600',
  stock_received: 'bg-emerald-50 text-emerald-600',
  report_created: 'bg-emerald-50 text-emerald-700',
  team_order_status_changed: 'bg-blue-50 text-blue-600',
  team_order_created: 'bg-emerald-50 text-emerald-600',
  team_campaign_created: 'bg-purple-50 text-purple-600',
  team_campaign_sent: 'bg-purple-50 text-purple-700',
  team_report_generated: 'bg-emerald-50 text-emerald-700',
  user_joined: 'bg-emerald-50 text-emerald-700',
  decision_created: 'bg-emerald-50 text-emerald-600',
  goal_achieved: 'bg-green-50 text-green-600',
  campaign_sent: 'bg-emerald-50 text-emerald-700',
  import_completed: 'bg-teal-50 text-teal-600',
  system: 'bg-gray-50 text-gray-600',
  info: 'bg-gray-50 text-gray-600',
  new_message: 'bg-cyan-50 text-cyan-600',
  new_dm: 'bg-cyan-50 text-cyan-600'
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "ù€ l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationModal({ isOpen, onClose, onMarkAllRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const modalRef = useRef(null);
  // Anti-double fetch : protège contre StrictMode + rerenders
  const fetchingRef = useRef(false);
  // Garde la référence ù  onClose stable pour éviter les re-runs de useEffect
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const fetchNotifications = useCallback(async (page = 1, reset = false) => {
    // Bloque les appels simultanés uniquement sur le reset (ouverture)
    if (reset && fetchingRef.current) return;
    if (reset) fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications({ limit: 20, page });
      const data = res.data?.data;
      const items = data?.notifications || [];
      setNotifications(prev => reset ? items : [...prev, ...items]);
      setUnreadCount(data?.unreadCount ?? 0);
      setHasMore(items.length === 20);
    } catch {
      // silent
    } finally {
      setLoading(false);
      if (reset) fetchingRef.current = false;
    }
  }, []);

  // Fetch uniquement à l'ouverture — reset complet
  useEffect(() => {
    if (!isOpen) return;
    setCurrentPage(1);
    fetchNotifications(1, true);
  }, [isOpen, fetchNotifications]);

  // Escape + scroll lock — cleanup correct
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      if (onMarkAllRead) onMarkAllRead();
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {
      // silent
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchNotifications(nextPage, false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                Tout marquer comme lu
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune notification</h3>
              <p className="text-gray-500">Vous êtes ù  jour ! Toutes vos notifications ont été traitées.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notif) => {
                const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
                const icon = ICON_MAP[notif.icon] || ICON_MAP.info;

                const content = (
                  <div
                    className={`flex gap-4 p-6 transition-all hover:bg-gray-50 ${
                      !notif.read ? 'bg-emerald-50/30 border-l-4 border-emerald-600' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${colorClass}`}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className={`text-base leading-snug ${
                          !notif.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                        }`}>
                          {notif.title}
                        </h4>
                        {!notif.read && (
                          <span className="w-3 h-3 bg-emerald-600 rounded-full flex-shrink-0 mt-1"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{notif.message}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 font-medium">{timeAgo(notif.createdAt)}</p>
                        <div className="flex items-center gap-2">
                          {!notif.read && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notif._id); }}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Marquer comme lu"
                            >
                              Marquer comme lu
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(notif._id); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return notif.link ? (
                  <Link
                    key={notif._id}
                    to={notif.link}
                    onClick={() => {
                      if (!notif.read) handleMarkAsRead(notif._id);
                      onClose();
                    }}
                    className="block hover:bg-gray-50 transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={notif._id}>
                    {content}
                  </div>
                );
              })}
              
              {/* Load More Button */}
              {hasMore && (
                <div className="p-6 text-center border-t border-gray-100">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-6 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        Chargement...
                      </div>
                    ) : (
                      'Charger plus'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
