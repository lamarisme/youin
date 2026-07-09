"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Code2,
  Package,
  Puzzle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { accountHref } from "@/lib/workspace/routes";

type IntegrationSurface = {
  title: string;
  status: "Available" | "Planned";
  description: string;
  detail: string;
  icon: LucideIcon;
  action?: ReactNode;
};

export function IntegrationsTab() {
  const { reviewLinkCount, workspaceName } = useWorkspaceData((s) => ({
    reviewLinkCount: s.workspace.reviewLinks.length,
    workspaceName: s.workspace.name,
  }));
  const reviewLinkLabel =
    reviewLinkCount === 1 ? "1 review link" : `${reviewLinkCount} review links`;

  const surfaces: IntegrationSurface[] = [
    {
      title: "Chrome extension",
      status: "Available",
      description: "The fastest capture path for teams reviewing any web app, staging site, or client page.",
      detail: "No app code required.",
      icon: Puzzle,
    },
    {
      title: "Guest review script",
      status: "Available",
      description: "A tiny script for controlled staging or client review sessions without a YouIn account.",
      detail: reviewLinkLabel,
      icon: Code2,
      action: (
        <Link
          href={`${accountHref("team")}#guest-review-links`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-ui-sm font-medium text-mark transition-colors hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Code2 className="size-3.5" />
          Manage links
        </Link>
      ),
    },
    {
      title: "Hosted app script",
      status: "Planned",
      description: "A first-party snippet for product teams that want YouIn inside their own app without browser extension permissions.",
      detail: "App-native capture path.",
      icon: Code2,
    },
    {
      title: "React package",
      status: "Planned",
      description: "A typed package for teams that want deeper control over identity, route context, and UI entry points.",
      detail: "Package API and provider.",
      icon: Package,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <ProductSectionHeader
          title="Integrations"
          description={`Choose how marks enter ${workspaceName || "this workspace"}. Chrome stays the quickest path; script and package surfaces are the app-native direction for teams that do not want extension-based capture.`}
        />

        <ProductList>
          {surfaces.map((surface) => {
            const Icon = surface.icon;
            return (
              <ProductListItem
                key={surface.title}
                interactive={false}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-2">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ui-sm font-medium text-ink">{surface.title}</p>
                      <Badge
                        variant="outline"
                        className={
                          surface.status === "Available"
                            ? "text-ui-2xs text-ok"
                            : "text-ui-2xs text-ink-3"
                        }
                      >
                        {surface.status}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-[60ch] text-ui-xs leading-relaxed text-ink-3">
                      {surface.description}
                    </p>
                    <p className="mt-1 font-mono text-ui-2xs uppercase tracking-[0.08em] text-ink-3">
                      {surface.detail}
                    </p>
                  </div>
                </div>
                {surface.action ? <div className="sm:justify-self-end">{surface.action}</div> : null}
              </ProductListItem>
            );
          })}
        </ProductList>
      </section>

    </div>
  );
}
