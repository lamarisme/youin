import type { Metadata } from "next";

import SpacesClient from "../spaces-client";

export const metadata: Metadata = {
  title: "Space",
};

export default async function SpacePage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <SpacesClient spaceParam={space} />;
}
