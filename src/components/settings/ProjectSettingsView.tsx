"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Project, User, CustomField, Webhook, ProjectMember, BoardType, WorkflowStatus, WorkflowTransition, Component } from "@/types";
import { updateProject } from "@/lib/actions/projects";
import { deleteCustomField } from "@/lib/actions/customFields";
import { deleteComponent } from "@/lib/actions/components";
import {
  deleteWebhook,
  updateWebhook,
  testWebhook,
} from "@/lib/actions/webhooks";
import {
  Save,
  Check,
  Globe,
  Lock,
  ShieldCheck,
  Sliders,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Asterisk,
  Webhook as WebhookIcon,
  Send,
  History,
  Power,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Users,
  ShieldAlert,
  GitBranch,
  Boxes,
  Monitor,
  Kanban,
  ListFilter,
} from "lucide-react";
import CreateCustomFieldModal from "./CreateCustomFieldModal";
import CreateComponentModal from "./CreateComponentModal";
import CreateWebhookModal from "./CreateWebhookModal";
import WebhookDeliveriesModal from "./WebhookDeliveriesModal";
import ProjectAccessTab from "./ProjectAccessTab";
import WorkflowSettingsTab from "./WorkflowSettingsTab";
import UserAvatar from "@/components/common/UserAvatar";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import {
  CustomFieldIcon,
  parseFieldOptions,
} from "@/components/common/CustomFieldRenderer";

interface ProjectSettingsViewProps {
  project: Project;
  users: User[];
  initialCustomFields?: CustomField[];
  initialWebhooks?: Webhook[];
  initialMembers?: ProjectMember[];
  initialWorkflowStatuses?: WorkflowStatus[];
  initialWorkflowTransitions?: WorkflowTransition[];
  initialComponents?: Component[];
}

