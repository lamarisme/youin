import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile settings",
};

export default function ProfilePage() {
  redirect("/account/profile");
}
