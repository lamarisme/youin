import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Views",
};

export default function AnalyticsPage() {
  redirect("/views");
}
