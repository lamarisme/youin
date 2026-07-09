import type { Metadata } from "next";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export const metadata: Metadata = {
  title: "Set up workspace",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
