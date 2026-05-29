import type { Metadata } from "next";

import { ViewsClient } from "./views-client";

export const metadata: Metadata = {
  title: "Saved views",
};

export default function ViewsPage() {
  return <ViewsClient />;
}
