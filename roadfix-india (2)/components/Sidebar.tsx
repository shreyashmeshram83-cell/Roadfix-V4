
import React from 'react';
import { Home, PlusCircle, LayoutDashboard, MapPin, Lock, LogOut } from 'lucide-react';
import { ViewState } from '../types';
import { User } from '../services/apiService';
import NotificationBell from './NotificationBell';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  onUploadClick: () => void;
  isAdmin: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
  onAdminLoginClick: () => void;
  onUserLoginClick: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  onUploadClick,
  isAdmin,
  isLoggedIn,
  currentUser,
  onAdminLoginClick,
  onUserLoginClick,
  onLogout
}) => {
  
  const handleAdminClick = () => {
    if (isAdmin) {
      setView('ADMIN');
    } else {
      onAdminLoginClick();
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-[290px] lg:w-[320px] h-screen fixed left-0 top-0 z-30 p-4 lg:p-5">
        <div className="rf-glass flex w-full flex-col overflow-hidden rounded-[32px]">
          <div className="border-b border-[color:var(--rf-line)] px-6 py-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#135d66,#ef8354)] shadow-lg shadow-orange-200/50">
                <MapPin className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-display text-2xl font-bold tracking-tight text-slate-900">RoadFix</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-500">India Control</p>
              </div>
              {isLoggedIn && <NotificationBell onViewAll={() => setView('NOTIFICATIONS')} />}
            </div>

            <div className="rounded-[24px] border border-white/50 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Mission</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Report road damage, track live action, and keep your city visibly accountable.
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-5">
            <button
              onClick={() => setView('FEED')}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                currentView === 'FEED'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Home className="h-5 w-5" />
              Community Feed
            </button>

            <button
              onClick={() => isLoggedIn ? setView('PROFILE') : onUserLoginClick()}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                currentView === 'PROFILE'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              {isLoggedIn && currentUser ? <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#135d66,#2b8f97)] text-xs font-bold text-white">{currentUser.username[0].toUpperCase()}</div> : <Lock className="h-5 w-5" />}
              {isLoggedIn && currentUser ? `Hi, ${currentUser.username}` : 'Citizen Login'}
            </button>

            <button
              onClick={handleAdminClick}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                currentView === 'ADMIN'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              {isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              Authority Access
            </button>
          </nav>

          <div className="border-t border-[color:var(--rf-line)] p-4">
            <div className="rounded-[24px] bg-slate-900 px-4 py-4 text-white shadow-2xl shadow-slate-900/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/60">Quick Action</p>
              <button
                onClick={onUploadClick}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ef8354,#f2a65a)] px-4 py-3 font-semibold text-slate-900 transition-all active:scale-95"
              >
                <PlusCircle className="h-5 w-5" />
                Report Pothole
              </button>

              {(isAdmin || isLoggedIn) ? (
                <button
                  onClick={onLogout}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : (
                <button
                  onClick={onUserLoginClick}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  <Lock className="h-4 w-4" />
                  User Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="rf-glass mx-auto flex h-20 max-w-md items-center justify-around rounded-[28px] px-2">
          <button
            onClick={() => setView('FEED')}
            className={`flex h-full w-16 flex-col items-center justify-center space-y-1 ${
              currentView === 'FEED' ? 'text-[color:var(--rf-brand)]' : 'text-slate-500'
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="text-[10px] font-medium">Feed</span>
          </button>

          <button
            onClick={onUploadClick}
            className="flex flex-col items-center justify-center -mt-8"
            aria-label="Upload complaint"
          >
            <div className="rounded-full bg-[linear-gradient(135deg,#135d66,#ef8354)] p-4 text-white shadow-[0_16px_35px_-12px_rgba(19,93,102,0.7)] transition-transform active:scale-95">
              <PlusCircle className="h-7 w-7" />
            </div>
          </button>

          {isLoggedIn ? (
            <div className="flex h-full w-16 flex-col items-center justify-center space-y-1">
              <NotificationBell onViewAll={() => setView('NOTIFICATIONS')} />
            </div>
          ) : (
            <button
               onClick={handleAdminClick}
               className={`flex h-full w-16 flex-col items-center justify-center space-y-1 ${
                 currentView === 'ADMIN' ? 'text-[color:var(--rf-brand)]' : 'text-slate-500'
               }`}
             >
               {isAdmin ? <LayoutDashboard className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
               <span className="text-[10px] font-medium">Admin</span>
             </button>
          )}
        </div>
      </div>
    </>
  );
};
