import type { Metadata } from "next";

import { OverviewTab } from "./tabs/overview-tab";

export const metadata: Metadata = {
  title: "Account settings",
};

export default function AccountPage() {
  return <OverviewTab />;
}
