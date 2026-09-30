import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-white/[0.03] px-3 py-2.5 text-base shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.25)] transition-[color,background-color,border-color,box-shadow] duration-200 outline-none hover:border-white/20 placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:bg-white/[0.05] focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
