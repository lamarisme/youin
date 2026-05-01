export type PinStatus = "open" | "closed";

export type TeamRole = "owner" | "member";

export type CommentType = "text" | "image";

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: TeamRole;
}

export interface TeamInvite {
  id: string;
  email: string;
  invitedAt: string;
  invitedBy: string;
}

export interface PinComment {
  id: string;
  pinId: string;
  authorId: string;
  createdAt: string;
  type: CommentType;
  body?: string;
  imageUrl?: string;
}

export interface PinCapture {
  selector?: string;
  viewport?: string;
  browser?: string;
  os?: string;
  screenshotUrl?: string;
  capturedAt?: string;
}

export interface PinItem {
  id: string;
  spaceId: string;
  title: string;
  page: string;
  description: string;
  status: PinStatus;
  tagIds: string[];
  linearUrl?: string;
  assigneeId?: string;
  capture?: PinCapture;
}

export interface WorkspaceSpace {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
}

export interface WorkspaceTag {
  id: string;
  label: string;
  colorClass: string;
}

export interface Workspace {
  id: string;
  name: string;
  spaces: WorkspaceSpace[];
  tags: WorkspaceTag[];
  members: TeamMember[];
  invites: TeamInvite[];
  pins: PinItem[];
  comments: PinComment[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  title: string;
  bio: string;
  avatarUrl: string;
  timezone: string;
}
