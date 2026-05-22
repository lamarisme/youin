import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-paper text-ink">
        <div className="grid w-full gap-0 lg:grid-cols-[auto_minmax(0,1fr)]">
          <AppSidebar />
          <main className="min-h-screen min-w-0 bg-paper">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
