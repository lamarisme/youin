import type { ReactNode } from "react";
import type { Metadata } from "next";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
