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
  )
};

const TYPE_COLORS = {
  order_new: 'bg-blue-50 text-blue-600',
  order_confirmed: 'bg-emerald-50 text-emerald-600',
  order_shipped: 'bg-violet-50 text-violet-600',
  order_delivered: 'bg-green-50 text-green-600',
  order_cancelled: 'bg-red-50 text-red-600',
  order_returned: 'bg-orange-50 text-orange-600',
  order_status: 'bg-blue-50 text-blue-600',
  stock_low: 'bg-amber-50 text-amber-600',
  stock_out: 'bg-red-50 text-red-600',
  stock_received: 'bg-emerald-50 text-emerald-600',
  report_created: 'bg-indigo-50 text-indigo-600',
  user_joined: 'bg-violet-50 text-violet-600',
  decision_created: 'bg-blue-50 text-blue-600',
  goal_achieved: 'bg-green-50 text-green-600',
  campaign_sent: 'bg-purple-50 text-purple-600',
  import_completed: 'bg-teal-50 text-teal-600',
  system: 'bg-gray-50 text-gray-600',
  info: 'bg-gray-50 text-gray-600'
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "À l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data?.data?.count || 0);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return { unreadCount, refreshCount: fetchUnreadCount };
}

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
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
    } catch {
      // silent
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
        className="fixed lg:absolute top-14 lg:top-auto lg:right-0 left-4 right-4 lg:left-auto lg:w-96 lg:mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 max-h-[calc(100vh-100px)] lg:max-h-[400px] mx-auto lg:mx-0"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Tout marquer lu
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm text-gray-400">Aucune notification</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
            const icon = ICON_MAP[notif.icon] || ICON_MAP.info;

            const content = (
              <div
                className={`flex gap-3 px-4 py-3 transition-colors group ${
                  !notif.read ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-tight ${!notif.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {notif.title}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.read && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notif._id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition"
                          title="Marquer comme lu"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(notif._id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition"
                        title="Supprimer"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
                </div>

                {/* Unread dot */}
                {!notif.read && (
                  <div className="flex-shrink-0 mt-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full block"></span>
                  </div>
                )}
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
                className="block border-b border-gray-50 last:border-0"
              >
                {content}
              </Link>
            ) : (
              <div key={notif._id} className="border-b border-gray-50 last:border-0 cursor-default">
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
