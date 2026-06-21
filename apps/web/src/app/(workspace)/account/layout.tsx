import Link from "next/link";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { AccountReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { ShimmerBar } from "@/components/workspace-shell-skeleton";
import { accountHref } from "@/lib/workspace/routes";
import { getAccountReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

import { ACCOUNT_SECTION_CONFIG } from "./account-sections";
import { AccountShell } from "./account-client";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AccountLayoutSkeleton />}>
      <AccountLayoutData>{children}</AccountLayoutData>
    </Suspense>
  );
}

async function AccountLayoutData({
  children,
}: {
  children: React.ReactNode;
}) {
  const readModel = await getAccountReadModelForCurrentWorkspace();

  return (
    <AccountReadModelProvider initialData={readModel}>
      <AccountShell>{children}</AccountShell>
    </AccountReadModelProvider>
  );
}

function AccountLayoutSkeleton() {
  return (
    <PageContainer>
      <AppHeader
        title="Account settings"
        eyebrow="Settings"
        subtitle="Manage workspace access, capture paths, taxonomy, workflow, and your profile."
      />

      <div className="grid gap-5 lg:grid-cols-[13.5rem_minmax(0,58rem)] lg:items-start lg:gap-8 xl:grid-cols-[14rem_minmax(0,62rem)]">
        <nav
          aria-label="Account sections"
          className="-mx-3 border-y border-rule/70 bg-paper-2/70 px-3 py-2 sm:-mx-4 sm:px-4 lg:sticky lg:top-4 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
        >
          <div className="hidden px-1 pb-2 lg:block">
            <p className="text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
              Sections
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:min-w-0 lg:flex-col lg:gap-1.5">
            {ACCOUNT_SECTION_CONFIG.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.value}
                  href={accountHref(section.value)}
                  className={[
                    "group flex min-h-11 w-full shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-[background-color,color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                    "lg:min-h-12 lg:px-2.5",
                    "text-ink-2 hover:bg-paper-2/80 hover:text-ink",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-3 text-ink-3 transition-colors",
                      "group-hover:text-ink-2",
                    ].join(" ")}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui-sm font-medium">
                      {section.label}
                    </span>
                    <span className="hidden truncate text-ui-xs leading-snug text-ink-3 lg:block">
                      {section.detail}
                    </span>
                  </span>
                  {section.countKey ? <ShimmerBar className="h-4 w-5 rounded" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <section
          aria-label="Loading account settings"
          aria-busy="true"
          className="min-w-0 space-y-3 lg:border-l lg:border-rule/70 lg:pl-8"
        >
          <ShimmerBar className="h-5 w-32" />
          <ShimmerBar className="h-24 rounded-md" />
          <ShimmerBar className="h-32 rounded-md" />
        </section>
      </div>
    </PageContainer>
  );
}
