import type { ReactNode } from "react";

import { AuthShellLayout } from "@/components/auth-shell-layout";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthShellLayout>{children}</AuthShellLayout>;
}
