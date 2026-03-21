import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../services/ecommApi';

const ICON_MAP = {
  order: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  stock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  report: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  import: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  system: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  message: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function renderDeliveryMetadata(metadata) {
  if (!metadata) return null;

  const items = [
    ['Récup', metadata.pickupLocation],
    ['Destination', metadata.destination],
    ['Prix', metadata.priceLabel],
    ['Gain', metadata.gainLabel],
    ['Distance', metadata.estimatedDistanceLabel],
  ].filter(([, value]) => Boolean(value));

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 mb-2 rounded-lg bg-gray-50 px-2.5 py-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
          <p className="text-[11px] text-gray-700 truncate">{value}</p>
        </div>
      ))}
    </div>
  );
}

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

export default function NotificationPanel({ isOpen, onClose, onMarkAllRead, onOpenModal }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);
  const fetchingRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications({ limit: 30 });
      const data = res.data?.data;
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unreadCount || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    } else {
      fetchingRef.current = false;
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-14 left-0 right-0 lg:left-auto lg:right-6 lg:w-[420px] lg:mt-0 bg-white rounded-b-2xl lg:rounded-2xl shadow-2xl border-b lg:border border-gray-200 overflow-hidden z-[60] max-h-[calc(100vh-3.5rem)] lg:max-h-[500px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onOpenModal) onOpenModal();
              }}
              className="text-sm text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Voir tout
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-emerald-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
              >
                Tout lu
              </button>
            )}
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500 active:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto" style={{ maxHeight: 'min(450px, 65vh)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune notification</p>
              <p className="text-xs text-gray-400 mt-1">Vous êtes ù  jour !</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
              const icon = ICON_MAP[notif.icon] || ICON_MAP.info;

              const content = (
                <div
                  className={`flex gap-3.5 px-5 py-4 transition-all hover:bg-gray-50 ${!notif.read ? 'bg-emerald-50/30 border-l-2 border-emerald-600' : ''
                    }`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${colorClass}`}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm leading-snug ${!notif.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0 mt-1.5"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">{notif.message}</p>
                    {notif.type === 'course' && renderDeliveryMetadata(notif.metadata)}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400 font-medium">{timeAgo(notif.createdAt)}</p>
                      <div className="flex items-center gap-1">
                        {!notif.read && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notif._id); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 active:bg-gray-300 text-gray-500 transition-colors"
                            title="Marquer comme lu"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(notif._id); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 active:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
                  className="block border-b border-gray-100 last:border-0 active:bg-gray-100 transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <div key={notif._id} className="border-b border-gray-100 last:border-0">
                  {content}
                </div>
              );
            })
          )}
        </div>
      </div>

    </>
  );
}