export default function ProjectSettingsView({
  project,
  users,
  initialCustomFields = [],
  initialWebhooks = [],
  initialMembers = [],
  initialWorkflowStatuses = [],
  initialWorkflowTransitions = [],
  initialComponents = [],
}: ProjectSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "fields" | "components" | "webhooks" | "access" | "workflow"
  >("general");
  const router = useRouter();
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const permissions = useProjectPermissions(project, members);

  // General Settings State
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [boardType, setBoardType] = useState<BoardType>(project.boardType || "SCRUM");
  const [allowAnonymousViewers, setAllowAnonymousViewers] = useState(
    !!project.allowAnonymousViewers
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>(initialCustomFields);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  // Components State
  const [components, setComponents] = useState<Component[]>(initialComponents);
  const [isCreateComponentOpen, setIsCreateComponentOpen] = useState(false);
  const [deletingComponentId, setDeletingComponentId] = useState<string | null>(null);

  // Webhooks State
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false);
  const [selectedWebhookForDeliveries, setSelectedWebhookForDeliveries] = useState<Webhook | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    webhookId: string;
    success: boolean;
    status: number;
    durationMs?: number;
  } | null>(null);


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    const res = await updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      boardType,
      allowAnonymousViewers,
    });

    setIsSaving(false);
    if (res.success) {
      setSavedSuccess(true);
      router.refresh();
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setSaveError(res.error || "Failed to update project details.");
    }
  };

  const handleDeleteField = async (fieldId: string, fieldName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${fieldName}"? All issue values for this custom field will be permanently removed.`
      )
    ) {
      return;
    }

    setDeletingFieldId(fieldId);
    try {
      const res = await deleteCustomField(fieldId);
      if (res.success) {
        setCustomFields((prev) => prev.filter((f) => f.id !== fieldId));
      } else {
        alert("Failed to delete custom field.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the custom field.");
    } finally {
      setDeletingFieldId(null);
    }
  };

  const handleFieldCreated = (newField: CustomField) => {
    setCustomFields((prev) => [...prev, newField]);
  };

  const handleDeleteComponent = async (componentId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? It will be removed from every issue that has it.`)) {
      return;
    }

    setDeletingComponentId(componentId);
    try {
      const res = await deleteComponent(componentId);
      if (res.success) {
        setComponents((prev) => prev.filter((c) => c.id !== componentId));
      } else {
        alert(res.error || "Failed to delete component.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the component.");
    } finally {
      setDeletingComponentId(null);
    }
  };

  const handleComponentCreated = (newComponent: Component) => {
    setComponents((prev) => [...prev, newComponent].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleToggleWebhook = async (webhookId: string, currentEnabled: boolean) => {
    const res = await updateWebhook(webhookId, { enabled: !currentEnabled });
    if (res.success && res.webhook) {
      setWebhooks((prev) =>
        prev.map((wh) => (wh.id === webhookId ? res.webhook : wh))
      );
    }
  };

  const handleDeleteWebhook = async (webhookId: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete webhook "${name}"? Delivery history will be lost.`
      )
    ) {
      return;
    }
    const res = await deleteWebhook(webhookId);
    if (res.success) {
      setWebhooks((prev) => prev.filter((wh) => wh.id !== webhookId));
    } else {
      alert("Failed to delete webhook.");
    }
  };

  const handleTestPing = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.id);
    setTestResult(null);
    try {
      const res = await testWebhook(webhook.id);
      setTestResult({
        webhookId: webhook.id,
        success: !!res.success,
        status: res.status || 0,
        durationMs: res.durationMs,
      });
      setTimeout(() => setTestResult(null), 6000);
    } catch (err) {
      console.error(err);
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleWebhookCreated = (newWh: Webhook) => {
    setWebhooks((prev) => [newWh, ...prev]);
  };


  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 bg-white">
      {/* Mobile Notice: Administrative features are desktop-only */}
      <div className="md:hidden flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs mb-4">
          <Monitor className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-jira-navy mb-1.5">
          Desktop Only Feature
        </h2>
        <p className="text-xs text-jira-gray-600 max-w-sm mb-6 leading-relaxed">
          Administrative features (project configuration, workflows, state transition graphs, access control, custom fields, and webhooks) are designed for desktop screens.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <Link
            href={`/projects/${project.key}/board`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-jira-blue hover:bg-jira-blue-hover text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Kanban className="w-4 h-4" />
            <span>Back to Active Board</span>
          </Link>
          <Link
            href={`/projects/${project.key}/issues`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-jira-gray-100 hover:bg-jira-gray-200 text-jira-navy border border-jira-gray-200 rounded-md text-xs font-semibold transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            <span>Back to Issues</span>
          </Link>
        </div>
      </div>

      {/* Desktop Settings Layout */}
      <div className="hidden md:block space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-jira-gray-200">
          <h1 className="text-xl font-bold text-jira-navy tracking-tight">Project Settings</h1>
          <p className="text-xs text-jira-gray-600 mt-1">
            Configure project details, workflow metadata, and custom fields for {project.name}.
          </p>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 sm:gap-6 mt-4 border-b border-jira-gray-200 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "general"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            General Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fields")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "fields"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Custom Fields
            <span className="ml-1 px-1.5 py-0.2 bg-jira-gray-100 text-jira-gray-700 rounded-full text-[10px] font-bold">
              {customFields.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("components")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "components"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Components
            <span className="ml-1 px-1.5 py-0.2 bg-jira-gray-100 text-jira-gray-700 rounded-full text-[10px] font-bold">
              {components.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "webhooks"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <WebhookIcon className="w-3.5 h-3.5" />
            Webhooks
            <span className="ml-1 px-1.5 py-0.2 bg-jira-gray-100 text-jira-gray-700 rounded-full text-[10px] font-bold">
              {webhooks.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("access")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "access"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Access & Roles
            <span className="ml-1 px-1.5 py-0.2 bg-jira-gray-100 text-jira-gray-700 rounded-full text-[10px] font-bold">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("workflow")}
            className={`pb-2.5 text-xs font-semibold tracking-wide border-b-2 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
              activeTab === "workflow"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-600 hover:text-jira-navy"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Workflow
            <span className="ml-1 px-1.5 py-0.2 bg-jira-gray-100 text-jira-gray-700 rounded-full text-[10px] font-bold">
              {initialWorkflowStatuses.length}
            </span>
          </button>
        </div>
      </div>

      {permissions.isViewer && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Read-Only Viewer Access: </span>
            You are viewing project settings with Stakeholder/Viewer permissions. Only Project Administrators can modify project details, custom fields, webhooks, or member roles.
          </div>
        </div>
      )}


      {/* Tab 1: General Details */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="mt-6 space-y-6 text-sm max-w-2xl">
          {savedSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Project details updated successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Project Key
            </label>
            <input
              type="text"
              value={project.key}
              disabled
              className="w-full px-3 py-2 bg-jira-gray-100 border border-jira-gray-300 rounded text-jira-gray-600 font-mono text-xs cursor-not-allowed"
            />
            <p className="text-[11px] text-jira-gray-500 mt-1">
              The project key is used as the prefix for all issue identifiers (e.g. {project.key}-1).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-jira-gray-300 rounded focus:border-jira-blue outline-none text-jira-navy leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Project Lead
            </label>
            <div className="flex items-center gap-3 px-3 py-2 border border-jira-gray-300 rounded bg-jira-gray-50">
              {project.lead && (
                <UserAvatar user={project.lead} size="sm" />
              )}
              <span className="font-medium text-jira-navy">{project.lead?.name || "None"}</span>
              <span className="text-xs text-jira-gray-500 ml-auto flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-jira-blue" />
                Lead Admin
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Board Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  {
                    value: "SCRUM" as BoardType,
                    title: "Scrum",
                    description: "Plan sprints in the Backlog. The board shows only the active sprint.",
                  },
                  {
                    value: "KANBAN" as BoardType,
                    title: "Kanban",
                    description: "No sprints. The board shows every issue pulled out of the Backlog, continuously.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`p-3 rounded-lg border cursor-pointer select-none transition-colors ${
                    boardType === option.value
                      ? "bg-jira-blue-light border-jira-blue"
                      : "bg-jira-gray-50 border-jira-gray-300 hover:border-jira-gray-400"
                  } ${!permissions.canManageProject ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <input
                    type="radio"
                    name="boardType"
                    value={option.value}
                    checked={boardType === option.value}
                    disabled={!permissions.canManageProject}
                    onChange={() => setBoardType(option.value)}
                    className="sr-only"
                  />
                  <div
                    className={`font-bold text-sm ${
                      boardType === option.value ? "text-jira-blue" : "text-jira-navy"
                    }`}
                  >
                    {option.title}
                  </div>
                  <p className="text-[11px] text-jira-gray-600 mt-1 leading-relaxed">
                    {option.description}
                  </p>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
              Visibility
            </label>
            <div
              className={`p-4 rounded-lg border ${
                allowAnonymousViewers
                  ? "bg-amber-50/60 border-amber-300"
                  : "bg-jira-gray-50 border-jira-gray-300"
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowAnonymousViewers}
                  disabled={!permissions.canManageProject}
                  onChange={(e) => setAllowAnonymousViewers(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-jira-blue disabled:cursor-not-allowed"
                />
                <div>
                  <div className="font-bold text-jira-navy flex items-center gap-2">
                    {allowAnonymousViewers ? (
                      <Globe className="w-4 h-4 text-amber-700" />
                    ) : (
                      <Lock className="w-4 h-4 text-jira-gray-600" />
                    )}
                    <span>Allow anyone to view this project without signing in</span>
                  </div>
                  <p className="text-[11px] text-jira-gray-600 mt-1 leading-relaxed">
                    Visitors get the <strong>Viewer</strong> role: they can read the board,
                    backlog, issues and releases, and can change nothing. Team member email
                    addresses are not exposed. Everything in this project becomes readable by
                    anyone who has the link.
                  </p>
                </div>
              </label>

              {allowAnonymousViewers && (
                <p className="text-[11px] text-amber-900 font-semibold mt-3 pl-7">
                  This project is public. Anyone with the link can read every issue in it.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-jira-gray-200">
            <button
              type="submit"
              disabled={isSaving || !permissions.canManageProject}
              title={!permissions.canManageProject ? "Only Project Administrators can modify project details" : undefined}
              className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save changes"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Custom Fields */}
      {activeTab === "fields" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-navy">Project Custom Fields</h2>
              <p className="text-xs text-jira-gray-500 mt-0.5">
                Extend issues in {project.name} with custom attributes, dropdown lists, numbers, and flags.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Field
              </button>
            )}
          </div>

          {customFields.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-jira-gray-300 rounded-lg bg-jira-gray-50">
              <Sliders className="w-8 h-8 text-jira-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-jira-navy">No custom fields yet</h3>
              <p className="text-xs text-jira-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Add specialized metadata to your issues such as Environment, Customer Tier, Target Release, or Estimated Hours.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Custom Field
              </button>
            </div>
          ) : (
            <div className="border border-jira-gray-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
              <table className="min-w-full divide-y divide-jira-gray-200 text-left text-xs">
                <thead className="bg-jira-gray-50 font-semibold text-jira-gray-600">
                  <tr>
                    <th className="px-4 py-3">Field Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Options / Schema</th>
                    <th className="px-4 py-3">Required</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jira-gray-200 text-jira-navy">
                  {customFields.map((f) => {
                    const options = parseFieldOptions(f.options);
                    return (
                      <tr key={f.id} className="hover:bg-jira-gray-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-jira-navy flex items-center gap-1.5">
                            <CustomFieldIcon type={f.type} />
                            {f.name}
                          </div>
                          {f.description && (
                            <div className="text-[11px] text-jira-gray-500 mt-0.5 max-w-xs truncate">
                              {f.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-jira-gray-100 text-jira-gray-700 border border-jira-gray-300">
                            {f.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {options.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {options.slice(0, 3).map((opt, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 bg-jira-gray-100 text-jira-gray-600 rounded border border-jira-gray-200 font-mono"
                                >
                                  {opt}
                                </span>
                              ))}
                              {options.length > 3 && (
                                <span className="text-[10px] text-jira-gray-400 self-center">
                                  +{options.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-jira-gray-400 italic text-[11px]">Freeform</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {f.required ? (
                            <span className="inline-flex items-center gap-0.5 text-jira-red font-semibold text-[11px]">
                              <Asterisk className="w-2.5 h-2.5" />
                              Required
                            </span>
                          ) : (
                            <span className="text-jira-gray-400 text-[11px]">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={deletingFieldId === f.id}
                            onClick={() => handleDeleteField(f.id, f.name)}
                            className="text-jira-gray-400 hover:text-jira-red p-1 rounded hover:bg-jira-red/10 transition-colors disabled:opacity-50"
                            title="Delete custom field"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Components */}
      {activeTab === "components" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-navy">Project Components</h2>
              <p className="text-xs text-jira-gray-500 mt-0.5">
                Sub-teams or subsystems within {project.name} (e.g. Backend API, Mobile App). Issues pick
                from this list &mdash; members can&apos;t create a new one from the issue view.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateComponentOpen(true)}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Component
              </button>
            )}
          </div>

          {components.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-jira-gray-300 rounded-lg bg-jira-gray-50">
              <Boxes className="w-8 h-8 text-jira-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-jira-navy">No components yet</h3>
              <p className="text-xs text-jira-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Group issues by the part of the system they belong to, with an optional owner for each.
              </p>
              {permissions.canManageProject && (
                <button
                  type="button"
                  onClick={() => setIsCreateComponentOpen(true)}
                  className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Your First Component
                </button>
              )}
            </div>
          ) : (
            <div className="border border-jira-gray-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
              <table className="min-w-full divide-y divide-jira-gray-200 text-left text-xs">
                <thead className="bg-jira-gray-50 font-semibold text-jira-gray-600">
                  <tr>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jira-gray-200 text-jira-navy">
                  {components.map((c) => (
                    <tr key={c.id} className="hover:bg-jira-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-jira-navy flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-jira-blue" />
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="text-[11px] text-jira-gray-500 mt-0.5 max-w-xs truncate">
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.lead ? (
                          <div className="flex items-center gap-1.5">
                            <UserAvatar user={c.lead} size="xs" />
                            <span>{c.lead.name}</span>
                          </div>
                        ) : (
                          <span className="text-jira-gray-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{c._count?.issues ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        {permissions.canManageProject && (
                          <button
                            type="button"
                            disabled={deletingComponentId === c.id}
                            onClick={() => handleDeleteComponent(c.id, c.name)}
                            className="text-jira-gray-400 hover:text-jira-red p-1 rounded hover:bg-jira-red/10 transition-colors disabled:opacity-50"
                            title="Delete component"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Webhooks */}
      {activeTab === "webhooks" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-navy">Project Webhooks</h2>
              <p className="text-xs text-jira-gray-500 mt-0.5">
                Trigger real-time HTTP POST notifications to Slack, Discord, CI/CD, or internal tools when events occur.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateWebhookOpen(true)}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Webhook
              </button>
            )}
          </div>

          {webhooks.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-jira-gray-300 rounded-lg bg-jira-gray-50">
              <WebhookIcon className="w-8 h-8 text-jira-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-jira-navy">No webhooks configured</h3>
              <p className="text-xs text-jira-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Connect external systems like automated CI/CD runners, notification channels, or analytics pipelines.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateWebhookOpen(true)}
                className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Webhook
              </button>
            </div>
          ) : (
            <div className="border border-jira-gray-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
              <table className="min-w-full divide-y divide-jira-gray-200 text-left text-xs">
                <thead className="bg-jira-gray-50 font-semibold text-jira-gray-600">
                  <tr>
                    <th className="px-4 py-3">Webhook Name & Endpoint</th>
                    <th className="px-4 py-3">Subscribed Events</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jira-gray-200 text-jira-navy">
                  {webhooks.map((wh) => {
                    let eventsList: string[] = [];
                    try {
                      eventsList = JSON.parse(wh.events);
                    } catch {}

                    const isTesting = testingWebhookId === wh.id;
                    const result = testResult?.webhookId === wh.id ? testResult : null;

                    return (
                      <tr key={wh.id} className="hover:bg-jira-gray-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-jira-navy flex items-center gap-1.5 flex-wrap">
                            <WebhookIcon className="w-3.5 h-3.5 text-jira-blue shrink-0" />
                            <span>{wh.name}</span>
                            {wh.secret && (
                              <span className="text-[10px] text-jira-gray-500 font-normal px-1.5 py-0.2 bg-jira-gray-100 rounded border border-jira-gray-300">
                                HMAC Signed
                              </span>
                            )}
                            {wh.jqlFilter && (
                              <span
                                className="text-[10px] text-jira-blue font-mono px-1.5 py-0.2 bg-jira-blue-light/60 rounded border border-jira-blue/30 max-w-[220px] truncate"
                                title={`JQL Filter: ${wh.jqlFilter}`}
                              >
                                JQL: {wh.jqlFilter}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-jira-gray-500 mt-0.5 max-w-sm truncate">
                            {wh.url}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {eventsList.slice(0, 4).map((evt, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 bg-jira-gray-100 text-jira-gray-700 rounded border border-jira-gray-200 font-mono"
                              >
                                {evt}
                              </span>
                            ))}
                            {eventsList.length > 4 && (
                              <span className="text-[10px] text-jira-gray-400 self-center">
                                +{eventsList.length - 4} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleWebhook(wh.id, wh.enabled)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                              wh.enabled
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                                : "bg-jira-gray-100 text-jira-gray-600 border border-jira-gray-300 hover:bg-jira-gray-200"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${wh.enabled ? "bg-emerald-500" : "bg-jira-gray-400"}`} />
                            {wh.enabled ? "Active" : "Paused"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {result && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded animate-in fade-in ${
                                  result.success
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {result.success ? `HTTP ${result.status} (${result.durationMs}ms)` : `Failed (${result.status})`}
                              </span>
                            )}

                            <button
                              type="button"
                              disabled={isTesting}
                              onClick={() => handleTestPing(wh)}
                              className="text-xs px-2.5 py-1 rounded bg-jira-gray-100 text-jira-navy hover:bg-jira-gray-200 font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                              title="Send test ping"
                            >
                              {isTesting ? (
                                <Loader2 className="w-3 h-3 animate-spin text-jira-blue" />
                              ) : (
                                <Send className="w-3 h-3 text-jira-blue" />
                              )}
                              <span>Test Ping</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedWebhookForDeliveries(wh)}
                              className="text-xs px-2.5 py-1 rounded bg-jira-gray-100 text-jira-navy hover:bg-jira-gray-200 font-semibold inline-flex items-center gap-1 transition-colors"
                              title="View delivery history"
                            >
                              <History className="w-3 h-3 text-jira-gray-600" />
                              <span>Deliveries</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWebhook(wh.id, wh.name)}
                              className="text-jira-gray-400 hover:text-jira-red p-1 rounded hover:bg-jira-red/10 transition-colors"
                              title="Delete webhook"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Access & Roles */}
      {activeTab === "access" && (
        <div className="mt-6">
          <ProjectAccessTab
            project={project}
            initialMembers={members}
            allOrgUsers={users}
            currentUserRole={permissions.role}
            isProjectLead={permissions.isLead}
          />
        </div>
      )}

      {/* Tab 5: Workflow */}
      {activeTab === "workflow" && (
        <div className="mt-6">
          <WorkflowSettingsTab
            project={project}
            initialStatuses={initialWorkflowStatuses}
            initialTransitions={initialWorkflowTransitions}
            canManage={permissions.canManageProject}
          />
        </div>
      )}

      {/* Creation Modal */}
      <CreateCustomFieldModal
        projectId={project.id}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleFieldCreated}
      />

      {/* Component Creation Modal */}
      <CreateComponentModal
        projectId={project.id}
        members={members.map((m) => m.user)}
        isOpen={isCreateComponentOpen}
        onClose={() => setIsCreateComponentOpen(false)}
        onCreated={handleComponentCreated}
      />

      {/* Webhook Creation Modal */}
      <CreateWebhookModal
        projectId={project.id}
        isOpen={isCreateWebhookOpen}
        onClose={() => setIsCreateWebhookOpen(false)}
        onCreated={handleWebhookCreated}
      />

      {/* Webhook Deliveries Modal */}
      <WebhookDeliveriesModal
        webhook={selectedWebhookForDeliveries}
        isOpen={!!selectedWebhookForDeliveries}
        onClose={() => setSelectedWebhookForDeliveries(null)}
      />
      </div>
    </div>
  );
}


