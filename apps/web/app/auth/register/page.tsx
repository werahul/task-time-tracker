import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Create account · Task & Time Tracker" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start capturing tasks and tracking focused work.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary transition-colors hover:text-orange-300"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
