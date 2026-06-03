"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { WorkspaceMainSkeleton } from "@/components/workspace-shell-skeleton";

export function DashboardUrlNormalizer({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <WorkspaceMainSkeleton id="Loading dashboard" />;
}
