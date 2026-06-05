import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GeistMono } from "geist/font/mono";

import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const fontMono = GeistMono;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale("en");
  const t = await getTranslations({ locale: "en", namespace: "metadata" });
  return {
    title: {
      default: t("title"),
      template: "%s | youin",
    },
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
    <html lang="en" className={`${fontMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper font-sans text-ink antialiased">
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
