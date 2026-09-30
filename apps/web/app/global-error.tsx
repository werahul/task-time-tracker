"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it renders its own <html>/<body> and avoids app components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center p-6 font-sans">
        <div role="alert" className="grid max-w-md gap-3 text-center">
          <h1 className="text-xl font-semibold">Something went wrong.</h1>
          <p className="text-sm text-muted-foreground">The app failed to load. Please try again.</p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mx-auto rounded-xl bg-linear-to-b from-orange-400 to-orange-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-btn"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
