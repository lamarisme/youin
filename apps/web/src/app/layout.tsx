import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";

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

export const metadata: Metadata = {
  title: "youin — visual feedback, on the live web",
  description:
    "Click any element on any live site. Mark a comment. Ship a ticket. Without leaving the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${figtree.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
