"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Shows recovery actions, never the error itself
 * (messages/stacks can contain internals). `digest` correlates with server logs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Visible in the browser console for debugging; not rendered to the page.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center"
    >
      <AlertTriangle className="size-8 text-muted-foreground" aria-hidden />
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong.</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error stopped this page from loading. Your data is safe.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard">Go to dashboard</Link>} />
      </div>
    </div>
  );
}
