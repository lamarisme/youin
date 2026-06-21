import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <AppShellFrame sidebar={<AppSidebar />}>{children}</AppShellFrame>;
}

export function AppShellFrame({
  sidebar,
  children,
}: AppShellProps & {
  sidebar: React.ReactNode;
}) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-paper-2 text-ink">
        <div className="grid w-full gap-0 lg:grid-cols-[auto_minmax(0,1fr)]">
          {sidebar}
          <main className="min-h-screen min-w-0 bg-paper-2 p-1.5 sm:p-2 lg:pl-0">
            <div className="min-h-[calc(100vh-0.75rem)] overflow-hidden rounded-lg bg-paper sm:min-h-[calc(100vh-1rem)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
