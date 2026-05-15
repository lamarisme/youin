import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

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

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale("en");
  const t = await getTranslations({ locale: "en", namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  setRequestLocale("en");
  const messages = await getMessages();

  return (
    <html
      lang="en"
      className={`${bricolage.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <QueryProvider>
              <NuqsAdapter>
                <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
              </NuqsAdapter>
            </QueryProvider>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
