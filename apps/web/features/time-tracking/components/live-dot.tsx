import { cn } from "@/lib/utils";

/** A pulsing ember dot marking something that's running right now. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex size-2.5 shrink-0", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex size-full rounded-full bg-primary" />
    </span>
  );
}
