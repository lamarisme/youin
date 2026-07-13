import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { PageContainer } from "@/components/page-container";
import { ShimmerBar } from "@/components/shimmer-bar";

import { InboxListSkeleton } from "./inbox-loading";

export default function InboxLoading() {
  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[{ label: "Inbox", current: true }]}
        actions={<ShimmerBar className="h-3 w-16 rounded-sm" />}
      />
      <h1 className="sr-only">Inbox</h1>
      <InboxListSkeleton />
    </PageContainer>
  );
}
