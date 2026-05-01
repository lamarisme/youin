"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  return (
    <div className="rounded-xl border border-rule bg-paper-2 p-6">
      <div className="mb-5">
        <h2 className="font-display text-xl font-semibold text-ink">Sign in</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Enter your workspace credentials to continue.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[0.75rem] font-medium text-ink-2">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@agency.com"
            className="h-9 bg-paper text-[0.8125rem]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
              Password
            </Label>
            <Link href="#" className="text-[0.6875rem] text-ink-3 hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            className="h-9 bg-paper text-[0.8125rem]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" />
          <Label htmlFor="remember" className="text-[0.8125rem] text-ink-2">
            Keep me signed in for 30 days
          </Label>
        </div>

        <Button type="submit" className="w-full bg-mark text-paper hover:bg-mark-bright" asChild>
          <Link href="/dashboard">Sign in</Link>
        </Button>

        <Button type="button" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <p className="mt-5 text-center text-[0.8125rem] text-ink-2">
        New to Markly?{" "}
        <Link href="/auth/sign-up" className="font-medium text-ink hover:text-mark">
          Create account
        </Link>
      </p>
    </div>
  );
}
