import type { Metadata } from "next";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
