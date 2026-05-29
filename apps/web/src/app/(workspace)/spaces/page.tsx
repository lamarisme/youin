import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Projects",
};

export default function SpacesPage() {
  redirect("/dashboard");
}
