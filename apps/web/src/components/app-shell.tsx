import { AppSidebar } from "@/components/app-sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-paper">
        <div className="grid w-full gap-0 lg:grid-cols-[auto_1fr]">
          <AppSidebar />
          <main className="min-h-screen py-4 sm:py-5">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
