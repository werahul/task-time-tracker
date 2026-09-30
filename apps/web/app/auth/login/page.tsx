import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in · Task & Time Tracker" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Pick up where you left off.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/auth/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
