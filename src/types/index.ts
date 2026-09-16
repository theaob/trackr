export type IssueType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
export type PriorityLevel = "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
export type IssueStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type SprintStatus = "FUTURE" | "ACTIVE" | "COMPLETED";
export type VersionStatus = "UNRELEASED" | "RELEASED" | "ARCHIVED";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
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
  customFieldValues?: CustomFieldValue[];
  createdAt: string | Date;
  updatedAt: string | Date;
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

export type ProjectRole = "ADMIN" | "MEMBER" | "VIEWER";

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

export interface ProjectMember {
  id: string;
  projectId: string;
  project?: Project;
  userId: string;
  user: User;
  role: ProjectRole;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  category: string;
  leadId: string | null;
  lead?: User | null;
  members?: ProjectMember[];
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
  | "issue:created"
  | "issue:updated"
  | "issue:deleted"
  | "comment:created"
  | "sprint:started"
  | "sprint:completed"
  | "version:released"
  | "webhook:test";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string; // JSON array of WebhookEvent
  enabled: boolean;
  projectId: string | null;
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



