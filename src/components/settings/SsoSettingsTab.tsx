"use client";

import React, { useState, useEffect } from "react";
import { getSsoConfig, updateSsoConfig } from "@/lib/actions/auth";
import {
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Building2,
  Loader2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface SsoConfigState {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  hasClientSecret?: boolean;
  certificate: string;
  autoProvisionUsers: boolean;
  trustUnverifiedEmails: boolean;
  defaultRole: string;
  configured?: boolean;
}

export default function SsoSettingsTab() {
  const [config, setConfig] = useState<SsoConfigState>({
    enabled: false,
    providerName: "Enterprise SAML / OIDC SSO",
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    hasClientSecret: false,
    certificate: "",
    autoProvisionUsers: true,
    trustUnverifiedEmails: false,
    defaultRole: "Developer",
    configured: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSsoConfig().then((cfg) => {
      if (cfg) {
        setConfig({
          enabled: !!cfg.enabled,
          providerName: cfg.providerName || "Enterprise SAML / OIDC SSO",
          issuerUrl: cfg.issuerUrl || "",
          clientId: cfg.clientId || "",
          clientSecret: "",
          hasClientSecret: !!cfg.hasClientSecret,
          certificate: cfg.certificate || "",
          autoProvisionUsers: cfg.autoProvisionUsers ?? true,
          trustUnverifiedEmails: cfg.trustUnverifiedEmails ?? false,
          defaultRole: cfg.defaultRole || "Developer",
          configured: !!cfg.configured,
        });
      } else {
        setMsg({
          type: "error",
          text: "You do not have permission to view or manage instance SSO configuration.",
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await updateSsoConfig({
        enabled: config.enabled,
        providerName: config.providerName,
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret || undefined,
        certificate: config.certificate,
        autoProvisionUsers: config.autoProvisionUsers,
        trustUnverifiedEmails: config.trustUnverifiedEmails,
        defaultRole: config.defaultRole,
      });

      if (res.success && res.config) {
        setConfig({
          enabled: !!res.config.enabled,
          providerName: res.config.providerName || "",
          issuerUrl: res.config.issuerUrl || "",
          clientId: res.config.clientId || "",
          clientSecret: "",
          hasClientSecret: !!res.config.hasClientSecret,
          certificate: res.config.certificate || "",
          autoProvisionUsers: res.config.autoProvisionUsers ?? true,
          trustUnverifiedEmails: res.config.trustUnverifiedEmails ?? false,
          defaultRole: res.config.defaultRole || "Developer",
          configured: !!res.config.configured,
        });
        setMsg({
          type: "success",
          text: "Single Sign-On (SSO) configuration saved successfully.",
        });
      } else {
        setMsg({ type: "error", text: res.error || "Failed to save SSO configuration." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "An unexpected error occurred while saving." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-jira-gray-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
        <span>Loading SSO configuration...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-jira-gray-300 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-jira-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
            <Building2 className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jira-navy">
              Single Sign-On (SSO) & Certificates
            </h2>
            <p className="text-xs text-jira-gray-600 mt-0.5">
              Configure corporate IdP (Keycloak, Okta, SAML 2.0, OIDC) authentication and token verification keys.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              config.enabled
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {config.enabled ? "SSO Active" : "SSO Disabled"}
          </span>
          {config.configured ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-800 border-blue-200">
              Keys Configured
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
              Key Required
            </span>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-md text-xs flex items-center gap-2 border ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Toggle SSO */}
        <div className="flex items-center justify-between p-4 bg-jira-gray-50 rounded-lg border border-jira-gray-200">
          <div>
            <div className="font-bold text-jira-navy">Enable Single Sign-On</div>
            <div className="text-[11px] text-jira-gray-600 mt-0.5">
              Allow users to sign in seamlessly using your corporate identity provider.
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
            <label className="block font-semibold text-jira-navy mb-1">
              Identity Provider Name
            </label>
            <input
              type="text"
              value={config.providerName || ""}
              onChange={(e) => setConfig({ ...config, providerName: e.target.value })}
              placeholder="e.g. Corporate Okta / Keycloak SSO"
              className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue text-jira-navy"
            />
          </div>

          <div>
            <label className="block font-semibold text-jira-navy mb-1">
              Client ID / Audience
            </label>
            <input
              type="text"
              value={config.clientId || ""}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="trackr-client-id"
              className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue text-jira-navy font-mono text-[11px]"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-jira-navy mb-1">
            Issuer / Metadata URL
          </label>
          <input
            type="text"
            value={config.issuerUrl || ""}
            onChange={(e) => setConfig({ ...config, issuerUrl: e.target.value })}
            placeholder="https://sso.company.com/auth/realms/master"
            className="w-full px-3 py-2 border border-jira-gray-300 rounded-md focus:border-jira-blue text-jira-navy font-mono text-[11px]"
          />
        </div>

        {/* Token Verification Keys */}
        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-lg space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0" />
              <div>
                <h4 className="font-bold text-purple-900">Token Signature Verification Key</h4>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  The key used to verify incoming ID token signatures. Provide an X.509 PEM certificate for RS256, or a client secret for HS256. At least one key must be provided to enable SSO.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-purple-900 mb-1 flex items-center justify-between">
              <span>X.509 PEM Certificate (RS256)</span>
              <span className="text-[10px] text-purple-700 font-normal">
                -----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----
              </span>
            </label>
            <textarea
              rows={4}
              value={config.certificate || ""}
              onChange={(e) => setConfig({ ...config, certificate: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdTCCAl2gAwIBAgILBAAAAAABFUzAVTANBgkqhkiG9w0BAQsFADBLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEUMSAwHgYDVQQDExdFbnRlcnByaXNlIFNlc3Npb24gQ0E...&#10;-----END CERTIFICATE-----"
              className="w-full px-3 py-2 border border-purple-300 rounded-md focus:border-purple-600 text-purple-950 font-mono text-[10px] bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-purple-900 mb-1 flex items-center justify-between">
              <span>Client Secret (HS256)</span>
              {config.hasClientSecret && (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Stored (leave blank to keep)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={config.clientSecret || ""}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                placeholder={
                  config.hasClientSecret
                    ? "Leave empty to keep current client secret"
                    : "Enter client secret for HS256 token verification"
                }
                className="w-full px-3 py-2 pr-9 border border-purple-300 rounded-md focus:border-purple-600 text-purple-950 font-mono text-[11px] bg-white"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-700 hover:text-purple-900"
                title={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Provisioning Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-jira-gray-50 rounded-lg border border-jira-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-jira-navy">Automatic User Provisioning (JIT)</div>
              <div className="text-[10px] text-jira-gray-600">
                Automatically create a local account on first successful SSO sign-in.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.autoProvisionUsers}
              onChange={(e) => setConfig({ ...config, autoProvisionUsers: e.target.checked })}
              className="w-4 h-4 accent-jira-blue"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-jira-navy">Trust unverified email addresses</div>
              <div className="text-[10px] text-jira-gray-600">
                Let an SSO login take over an existing account with the same email even when the provider
                doesn&apos;t mark the address verified. Only for providers that don&apos;t send the claim
                (Microsoft Entra ID) and whose addresses you trust.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.trustUnverifiedEmails}
              onChange={(e) => setConfig({ ...config, trustUnverifiedEmails: e.target.checked })}
              className="w-4 h-4 accent-jira-blue"
            />
          </div>

          <div>
            <label className="block font-semibold text-jira-navy mb-1">Default User Role</label>
            <select
              value={config.defaultRole || "Developer"}
              onChange={(e) => setConfig({ ...config, defaultRole: e.target.value })}
              className="w-full px-3 py-1.5 border border-jira-gray-300 rounded-md focus:border-jira-blue text-jira-navy bg-white"
            >
              <option value="Developer">Developer</option>
              <option value="QA Lead">QA Lead</option>
              <option value="Product Owner">Product Owner</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-jira-blue hover:bg-jira-blue-hover text-white font-bold text-xs rounded-md flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save SSO Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
