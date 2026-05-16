import type { Metadata } from "next";

import SpacesClient from "./spaces-client";

export const metadata: Metadata = {
  title: "Spaces",
};

export default function SpacesPage() {
  return <SpacesClient />;
}
