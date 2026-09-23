export type IssueType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
export type PriorityLevel = "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
// A project's own workflow status name (e.g. "TODO", or a custom "Code
// Review"). No longer a fixed union: WorkflowStatus is the source of truth.
export type IssueStatus = string;
export type SprintStatus = "FUTURE" | "ACTIVE" | "COMPLETED";
export type VersionStatus = "UNRELEASED" | "RELEASED" | "ARCHIVED";
export type WorkflowStatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

export interface WorkflowStatus {
  id: string;
  projectId: string;
  name: string;
  category: WorkflowStatusCategory;
  isBacklog: boolean;
  color: string;
  order: number;
  wipLimit: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface WorkflowTransition {
  id: string;
  projectId: string;
  fromId: string;
  toId: string;
  createdAt: string | Date;
}

export interface User {
  id: string;
  name: string;
  /**
   * Absent wherever a user appears beside content (assignee, reporter, comment
   * author), and blank for callers who are not on the project's team.
   */
  email?: string;
  avatarUrl: string | null;
  role: string;
  canCreateProjects?: boolean;
  isInstanceAdmin?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  issueId: string;
  authorId: string;
  author: User;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ActivityLog {
  id: string;
  issueId: string;
  userId: string;
  user?: User | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string | Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string | Date;
}

export interface Version {
  id: string;
  name: string;
  description: string | null;
  status: VersionStatus;
  startDate: string | Date | null;
  releaseDate: string | Date | null;
  projectId: string;
  project?: Project | null;
  issues?: Issue[];
  issueCount?: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    storyPoints: number;
    completedStoryPoints: number;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Issue {
  id: string;
  key: string;
  title: string;
  description: string | null;
  type: IssueType;
  priority: PriorityLevel;
  status: IssueStatus;
  order: number;
  storyPoints: number | null;
  originalEstimateSeconds: number | null;
  remainingEstimateSeconds: number | null;
  startDate: string | Date | null;
  dueDate: string | Date | null;
  projectId: string;
  project?: Project | null;
  sprintId: string | null;
  sprint?: Sprint | null;
  versionId?: string | null;
  version?: Version | null;
  assigneeId: string | null;
  assignee?: User | null;
  reporterId: string | null;
  reporter?: User | null;
  parentId: string | null;
  parent?: {
    id: string;
    key: string;
    title: string;
    type: IssueType;
  } | null;
  children?: any[];
  comments?: any[];
  activityLogs?: any[];
  /** How many exist in total; the arrays above hold only the latest page. */
  _count?: { comments: number; activityLogs: number };
  customFieldValues?: CustomFieldValue[];
  linksAsSource?: IssueLink[];
  linksAsTarget?: IssueLink[];
  labels?: IssueLabel[];
  watchers?: Watcher[];
  attachments?: Attachment[];
  components?: IssueComponent[];
  worklogs?: Worklog[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** The other issue's identity as shown in a link row: enough to badge and link to it. */
export interface LinkedIssueSummary {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  status: IssueStatus;
  projectId: string;
  project?: { key: string; name: string } | null;
  /** The color of `status` in this issue's own project, which may not be the one being viewed. */
  statusColor?: string;
}

/** Stored once from the source's perspective; each side derives its own label from `type`. */
export interface IssueLink {
  id: string;
  type: string;
  source?: LinkedIssueSummary;
  target?: LinkedIssueSummary;
  createdAt: string | Date;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  createdAt: string | Date;
}

/** The join row an issue's `labels` array holds; `label` is the tag itself. */
export interface IssueLabel {
  id: string;
  issueId: string;
  labelId: string;
  label: Label;
}

export interface Component {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  leadId: string | null;
  lead?: User | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: { issues: number };
}

/** The join row an issue's `components` array holds; `component` is the tag itself. */
export interface IssueComponent {
  id: string;
  issueId: string;
  componentId: string;
  component: Component;
}

export interface Worklog {
  id: string;
  issueId: string;
  authorId: string;
  author: User;
  timeSpentSeconds: number;
  description: string | null;
  workDate: string | Date;
  createdAt: string | Date;
}

export interface Attachment {
  id: string;
  issueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  uploadedBy: User;
  createdAt: string | Date;
}

/** An opt-in subscription to notifications for an issue. */
export interface Watcher {
  id: string;
  issueId: string;
  userId: string;
  user: User;
  createdAt: string | Date;
}

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTI_SELECT"
  | "CHECKBOX"
  | "DATE"
  | "URL";

export interface CustomField {
  id: string;
  name: string;
  description: string | null;
  type: CustomFieldType;
  options: string | null;
  required: boolean;
  projectId: string;
  project?: Project | null;
  values?: CustomFieldValue[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CustomFieldValue {
  id: string;
  issueId: string;
  customFieldId: string;
  customField?: CustomField;
  value: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | Date | null;
  endDate: string | Date | null;
  projectId: string;
  issues?: Issue[];
}

export type BuiltInRole = "ADMIN" | "MEMBER" | "VIEWER";
export type ProjectRole = BuiltInRole | string;

export type ProjectPermission =
  | "PROJECT_ADMIN"
  | "MANAGE_ACCESS"
  | "MANAGE_SPRINTS"
  | "MANAGE_VERSIONS"
  | "CREATE_ISSUE"
  | "EDIT_ISSUE"
  | "DELETE_ISSUE"
  | "MOVE_ISSUE"
  | "ADD_COMMENT"
  | "VIEW_PROJECT";

export interface CustomRole {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string;
  permissions: ProjectPermission[];
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    members: number;
  };
}

export interface ProjectMember {
  id: string;
  projectId: string;
  project?: Project;
  userId: string;
  user: User;
  role: ProjectRole;
  customRoleId?: string | null;
  customRole?: CustomRole | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type BoardType = "SCRUM" | "KANBAN";

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  boardType: BoardType;
  /** When true, visitors with no session get read-only access. */
  allowAnonymousViewers?: boolean;
  leadId: string | null;
  lead?: User | null;
  members?: ProjectMember[];
  customRoles?: CustomRole[];
  issues?: Issue[];
  sprints?: Sprint[];
  versions?: Version[];
  customFields?: CustomField[];
  webhooks?: Webhook[];
}

export interface PersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  lastFour: string;
  userId: string;
  expiresAt: string | Date | null;
  lastUsedAt: string | Date | null;
  revokedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: User;
}

export interface CreateTokenResult {
  success: boolean;
  token?: string;
  tokenData?: PersonalAccessToken;
  error?: string;
}

export type WebhookEvent =
  // Issue Events
  | "issue:created"
  | "issue:updated"
  | "issue:deleted"
  | "issue:transitioned"
  | "issue:assigned"
  | "issue:priority_changed"
  | "issue:linked"
  | "issue:unlinked"
  // Comment Events
  | "comment:created"
  | "comment:updated"
  | "comment:deleted"
  // Attachment Events
  | "attachment:created"
  | "attachment:deleted"
  // Worklog Events
  | "worklog:created"
  | "worklog:deleted"
  // Sprint Events
  | "sprint:created"
  | "sprint:started"
  | "sprint:updated"
  | "sprint:completed"
  | "sprint:deleted"
  // Version / Release Events
  | "version:created"
  | "version:updated"
  | "version:released"
  | "version:archived"
  | "version:deleted"
  // System Events
  | "webhook:test";

export interface WebhookActor {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface WebhookChangelogItem {
  field: string;
  fieldId?: string;
  from?: string | null;
  fromString?: string | null;
  to?: string | null;
  toString?: string | null;
}

export interface WebhookPayload<T = any> {
  event: WebhookEvent;
  timestamp: string;
  projectId: string | null;
  actor?: WebhookActor | null;
  changelog?: WebhookChangelogItem[] | null;
  data: T;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string; // JSON array of WebhookEvent
  enabled: boolean;
  projectId: string | null;
  jqlFilter?: string | null;
  project?: Project | null;
  deliveries?: WebhookDelivery[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  webhook?: Webhook;
  event: string;
  url: string;
  status: number;
  success: boolean;
  durationMs: number;
  requestPayload: string;
  responseBody: string | null;
  error: string | null;
  createdAt: string | Date;
}



