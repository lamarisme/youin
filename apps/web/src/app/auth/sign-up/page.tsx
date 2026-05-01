"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  return (
    <div className="rounded-xl border border-rule bg-paper-2 p-6">
      <div className="mb-5">
        <h2 className="font-display text-xl font-semibold text-ink">Create account</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Start your first workspace and invite your team.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-[0.75rem] font-medium text-ink-2">
            Full name
          </Label>
          <Input
            id="name"
            placeholder="Mira Klein"
            className="h-9 bg-paper text-[0.8125rem]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[0.75rem] font-medium text-ink-2">
            Work email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@agency.com"
            className="h-9 bg-paper text-[0.8125rem]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a strong password"
            className="h-9 bg-paper text-[0.8125rem]"
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox id="terms" className="mt-0.5" />
          <Label htmlFor="terms" className="text-[0.8125rem] leading-relaxed text-ink-2">
            I agree to the Terms and Privacy Policy.
          </Label>
        </div>

        <Button type="submit" className="w-full bg-mark text-paper hover:bg-mark-bright" asChild>
          <Link href="/dashboard">Create account</Link>
        </Button>
      </form>

      <p className="mt-5 text-center text-[0.8125rem] text-ink-2">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-medium text-ink hover:text-mark">
          Sign in
        </Link>
      </p>
    </div>
  );
}
