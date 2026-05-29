import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Project marks",
};

export default function SpacePage() {
  redirect("/dashboard");
}
