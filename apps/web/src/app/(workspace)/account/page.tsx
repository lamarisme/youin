import type { Metadata } from "next";

import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "Account",
};

export default function AccountPage() {
  return <AccountClient />;
}
