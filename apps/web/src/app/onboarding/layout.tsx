import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export const metadata: Metadata = {
  title: "Set up workspace",
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
