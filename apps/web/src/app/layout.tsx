import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? routing.defaultLocale;

  return (
    <html
      lang={locale}
      className={`${bricolage.variable} ${figtree.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <ThemeProvider>
          <QueryProvider>
            <NuqsAdapter>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </NuqsAdapter>
          </QueryProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
