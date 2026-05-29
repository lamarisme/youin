import type { Metadata } from "next";

import { ViewDetailClient } from "../view-detail-client";

export const metadata: Metadata = {
  title: "Workspace view",
};

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return <ViewDetailClient viewId={view} />;
}
