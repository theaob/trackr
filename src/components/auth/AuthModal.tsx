"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types";
import { useCurrentUser } from "@/context/UserContext";
import { registerUser, loginWithCredentials, getSsoPublicConfig } from "@/lib/actions/auth";
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

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch SSO Config on open
  useEffect(() => {
    if (isOpen) {
      getSsoPublicConfig().then((cfg) => setSsoConfig(cfg));
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
        setSuccessMsg(`Giriş başarılı! Hoş geldiniz, ${loggedInUser.name}`);
        if (onSuccess) onSuccess(loggedInUser);
        setTimeout(() => onClose(), 1000);
      } else {
        setError(res.error || "Giriş başarısız.");
      }
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu.");
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
        setSuccessMsg(`Hesap başarıyla oluşturuldu! Hoş geldiniz, ${newUser.name}`);
        if (onSuccess) onSuccess(newUser);
        setTimeout(() => onClose(), 1200);
      } else {
        setError(res.error || "Hesap oluşturulamadı.");
      }
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jira-navy/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-jira-gray-300 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-jira-navy text-white px-6 py-5 flex items-center justify-between border-b border-jira-navy/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-jira-blue/30 border border-jira-blue flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-jira-blue-light" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Kullanıcı Girişi ve SSO</h2>
              <p className="text-xs text-jira-gray-400">
                Bağımsız hesap oluşturun veya Kurumsal SSO ile bağlanın
              </p>
            </div>
          </div>
          {dismissible && (
            <button
              onClick={onClose}
              className="text-jira-gray-400 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-jira-gray-200 bg-jira-gray-50/80 px-6 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab("login"); setError(null); }}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "login"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Giriş Yap</span>
          </button>

          <button
            onClick={() => { setActiveTab("register"); setError(null); }}
            className={`pb-3 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "register"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Hesap Oluştur</span>
          </button>
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
                <label className="block text-xs font-semibold text-jira-navy mb-1">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-navy mb-1">Şifre</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Giriş Yap</span>
              </button>

              {ssoConfig?.enabled && (
                <>
                  <div className="relative py-2 flex items-center justify-center">
                    <div className="border-t border-jira-gray-200 w-full absolute"></div>
                    <span className="bg-white px-3 text-[11px] text-jira-gray-500 relative font-medium">veya</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSsoLogin}
                    disabled={loading}
                    className="w-full py-2 bg-jira-navy hover:bg-jira-navy/90 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-2 border border-jira-navy transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>{ssoConfig?.providerName || "Kurumsal SSO"} ile Giriş Yap</span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-jira-navy mb-1">Ad Soyad</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Ahmet Yılmaz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-navy mb-1">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="ahmet.yilmaz@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-navy mb-1">Şifre</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Minimum 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-navy mb-1">Organizasyon Rolü</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy bg-white"
                >
                  <option value="Developer">Developer (Yazılım Geliştirici)</option>
                  <option value="Senior Developer">Senior Developer</option>
                  <option value="QA Lead">QA Lead (Test Lideri)</option>
                  <option value="Product Owner">Product Owner (Ürün Sahibi)</option>
                  <option value="Project Lead">Project Lead (Proje Yöneticisi)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Bağımsız Kullanıcı Hesabı Oluştur</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
