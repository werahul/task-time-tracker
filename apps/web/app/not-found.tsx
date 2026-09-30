import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found · Task & Time Tracker" };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-24 animate-fade-up text-center">
      <span className="grid size-11 place-items-center rounded-lg bg-white/[0.04] text-muted-foreground ring-1 ring-white/10">
        <SearchX className="size-6" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/dashboard">Go to dashboard</Link>} />
        <Button variant="outline" nativeButton={false} render={<Link href="/">Home</Link>} />
      </div>
    </div>
  );
}
