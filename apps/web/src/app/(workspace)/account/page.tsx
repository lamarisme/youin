"use client";

import { useCollabStore } from "@/lib/collab-store";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { OverviewTab } from "./tabs/overview-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { LabelsTab } from "./tabs/labels-tab";
import { TeamTab } from "./tabs/team-tab";

const accountTabTriggerClassName =
  "relative shrink-0 rounded-none border-0 px-3 py-2.5 text-[0.8125rem] font-medium text-ink-3 shadow-none after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-ink after:opacity-0 after:transition-opacity hover:bg-transparent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:after:opacity-100 data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

export default function AccountPage() {
  const memberCount = useCollabStore((s) => s.workspace.members.length);
  const labelCount = useCollabStore((s) => s.workspace.labels.length);

  return (
    <PageContainer className="space-y-6">
      <AppHeader title="Account" eyebrow="Settings" />

      <Tabs defaultValue="overview" className="gap-0 space-y-6">
        <TabsList
          variant="line"
          className="h-auto w-full min-w-0 flex-wrap justify-start gap-x-0.5 gap-y-0 rounded-none border-0 border-b border-rule bg-transparent p-0 text-[0.8125rem] text-ink-3 shadow-none"
        >
          <TabsTrigger value="overview" className={accountTabTriggerClassName}>
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className={cn(accountTabTriggerClassName, "data-[state=active]:[&_span]:text-ink-2")}
          >
            Team <span className="tabular-nums text-ink-3">({memberCount})</span>
          </TabsTrigger>
          <TabsTrigger
            value="labels"
            className={cn(accountTabTriggerClassName, "data-[state=active]:[&_span]:text-ink-2")}
          >
            Labels <span className="tabular-nums text-ink-3">({labelCount})</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className={accountTabTriggerClassName}>
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="team" className="mt-0 focus-visible:outline-none">
          <TeamTab />
        </TabsContent>
        <TabsContent value="labels" className="mt-0 focus-visible:outline-none">
          <LabelsTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
          <ProfileTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
