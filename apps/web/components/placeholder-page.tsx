import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back home
      </Link>
    </div>
  );
}
