"use client";

import SaveBar from "./SaveBar";
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

  // What the server has, so the save bar only shows once something differs.
  const [savedConfig, setSavedConfig] = useState<SsoConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSsoConfig().then((cfg) => {
      if (cfg) {
        const loaded = {
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
        };
        setConfig(loaded);
        setSavedConfig(loaded);
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
        const next = {
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
        };
        setConfig(next);
        setSavedConfig(next);
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
      <div className="p-12 text-center text-muted text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-accent" />
        <span>Loading SSO configuration...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-subtle p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-subtle gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
            <Building2 className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">
              Single Sign-On (SSO) & Certificates
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
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

      <form id="settings-sso" onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Toggle SSO */}
        <div className="flex items-center justify-between p-4 bg-page rounded-lg border border-subtle">
          <div>
            <div className="font-bold text-ink">Enable Single Sign-On</div>
            <div className="text-[11px] text-ink-2 mt-0.5">
              Allow users to sign in seamlessly using your corporate identity provider.
            </div>
          </div>
          <input
            type="checkbox"
            aria-label="Enable single sign-on"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="w-4 h-4 accent-[rgb(var(--color-accent))] cursor-pointer"
          />
        </div>

        {/* Basic SSO Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sso-provider" className="block font-semibold text-ink mb-1">
              Identity Provider Name
            </label>
            <input
              id="sso-provider"
              type="text"
              value={config.providerName || ""}
              onChange={(e) => setConfig({ ...config, providerName: e.target.value })}
              placeholder="e.g. Corporate Okta / Keycloak SSO"
              className="w-full px-3 py-2 border border-subtle rounded-md focus:border-accent text-ink"
            />
          </div>

          <div>
            <label htmlFor="sso-client-id" className="block font-semibold text-ink mb-1">
              Client ID / Audience
            </label>
            <input
              id="sso-client-id"
              type="text"
              value={config.clientId || ""}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="trackr-client-id"
              className="w-full px-3 py-2 border border-subtle rounded-md focus:border-accent text-ink font-mono text-[11px]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="sso-issuer" className="block font-semibold text-ink mb-1">
            Issuer / Metadata URL
          </label>
          <input
              id="sso-issuer"
            type="text"
            value={config.issuerUrl || ""}
            onChange={(e) => setConfig({ ...config, issuerUrl: e.target.value })}
            placeholder="https://sso.company.com/auth/realms/master"
            className="w-full px-3 py-2 border border-subtle rounded-md focus:border-accent text-ink font-mono text-[11px]"
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
            <label htmlFor="sso-certificate" className="block font-semibold text-purple-900 mb-1 flex items-center justify-between">
              <span>X.509 PEM Certificate (RS256)</span>
              <span className="text-[10px] text-purple-700 font-normal">
                -----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----
              </span>
            </label>
            <textarea
              id="sso-certificate"
              rows={4}
              value={config.certificate || ""}
              onChange={(e) => setConfig({ ...config, certificate: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdTCCAl2gAwIBAgILBAAAAAABFUzAVTANBgkqhkiG9w0BAQsFADBLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEUMSAwHgYDVQQDExdFbnRlcnByaXNlIFNlc3Npb24gQ0E...&#10;-----END CERTIFICATE-----"
              className="w-full px-3 py-2 border border-purple-300 rounded-md focus:border-purple-600 text-purple-950 font-mono text-[10px] bg-white"
            />
          </div>

          <div>
            <label htmlFor="sso-secret" className="block font-semibold text-purple-900 mb-1 flex items-center justify-between">
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
              id="sso-secret"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-page rounded-lg border border-subtle">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-ink">Automatic User Provisioning (JIT)</div>
              <div className="text-[10px] text-ink-2">
                Automatically create a local account on first successful SSO sign-in.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Automatic user provisioning"
              checked={config.autoProvisionUsers}
              onChange={(e) => setConfig({ ...config, autoProvisionUsers: e.target.checked })}
              className="w-4 h-4 accent-[rgb(var(--color-accent))]"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-ink">Trust unverified email addresses</div>
              <div className="text-[10px] text-ink-2">
                Let an SSO login take over an existing account with the same email even when the provider
                doesn&apos;t mark the address verified. Only for providers that don&apos;t send the claim
                (Microsoft Entra ID) and whose addresses you trust.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Trust unverified email addresses"
              checked={config.trustUnverifiedEmails}
              onChange={(e) => setConfig({ ...config, trustUnverifiedEmails: e.target.checked })}
              className="w-4 h-4 accent-[rgb(var(--color-accent))]"
            />
          </div>

          <div>
            <label htmlFor="sso-default-role" className="block font-semibold text-ink mb-1">Default User Role</label>
            <select
              id="sso-default-role"
              value={config.defaultRole || "Developer"}
              onChange={(e) => setConfig({ ...config, defaultRole: e.target.value })}
              className="w-full px-3 py-1.5 border border-subtle rounded-md focus:border-accent text-ink bg-white"
            >
              <option value="Developer">Developer</option>
              <option value="QA Lead">QA Lead</option>
              <option value="Product Owner">Product Owner</option>
            </select>
          </div>
        </div>

        <SaveBar
          dirty={savedConfig !== null && JSON.stringify(config) !== JSON.stringify(savedConfig)}
          saving={saving}
          form="settings-sso"
          onDiscard={() => savedConfig && setConfig(savedConfig)}
        />
      </form>
    </div>
  );
}
