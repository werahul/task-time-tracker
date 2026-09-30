import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/** The app's mark: an orange tile with a timer glyph. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
    >
      <Timer className="size-4" strokeWidth={2.4} />
    </span>
  );
}

/** Mark + wordmark, used in the sidebar, the auth pages and the landing page. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-sm font-semibold tracking-tight">Task &amp; Time Tracker</span>
    </span>
  );
}
