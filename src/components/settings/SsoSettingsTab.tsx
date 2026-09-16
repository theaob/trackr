"use client";

import React, { useState, useEffect } from "react";
import { getSsoConfig, updateSsoConfig } from "@/lib/actions/auth";
import {
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileCode,
  Building2,
  Lock,
  Loader2,
  Info,
  BadgeCheck,
} from "lucide-react";

export default function SsoSettingsTab() {
  const [config, setConfig] = useState<any>({
    enabled: true,
    providerName: "Enterprise SAML/OIDC SSO",
    issuerUrl: "https://sso.internal.company.com/auth/realms/master",
    clientId: "trackr-client-id",
    clientSecret: "",
    certificate: "",
    allowSelfSignedCerts: true,
    autoProvisionUsers: true,
    defaultRole: "Developer",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSsoConfig().then((cfg) => {
      if (cfg) setConfig(cfg);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await updateSsoConfig(config);
      if (res.success && res.config) {
        setConfig(res.config);
        setMsg({ type: "success", text: "SSO ve Self-Signed Sertifika ayarları başarıyla kaydedildi!" });
      } else {
        setMsg({ type: "error", text: res.error || "Ayarlar kaydedilemedi." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Kaydetme hatası." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-jira-gray-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
        <span>SSO Yapılandırması Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-jira-gray-300 p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-jira-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
            <Building2 className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jira-navy">SSO (Single Sign-On) ve Sertifika Yapılandırması</h2>
            <p className="text-xs text-jira-gray-600 mt-0.5">
              Kurumsal IdP (Keycloak, Okta, SAML 2.0, OIDC) entegrasyonu ve Öz-İmzalı (Self-Signed) sertifika ayarlarını yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${config.enabled ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-gray-100 text-gray-700 border-gray-300"}`}>
            {config.enabled ? "SSO Aktif" : "SSO Devre Dışı"}
          </span>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-md text-xs flex items-center gap-2 border ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
          {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Toggle SSO */}
        <div className="flex items-center justify-between p-4 bg-jira-gray-50 rounded-lg border border-jira-gray-200">
          <div>
            <div className="font-bold text-jira-navy">SSO Kimlik Doğrulamasını Etkinleştir</div>
            <div className="text-[11px] text-jira-gray-600 mt-0.5">
              Kullanıcıların tek tıkla kurumsal kimlik sağlayıcınız üzerinden giriş yapmasına izin verin.
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="w-4 h-4 accent-jira-blue cursor-pointer"
          />
        </div>

        {/* Basic SSO Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-jira-navy mb-1">SSO Sağlayıcı Adı</label>
            <input
              type="text"
              value={config.providerName || ""}
              onChange={(e) => setConfig({ ...config, providerName: e.target.value })}
              placeholder="Örn: Keycloak SSO / Corporate Okta"
              className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
            />
          </div>

          <div>
            <label className="block font-semibold text-jira-navy mb-1">Client ID / Entity ID</label>
            <input
              type="text"
              value={config.clientId || ""}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="trackr-client-id"
              className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy font-mono text-[11px]"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-jira-navy mb-1">Issuer / Metadata URL</label>
          <input
            type="text"
            value={config.issuerUrl || ""}
            onChange={(e) => setConfig({ ...config, issuerUrl: e.target.value })}
            placeholder="https://sso.company.com/auth/realms/master"
            className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy font-mono text-[11px]"
          />
        </div>

        {/* Self-Signed Certificate Settings */}
        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-lg space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-700" />
              <div>
                <h4 className="font-bold text-purple-900">Self-Signed (Öz-İmzalı) Sertifika Ayarları</h4>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  İç ağdaki öz-imzalı sertifikaya sahip IdP sunucuları için TLS doğrulaması ve PEM sertifikası tanımı.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.allowSelfSignedCerts}
                onChange={(e) => setConfig({ ...config, allowSelfSignedCerts: e.target.checked })}
                className="w-4 h-4 accent-purple-700"
              />
              <span className="font-bold text-purple-900 text-xs">Self-Signed Sertifikalara İzin Ver</span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-purple-900 mb-1 flex items-center justify-between">
              <span>X.509 PEM Sertifikası (Opsiyonel)</span>
              <span className="text-[10px] text-purple-700 font-normal">-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----</span>
            </label>
            <textarea
              rows={4}
              value={config.certificate || ""}
              onChange={(e) => setConfig({ ...config, certificate: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdTCCAl2gAwIBAgILBAAAAAABFUzAVTANBgkqhkiG9w0BAQsFADBLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEUMSAwHgYDVQQDExdFbnRlcnByaXNlIFNlc3Npb24gQ0E...&#10;-----END CERTIFICATE-----"
              className="w-full px-3 py-2 border border-purple-300 rounded-md focus:border-purple-600 outline-none text-purple-950 font-mono text-[10px] bg-white"
            />
          </div>
        </div>

        {/* Provisioning Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-jira-gray-50 rounded-lg border border-jira-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-jira-navy">Otomatik Kullanıcı Kaydı (Auto-Provisioning)</div>
              <div className="text-[10px] text-jira-gray-600">İlk defa SSO ile bağlanan kullanıcı için otomatik hesap açılır.</div>
            </div>
            <input
              type="checkbox"
              checked={config.autoProvisionUsers}
              onChange={(e) => setConfig({ ...config, autoProvisionUsers: e.target.checked })}
              className="w-4 h-4 accent-jira-blue"
            />
          </div>

          <div>
            <label className="block font-semibold text-jira-navy mb-1">Varsayılan Rol</label>
            <select
              value={config.defaultRole || "Developer"}
              onChange={(e) => setConfig({ ...config, defaultRole: e.target.value })}
              className="w-full px-3 py-1.5 border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy bg-white"
            >
              <option value="Developer">Developer</option>
              <option value="QA Lead">QA Lead</option>
              <option value="Product Owner">Product Owner</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-jira-blue hover:bg-jira-blue-hover text-white font-bold text-xs rounded-md flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>SSO Ayarlarını Kaydet</span>
          </button>
        </div>
      </form>
    </div>
  );
}
