import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check } from 'lucide-react';
import { notificationsAPI, Notification } from '../services/apiService';

export default function NotificationBell({ onViewAll }: { onViewAll?: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

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

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = bellRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);

      if (!clickedTrigger && !clickedPanel) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !bellRef.current) return;

    const updatePanelPosition = () => {
      const trigger = bellRef.current?.getBoundingClientRect();
      if (!trigger) return;

      const isDesktop = window.innerWidth >= 768;

      if (isDesktop) {
        setPanelStyle({
          position: 'fixed',
          top: `${Math.max(16, trigger.top)}px`,
          left: `${Math.min(window.innerWidth - 396, trigger.right + 14)}px`,
          right: 'auto',
          bottom: 'auto',
          width: '380px',
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 9999
        });
        return;
      }

      setPanelStyle({
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: '88px',
        top: 'auto',
        width: 'auto',
        maxWidth: '400px',
        margin: '0 auto',
        zIndex: 9999
      });
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      if (!localStorage.getItem('roadfix_token')) return;
      const res = await notificationsAPI.getNotifications();
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error(e);
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
    <div ref={bellRef} className="relative z-[121]">
      <button 
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="rf-pulse-soft absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="rf-glass-strong rf-animate-enter mx-auto flex max-h-[75vh] flex-col overflow-hidden rounded-[26px]"
          style={panelStyle}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/70 p-4">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-medium text-[color:var(--rf-brand)] hover:text-teal-800">
                Mark all read
              </button>
            )}
          </div>
          
          <div className="rf-scrollbar min-h-[100px] flex-1 overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif._id} className={`flex gap-3 border-b border-slate-50 p-4 transition-colors hover:bg-white/60 ${!notif.isRead ? 'bg-teal-50/60' : ''}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(notif.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <button 
                      onClick={() => markAsRead(notif._id)}
                      className="h-fit rounded-full bg-teal-100 p-1 text-[color:var(--rf-brand)] hover:text-teal-700"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-white/70 p-3 text-center">
            <button 
              onClick={() => {
                setIsOpen(false);
                if (onViewAll) {
                  onViewAll();
                } else {
                  window.dispatchEvent(new CustomEvent('navToNotifications'));
                }
              }}
              className="w-full text-sm font-semibold text-[color:var(--rf-brand)] hover:text-teal-700"
            >
              View Full Notifications
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
