import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { notificationsAPI, Notification } from '../services/apiService';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    const handleFocusRefresh = () => fetchNotifications();
    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleFocusRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleFocusRefresh);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsAPI.getNotifications();
      setNotifications(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      fetchNotifications();
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      fetchNotifications();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="font-display text-3xl font-bold text-slate-900 flex items-center gap-3">
             <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#135d66,#ef8354)] text-white">
               <Bell className="w-5 h-5" />
             </span>
             Notifications
           </h2>
           <p className="text-slate-500 mt-2">Updates on your reported issues and community activity.</p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={markAllAsRead}
            className="rf-chip flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="rf-glass-strong rf-animate-enter overflow-hidden rounded-[30px]">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">You're all caught up!</h3>
            <p className="text-slate-500">Check back later for updates on your reports and your neighborhood.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div key={notif._id} className={`rf-hover-lift flex gap-4 p-6 transition-colors ${!notif.isRead ? 'bg-teal-50/60' : 'hover:bg-white/70'}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${!notif.isRead ? 'bg-teal-100 text-[color:var(--rf-brand)]' : 'bg-slate-100 text-slate-500'}`}>
                    <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-base font-semibold ${!notif.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className={`mt-1.5 ${!notif.isRead ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {notif.message}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="shrink-0 flex items-center">
                    <button 
                      onClick={() => markAsRead(notif._id)}
                      className="rounded-full p-2 text-[color:var(--rf-brand)] transition-colors hover:bg-teal-100 hover:text-teal-800"
                      title="Mark as read"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
