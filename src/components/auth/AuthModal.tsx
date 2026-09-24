"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { registerUser, loginWithCredentials, getSsoPublicConfig, isSelfRegistrationOpen } from "@/lib/actions/auth";
import {
  Shield,
  KeyRound,
  UserPlus,
  LogIn,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Building2,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
  /** The dedicated sign-in page renders this with no way to dismiss it. */
  dismissible?: boolean;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  dismissible = true,
}: AuthModalProps) {
  const { setCurrentUser, setUsers, users } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Developer");

  // SSO Config State
  const [ssoConfig, setSsoConfig] = useState<any>(null);
  // Unknown until loaded, and hidden meanwhile, so the tab never flashes up.
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch SSO Config on open
  useEffect(() => {
    if (isOpen) {
      getSsoPublicConfig().then((cfg) => setSsoConfig(cfg));
      isSelfRegistrationOpen().then((open) => {
        setRegistrationOpen(open);
        if (!open) setActiveTab("login");
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await loginWithCredentials(email, password);
      if (res.success && res.user) {
        const loggedInUser = res.user as unknown as User;
        setCurrentUser(loggedInUser);
        // Add to users list if missing
        setUsers(users.some((u) => u.id === loggedInUser.id) ? users : [...users, loggedInUser]);
        setSuccessMsg(`Welcome, ${loggedInUser.name}!`);
        if (onSuccess) onSuccess(loggedInUser);
        setTimeout(() => onClose(), 1000);
      } else {
        setError(res.error || "Sign-in failed.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await registerUser({ name, email, password, role });
      if (res.success && res.user) {
        const newUser = res.user as unknown as User;
        setCurrentUser(newUser);
        setUsers([...users, newUser]);
        setSuccessMsg(`Account created successfully! Welcome, ${newUser.name}.`);
        if (onSuccess) onSuccess(newUser);
        setTimeout(() => onClose(), 1200);
      } else {
        setError(res.error || "Failed to create account.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * SSO is completed by the identity provider, not by this form: the start
   * endpoint mints a nonce and state, then redirects to the IdP. Nothing here
   * can assert an identity.
   */
  const handleSsoLogin = () => {
    setError(null);
    setLoading(true);
    window.location.href = "/api/v1/auth/sso/start";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-subtle overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-ink text-surface px-6 py-5 flex items-center justify-between border-b border-ink/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/30 border border-accent flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-surface" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">User Sign In & SSO</h2>
              <p className="text-xs text-surface/75">
                Sign in with local credentials or corporate SSO
              </p>
            </div>
          </div>
          {dismissible && (
            <button
              onClick={onClose}
              className="text-surface/70 hover:text-surface p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-subtle bg-page/80 px-6 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab("login"); setError(null); }}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "login"
                ? "border-accent text-accent"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          {registrationOpen && (
          <button
            onClick={() => { setActiveTab("register"); setError(null); }}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "register"
                ? "border-accent text-accent"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-login-email" className="block text-xs font-semibold text-ink mb-1">Email Address</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    required
                    id="auth-login-email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-login-password" className="block text-xs font-semibold text-ink mb-1">Password</label>
                <div className="relative">
                  <Lock aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    required
                    id="auth-login-password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Sign In</span>
              </button>

              {ssoConfig?.enabled && (
                <>
                  <div className="relative py-2 flex items-center justify-center">
                    <div className="border-t border-subtle w-full absolute"></div>
                    <span className="bg-white px-3 text-[11px] text-muted relative font-medium">or</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSsoLogin}
                    disabled={loading}
                    className="w-full py-2 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md flex items-center justify-center gap-2 border border-ink transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Sign in with {ssoConfig?.providerName || "Corporate SSO"}</span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === "register" && registrationOpen && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-register-name" className="block text-xs font-semibold text-ink mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    required
                    id="auth-register-name"
                    autoComplete="name"
                    placeholder="Alex Chen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-register-email" className="block text-xs font-semibold text-ink mb-1">Email Address</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    required
                    id="auth-register-email"
                    autoComplete="email"
                    placeholder="alex.chen@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-register-password" className="block text-xs font-semibold text-ink mb-1">Password</label>
                <div className="relative">
                  <Lock aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    id="auth-register-password"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-register-role" className="block text-xs font-semibold text-ink mb-1">Organization Role</label>
                <select
                  id="auth-register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink bg-white"
                >
                  <option value="Developer">Developer</option>
                  <option value="Senior Developer">Senior Developer</option>
                  <option value="QA Lead">QA Lead</option>
                  <option value="Product Owner">Product Owner</option>
                  <option value="Project Lead">Project Lead</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Create Local User Account</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
