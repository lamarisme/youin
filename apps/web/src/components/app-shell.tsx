import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-paper">
        <div className="grid w-full gap-0 lg:grid-cols-[240px_1fr]">
          <AppSidebar />
          <main className="page-y min-h-screen">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
