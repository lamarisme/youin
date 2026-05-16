import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  redirect("/account");
}
