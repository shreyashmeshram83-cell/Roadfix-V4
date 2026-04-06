
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (username: string, email: string, password: string) => Promise<boolean>;
  isAdmin?: boolean;
  hintMessage?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin, onSignup, isAdmin = false, hintMessage }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedUsername = username.trim();
      const normalizedEmail = email.trim().toLowerCase();

      if (isSignup) {
        const success = await onSignup(normalizedUsername, normalizedEmail, password);
        if (success) {
          onClose();
        } else {
          setError('Signup failed');
        }
      } else {
        const success = await onLogin(normalizedEmail, password);
        if (success) {
          onClose();
        } else {
          setError('Invalid credentials');
        }
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="rf-glass-strong w-full max-w-md overflow-hidden rounded-[30px] shadow-2xl">
        <div className="p-6 md:p-7">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[linear-gradient(135deg,#135d66,#ef8354)] p-3 shadow-lg shadow-orange-100/50">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">{isSignup ? 'Create Account' : (isAdmin ? 'Admin Login' : 'User Login')}</h2>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{isSignup ? 'Join the community' : (isAdmin ? 'Authorized personnel only' : 'Sign in to your account')}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {hintMessage && (
              <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-slate-700">
                {hintMessage}
              </div>
            )}
            {isSignup && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none transition-all focus:border-[color:var(--rf-brand)] focus:ring-2 focus:ring-teal-100"
                  placeholder="Enter username"
                  required
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none transition-all focus:border-[color:var(--rf-brand)] focus:ring-2 focus:ring-teal-100"
                placeholder="Enter email address"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full rounded-2xl border border-white/70 bg-white/80 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-[color:var(--rf-brand)] focus:ring-2 focus:ring-teal-100"
                  placeholder={isAdmin ? "Enter admin password" : "Enter password"}
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#135d66,#ef8354)] py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? 'Please wait...' : (isSignup ? 'Create Account' : (isAdmin ? 'Access Dashboard' : 'Sign In'))}
            </button>
          </form>
          
          {!isAdmin && (
            <div className="mt-4 border-t border-slate-200/70 pt-4 text-center">
              <button
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError('');
                  setUsername('');
                  setEmail('');
                  setPassword('');
                }}
                className="text-sm font-medium text-[color:var(--rf-brand)] hover:text-teal-700"
              >
                {isSignup ? 'Already have an account? Sign In' : 'Need an account? Create one'}
              </button>
            </div>
          )}

          {!isAdmin && !isSignup && (
            <div className="mt-2 text-center">
              <p className="text-xs text-slate-400">Demo user: <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">john.doe@example.com</span>, password: <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">user123</span></p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
