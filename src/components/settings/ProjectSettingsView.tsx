"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Project, User, CustomField, Webhook, ProjectMember, BoardType, WorkflowStatus, WorkflowTransition, Component, CustomRole } from "@/types";
import { updateProject } from "@/lib/actions/projects";
import { deleteCustomField } from "@/lib/actions/customFields";
import { deleteComponent } from "@/lib/actions/components";
import {
  deleteWebhook,
  updateWebhook,
  testWebhook,
} from "@/lib/actions/webhooks";
import {
  Globe,
  Lock,
  Sliders,
  Plus,
  Trash2,
  AlertCircle,
  Asterisk,
  Webhook as WebhookIcon,
  Send,
  History,
  Loader2,
  ShieldAlert,
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
import SaveBar from "./SaveBar";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
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
  initialCustomRoles?: CustomRole[];
  initialWorkflowStatuses?: WorkflowStatus[];
  initialWorkflowTransitions?: WorkflowTransition[];
  initialComponents?: Component[];
  /** The section to open, from ?section= in the address. */
  initialSection?: string;
}

export type SettingsSection = "general" | "components" | "fields" | "members" | "roles" | "visibility" | "workflow" | "webhooks";

const SECTION_GROUPS: { label: string; sections: { id: SettingsSection; label: string }[] }[] = [
  {
    label: "Project",
    sections: [
      { id: "general", label: "Details" },
      { id: "components", label: "Components" },
      { id: "fields", label: "Custom fields" },
    ],
  },
  {
    label: "Access",
    sections: [
      { id: "members", label: "Members" },
      { id: "roles", label: "Roles" },
      { id: "visibility", label: "Visibility" },
    ],
  },
  { label: "Process", sections: [{ id: "workflow", label: "Workflow" }] },
  { label: "Integrations", sections: [{ id: "webhooks", label: "Webhooks" }] },
];
const SECTION_IDS = SECTION_GROUPS.flatMap((g) => g.sections.map((x) => x.id));

