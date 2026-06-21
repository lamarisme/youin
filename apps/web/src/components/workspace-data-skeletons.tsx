import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { PageContainer } from "@/components/page-container";
import { ProductList, ProductListItem } from "@/components/product-list";
import { Button } from "@/components/ui/button";
import { ShimmerBar } from "@/components/workspace-shell-skeleton";
import { cn } from "@/lib/utils";

export function DashboardPageDataSkeleton() {
  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[{ label: "Triage", current: true }]}
        actions={
          <Button size="sm" variant="mark" disabled className="h-7 gap-1.5 rounded-md px-2 text-ui-sm">
            New mark
          </Button>
        }
      />
      <div className="space-y-3" aria-label="Loading dashboard data" aria-busy="true">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <ShimmerBar key={index} className="h-8 w-24 rounded-md" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 rounded-md bg-paper-2 p-2">
          <ShimmerBar className="h-8 w-36" />
          <ShimmerBar className="h-8 w-28" />
          <ShimmerBar className="h-8 w-32" />
          <ShimmerBar className="h-8 w-40" />
        </div>
        <DataRowsSkeleton rows={7} />
      </div>
    </PageContainer>
  );
}

export function InboxPageDataSkeleton() {
  return (
    <PageContainer>
      <BreadcrumbHeader items={[{ label: "Inbox", current: true }]} />
      <DataRowsSkeleton label="Loading inbox data" rows={4} dot />
    </PageContainer>
  );
}

export function ViewsIndexDataSkeleton() {
  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[{ label: "Saved views", current: true }]}
        actions={
          <Button type="button" size="sm" disabled className="h-7 gap-1.5 rounded-md px-2">
            New view
          </Button>
        }
      />
      <DataRowsSkeleton label="Loading saved views" rows={3} />
      <section className="overflow-hidden rounded-md bg-paper-elevated">
        <div className="border-b border-rule/70 px-3 py-2">
          <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
            View templates
          </p>
        </div>
        <div className="divide-y divide-rule/70">
          <StaticTemplateRow title="List" description="A focused table for sorting, searching, and triage." />
          <StaticTemplateRow title="Board" description="Open and closed marks grouped into workflow columns." />
        </div>
      </section>
    </PageContainer>
  );
}

export function ViewDetailDataSkeleton() {
  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[
          { label: "Saved views", href: "/views" },
          { label: "Loading view", current: true },
        ]}
      />
      <section className="space-y-3 rounded-md bg-paper-2 p-2.5" aria-label="Loading view data" aria-busy="true">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ShimmerBar className="size-8 shrink-0" />
          <ShimmerBar className="h-10 flex-1 sm:h-8" />
          <ShimmerBar className="h-6 w-16" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ShimmerBar className="h-8 w-32" />
          <ShimmerBar className="h-8 w-36" />
          <ShimmerBar className="h-8 w-28" />
        </div>
      </section>
      <div className="flex flex-wrap gap-2 rounded-md bg-paper-2 p-2">
        <ShimmerBar className="h-8 w-36" />
        <ShimmerBar className="h-8 w-28" />
        <ShimmerBar className="h-8 w-32" />
      </div>
      <DataRowsSkeleton rows={6} />
    </PageContainer>
  );
}

export function DataRowsSkeleton({
  label = "Loading data",
  rows = 5,
  dot = false,
}: {
  label?: string;
  rows?: number;
  dot?: boolean;
}) {
  return (
    <ProductList aria-label={label} aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <ProductListItem key={index} interactive={false} className="flex items-start gap-3 px-4 py-3">
          {dot ? <span className="mt-2 size-2 shrink-0 rounded-full bg-paper-3" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBar className={cn("h-3.5 rounded-sm", index % 2 === 0 ? "w-2/3" : "w-1/2")} />
            <ShimmerBar className="h-3 w-5/6 rounded-sm bg-paper-2" />
          </div>
          <ShimmerBar className="mt-1 h-3 w-14 rounded-sm bg-paper-2" />
        </ProductListItem>
      ))}
    </ProductList>
  );
}

function StaticTemplateRow({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3">
        <ShimmerBar className="size-4 rounded-sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-ui-xs text-ink-3">{description}</span>
      </span>
    </div>
  );
}
