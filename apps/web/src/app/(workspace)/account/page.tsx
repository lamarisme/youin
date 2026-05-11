"use client";

import { useCollabStore } from "@/lib/collab-store";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OverviewTab } from "./tabs/overview-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { LabelsTab } from "./tabs/labels-tab";
import { TeamTab } from "./tabs/team-tab";

export default function AccountPage() {
  const memberCount = useCollabStore((s) => s.workspace.members.length);
  const labelCount = useCollabStore((s) => s.workspace.labels.length);

  return (
    <PageContainer>
      <AppHeader
        title="Account"
        eyebrow="Settings"
        subtitle="Manage your workspace, team, and profile."
      />

      <Tabs defaultValue="overview" className="space-y-7">
        <TabsList className="rounded-xl border border-rule bg-paper-2 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team ({memberCount})</TabsTrigger>
          <TabsTrigger value="labels">Labels ({labelCount})</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <TeamTab />
        </TabsContent>
        <TabsContent value="labels" className="mt-0">
          <LabelsTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-0">
          <ProfileTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
