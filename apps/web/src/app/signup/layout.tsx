import type { ReactNode } from "react";
import type { Metadata } from "next";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
