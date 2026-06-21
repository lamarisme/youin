import {
  BadgeCheck,
  Blocks,
  Folder,
  ShieldAlert,
  Tags,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { AccountSection } from "@/lib/workspace/routes";

export type AccountSectionCountKey =
  | "memberCount"
  | "projectCount"
  | "reviewLinkCount"
  | "labelCount"
  | "statusCount";

export interface AccountSectionConfig {
  value: AccountSection;
  label: string;
  detail: string;
  icon: LucideIcon;
  countKey?: AccountSectionCountKey;
}

export const ACCOUNT_SECTION_CONFIG: AccountSectionConfig[] = [
  {
    value: "overview",
    label: "Overview",
    detail: "Identity and defaults",
    icon: BadgeCheck,
  },
  {
    value: "team",
    label: "Team",
    detail: "Members and invites",
    icon: UsersRound,
    countKey: "memberCount",
  },
  {
    value: "projects",
    label: "Projects",
    detail: "Workspace scopes",
    icon: Folder,
    countKey: "projectCount",
  },
  {
    value: "integrations",
    label: "Integrations",
    detail: "Capture entry points",
    icon: Blocks,
    countKey: "reviewLinkCount",
  },
  {
    value: "labels",
    label: "Labels",
    detail: "Tag vocabulary",
    icon: Tags,
    countKey: "labelCount",
  },
  {
    value: "statuses",
    label: "Statuses",
    detail: "Workflow stages",
    icon: Workflow,
    countKey: "statusCount",
  },
  {
    value: "profile",
    label: "Profile",
    detail: "Display identity",
    icon: UserRound,
  },
  {
    value: "danger",
    label: "Danger Zone",
    detail: "Exit and deletion",
    icon: ShieldAlert,
  },
];