export default function ProjectSettingsView({
  project,
  users,
  initialCustomFields = [],
  initialWebhooks = [],
  initialMembers = [],
  initialCustomRoles = [],
  initialWorkflowStatuses = [],
  initialWorkflowTransitions = [],
  initialComponents = [],
  initialSection,
}: ProjectSettingsViewProps) {
  const [section, setSectionState] = useState<SettingsSection>(
    SECTION_IDS.includes(initialSection as SettingsSection) ? (initialSection as SettingsSection) : "general"
  );
  // The address keeps the open section, so a link or reload comes back to it.
  const setSection = (next: SettingsSection) => {
    setSectionState(next);
    const url = new URL(window.location.href);
    if (next === "general") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState(window.history.state, "", url);
  };
  const { toast } = useToast();
  const router = useRouter();
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const permissions = useProjectPermissions(project, members, initialCustomRoles);

  // General Settings State
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [boardType, setBoardType] = useState<BoardType>(project.boardType || "SCRUM");
  const [allowAnonymousViewers, setAllowAnonymousViewers] = useState(
    !!project.allowAnonymousViewers
  );
  const [saved, setSaved] = useState({
    name: project.name,
    description: project.description || "",
    boardType: (project.boardType || "SCRUM") as BoardType,
    allowAnonymousViewers: !!project.allowAnonymousViewers,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const generalDirty = name !== saved.name || description !== saved.description || boardType !== saved.boardType;
  const visibilityDirty = allowAnonymousViewers !== saved.allowAnonymousViewers;

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


  // Each section saves only what it shows; the rest goes back as it was saved.
  const save = async (e: React.FormEvent, part: "general" | "visibility") => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    const next =
      part === "general"
        ? { ...saved, name: name.trim(), description: description.trim(), boardType }
        : { ...saved, allowAnonymousViewers };
    const res = await updateProject(project.id, next);
    setIsSaving(false);
    if (res.success) {
      setSaved(next);
      setName(next.name);
      setDescription(next.description);
      toast({ title: "Changes saved", tone: "success" });
      router.refresh();
    } else {
      setSaveError(res.error || "Couldn't save the changes.");
    }
  };

  const discard = () => {
    setName(saved.name);
    setDescription(saved.description);
    setBoardType(saved.boardType);
    setAllowAnonymousViewers(saved.allowAnonymousViewers);
    setSaveError(null);
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


  const SECTION_COUNTS: Partial<Record<SettingsSection, number>> = {
    components: components.length,
    fields: customFields.length,
    members: members.length,
    workflow: initialWorkflowStatuses.length,
    webhooks: webhooks.length,
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 bg-surface">
      {/* Mobile Notice: Administrative features are desktop-only */}
      <div className="md:hidden flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-warning-soft border border-warning/30 flex items-center justify-center text-warning shadow-2xs mb-4">
          <Monitor className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-ink mb-1.5">
          Desktop Only Feature
        </h2>
        <p className="text-xs text-ink-2 max-w-sm mb-6 leading-relaxed">
          Administrative features (project configuration, workflows, state transition graphs, access control, custom fields, and webhooks) are designed for desktop screens.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <Link prefetch={false}
            href={`/projects/${project.key}/board`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Kanban className="w-4 h-4" />
            <span>Back to Board</span>
          </Link>
          <Link prefetch={false}
            href={`/projects/${project.key}/issues`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-sunk hover:bg-subtle text-ink border border-subtle rounded-md text-xs font-semibold transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            <span>Back to Issues</span>
          </Link>
        </div>
      </div>

      {/* Desktop Settings Layout */}
      <div className="hidden md:block space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">Project settings</h1>
          <p className="mt-0.5 text-xs text-muted">{project.name}</p>
        </header>

        <div className="grid grid-cols-[12rem_minmax(0,1fr)] gap-8">
          <nav aria-label="Project settings" className="space-y-5">
            {SECTION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.sections.map((item) => {
                    const count = SECTION_COUNTS[item.id];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={section === item.id ? "page" : undefined}
                          onClick={() => setSection(item.id)}
                          className={cn(
                            "flex h-8 w-full items-center justify-between rounded-control px-2.5 text-left text-[13px] transition-colors",
                            section === item.id ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-sunk hover:text-ink"
                          )}
                        >
                          {item.label}
                          {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="min-w-0 max-w-4xl">
      {permissions.isViewer && (
        <p className="mb-5 flex items-start gap-2 rounded-card border border-subtle bg-warning-soft px-3 py-2.5 text-xs text-ink">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          You can look at these settings but not change them. Ask a project administrator.
        </p>
      )}

      {section === "general" && (
        <form id="settings-general" onSubmit={(e) => save(e, "general")} className="space-y-6">
          <SectionHeading title="Details" description="The project's name, description and how its board works." />
          {saveError && (
            <p role="alert" className="flex items-center gap-2 rounded-card bg-danger-soft px-3 py-2 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {saveError}
            </p>
          )}
          <div className="grid max-w-xl gap-5">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!permissions.canManageProject} />
            </Field>
            <Field label="Key" hint={`The prefix of every issue key, as in ${project.key}-1. It can't be changed.`}>
              <Input value={project.key} disabled className="font-mono" />
            </Field>
            <Field label="Description">
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!permissions.canManageProject} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">Lead</span>
              <span className="flex h-8 items-center gap-2 text-[13px] text-ink">
                {project.lead && <UserAvatar user={project.lead} size="xs" />}
                {project.lead?.name || "None"}
              </span>
            </div>
          </div>
          <fieldset className="max-w-xl">
            <legend className="text-xs font-medium text-ink-2">Board type</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {(
                [
                  { value: "SCRUM" as BoardType, title: "Scrum", description: "Plan sprints in the backlog. The board shows the active sprint." },
                  { value: "KANBAN" as BoardType, title: "Kanban", description: "No sprints. The board shows every issue taken out of the backlog." },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "cursor-pointer rounded-card border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                    boardType === option.value ? "border-accent bg-accent-soft" : "border-subtle bg-surface hover:border-strong",
                    !permissions.canManageProject && "cursor-not-allowed opacity-70"
                  )}
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
                  <span className="block text-[13px] font-medium text-ink">{option.title}</span>
                  <span className="mt-1 block text-xs text-ink-2">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <SaveBar dirty={generalDirty} saving={isSaving} form="settings-general" onDiscard={discard} />
        </form>
      )}

      {section === "visibility" && (
        <form id="settings-visibility" onSubmit={(e) => save(e, "visibility")} className="space-y-6">
          <SectionHeading title="Visibility" description="Who can see this project without being a member." />
          {saveError && (
            <p role="alert" className="flex items-center gap-2 rounded-card bg-danger-soft px-3 py-2 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {saveError}
            </p>
          )}
          <label className={cn("flex max-w-xl cursor-pointer items-start gap-3 rounded-card border p-4", allowAnonymousViewers ? "border-warning bg-warning-soft" : "border-subtle bg-surface")}>
            <input
              type="checkbox"
              checked={allowAnonymousViewers}
              disabled={!permissions.canManageProject}
              onChange={(e) => setAllowAnonymousViewers(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--color-accent))] disabled:cursor-not-allowed"
            />
            <span>
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                {allowAnonymousViewers ? <Globe className="h-4 w-4 text-warning" aria-hidden="true" /> : <Lock className="h-4 w-4 text-ink-2" aria-hidden="true" />}
                Anyone with the link can view this project, without signing in
              </span>
              <span className="mt-1 block text-xs text-ink-2">
                Visitors get the Viewer role: they can read the board, backlog, issues and releases, and change nothing. Members&rsquo; email addresses stay hidden.
              </span>
              {allowAnonymousViewers && <span className="mt-2 block text-xs font-medium text-ink">This project is public: every issue in it can be read by anyone with the link.</span>}
            </span>
          </label>
          <SaveBar dirty={visibilityDirty} saving={isSaving} form="settings-visibility" onDiscard={discard} />
        </form>
      )}

      {/* Tab 2: Custom Fields */}
      {section === "fields" && (
        <div className=" space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Custom fields</h2>
              <p className="text-xs text-muted mt-0.5">
                Extend issues in {project.name} with custom attributes, dropdown lists, numbers, and flags.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Field
              </button>
            )}
          </div>

          {customFields.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-subtle rounded-lg bg-page">
              <Sliders className="w-8 h-8 text-muted mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink">No custom fields yet</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                Add specialized metadata to your issues such as Environment, Customer Tier, Target Release, or Estimated Hours.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Custom Field
              </button>
            </div>
          ) : (
            <div className="border border-subtle rounded-lg overflow-x-auto bg-surface shadow-2xs">
              <table className="min-w-full divide-y divide-subtle text-left text-xs">
                <thead className="bg-page font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Field Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Options / Schema</th>
                    <th className="px-4 py-3">Required</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle text-ink">
                  {customFields.map((f) => {
                    const options = parseFieldOptions(f.options);
                    return (
                      <tr key={f.id} className="hover:bg-page/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <CustomFieldIcon type={f.type} />
                            {f.name}
                          </div>
                          {f.description && (
                            <div className="text-[11px] text-muted mt-0.5 max-w-xs truncate">
                              {f.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-sunk text-ink-2 border border-subtle">
                            {f.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {options.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {options.slice(0, 3).map((opt, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 bg-surface-sunk text-ink-2 rounded border border-subtle font-mono"
                                >
                                  {opt}
                                </span>
                              ))}
                              {options.length > 3 && (
                                <span className="text-[10px] text-muted self-center">
                                  +{options.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted italic text-[11px]">Freeform</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {f.required ? (
                            <span className="inline-flex items-center gap-0.5 text-danger font-semibold text-[11px]">
                              <Asterisk className="w-2.5 h-2.5" />
                              Required
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={deletingFieldId === f.id}
                            onClick={() => handleDeleteField(f.id, f.name)}
                            className="text-muted hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors disabled:opacity-50"
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
      {section === "components" && (
        <div className=" space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Components</h2>
              <p className="text-xs text-muted mt-0.5">
                Sub-teams or subsystems within {project.name} (e.g. Backend API, Mobile App). Issues pick
                from this list &mdash; members can&apos;t create a new one from the issue view.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateComponentOpen(true)}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Component
              </button>
            )}
          </div>

          {components.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-subtle rounded-lg bg-page">
              <Boxes className="w-8 h-8 text-muted mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink">No components yet</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                Group issues by the part of the system they belong to, with an optional owner for each.
              </p>
              {permissions.canManageProject && (
                <button
                  type="button"
                  onClick={() => setIsCreateComponentOpen(true)}
                  className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Your First Component
                </button>
              )}
            </div>
          ) : (
            <div className="border border-subtle rounded-lg overflow-x-auto bg-surface shadow-2xs">
              <table className="min-w-full divide-y divide-subtle text-left text-xs">
                <thead className="bg-page font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle text-ink">
                  {components.map((c) => (
                    <tr key={c.id} className="hover:bg-page/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-accent" />
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="text-[11px] text-muted mt-0.5 max-w-xs truncate">
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
                          <span className="text-muted italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{c._count?.issues ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        {permissions.canManageProject && (
                          <button
                            type="button"
                            disabled={deletingComponentId === c.id}
                            onClick={() => handleDeleteComponent(c.id, c.name)}
                            className="text-muted hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors disabled:opacity-50"
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
      {section === "webhooks" && (
        <div className=" space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Webhooks</h2>
              <p className="text-xs text-muted mt-0.5">
                Trigger real-time HTTP POST notifications to Slack, Discord, CI/CD, or internal tools when events occur.
              </p>
            </div>
            {permissions.canManageProject && (
              <button
                type="button"
                onClick={() => setIsCreateWebhookOpen(true)}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Webhook
              </button>
            )}
          </div>

          {webhooks.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-subtle rounded-lg bg-page">
              <WebhookIcon className="w-8 h-8 text-muted mx-auto mb-2" />
              <h3 className="text-sm font-bold text-ink">No webhooks configured</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                Connect external systems like automated CI/CD runners, notification channels, or analytics pipelines.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateWebhookOpen(true)}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Webhook
              </button>
            </div>
          ) : (
            <div className="border border-subtle rounded-lg overflow-x-auto bg-surface shadow-2xs">
              <table className="min-w-full divide-y divide-subtle text-left text-xs">
                <thead className="bg-page font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Webhook Name & Endpoint</th>
                    <th className="px-4 py-3">Subscribed Events</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle text-ink">
                  {webhooks.map((wh) => {
                    let eventsList: string[] = [];
                    try {
                      eventsList = JSON.parse(wh.events);
                    } catch {}

                    const isTesting = testingWebhookId === wh.id;
                    const result = testResult?.webhookId === wh.id ? testResult : null;

                    return (
                      <tr key={wh.id} className="hover:bg-page/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
                            <WebhookIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span>{wh.name}</span>
                            {wh.secret && (
                              <span className="text-[10px] text-muted font-normal px-1.5 py-px bg-surface-sunk rounded border border-subtle">
                                HMAC Signed
                              </span>
                            )}
                            {wh.jqlFilter && (
                              <span
                                className="text-[10px] text-accent font-mono px-1.5 py-px bg-accent-soft/60 rounded border border-accent/30 max-w-[220px] truncate"
                                title={`TQL filter: ${wh.jqlFilter}`}
                              >
                                TQL: {wh.jqlFilter}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-muted mt-0.5 max-w-sm truncate">
                            {wh.url}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {eventsList.slice(0, 4).map((evt, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 bg-surface-sunk text-ink-2 rounded border border-subtle font-mono"
                              >
                                {evt}
                              </span>
                            ))}
                            {eventsList.length > 4 && (
                              <span className="text-[10px] text-muted self-center">
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
                                ? "bg-success-soft text-success border border-success/30 hover:bg-success-soft"
                                : "bg-surface-sunk text-ink-2 border border-subtle hover:bg-subtle"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${wh.enabled ? "bg-success" : "bg-strong"}`} />
                            {wh.enabled ? "Active" : "Paused"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {result && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded animate-in fade-in ${
                                  result.success
                                    ? "bg-success-soft text-success"
                                    : "bg-danger-soft text-danger"
                                }`}
                              >
                                {result.success ? `HTTP ${result.status} (${result.durationMs}ms)` : `Failed (${result.status})`}
                              </span>
                            )}

                            <button
                              type="button"
                              disabled={isTesting}
                              onClick={() => handleTestPing(wh)}
                              className="text-xs px-2.5 py-1 rounded bg-surface-sunk text-ink hover:bg-subtle font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                              title="Send test ping"
                            >
                              {isTesting ? (
                                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                              ) : (
                                <Send className="w-3 h-3 text-accent" />
                              )}
                              <span>Test Ping</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedWebhookForDeliveries(wh)}
                              className="text-xs px-2.5 py-1 rounded bg-surface-sunk text-ink hover:bg-subtle font-semibold inline-flex items-center gap-1 transition-colors"
                              title="View delivery history"
                            >
                              <History className="w-3 h-3 text-ink-2" />
                              <span>Deliveries</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWebhook(wh.id, wh.name)}
                              className="text-muted hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors"
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

      {(section === "members" || section === "roles") && (
        <div className="space-y-5">
          <SectionHeading
            title={section === "members" ? "Members" : "Roles"}
            description={section === "members" ? "The people in this project and the role each one has." : "What each role lets its members do."}
          />
          <ProjectAccessTab
            project={project}
            section={section}
            initialMembers={members}
            initialCustomRoles={initialCustomRoles}
            allOrgUsers={users}
            currentUserRole={permissions.role}
            isProjectLead={permissions.isLead}
            onMembersChange={setMembers}
          />
        </div>
      )}

      {/* Tab 5: Workflow */}
      {section === "workflow" && (
        <div className="space-y-5">
          <SectionHeading title="Workflow" description="The statuses issues move through, and which moves are allowed." />
          <WorkflowSettingsTab
            project={project}
            initialStatuses={initialWorkflowStatuses}
            initialTransitions={initialWorkflowTransitions}
            canManage={permissions.canManageProject}
          />
        </div>
      )}

          </div>
        </div>

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



function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
    </div>
  );
}
