import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Capture tasks",
    description:
      "Write down what you need to do. Rough notes are fine — the optional AI helper can tidy them into a clear title.",
  },
  {
    title: "Track focused work",
    description:
      "One timer, started from the task you're on. It keeps counting through refreshes and closed tabs.",
  },
  {
    title: "Understand your day",
    description:
      "Daily and weekly summaries show where the hours actually went, not where you planned them to go.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Brand />
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/auth/login">Sign in</Link>}
            />
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/auth/register">Get started</Link>}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-20 sm:py-28">
        <div className="max-w-2xl animate-fade-up">
          <p className="text-sm font-medium text-primary">Task &amp; Time Tracker</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Know where your working hours go.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Capture tasks, track focused work, and understand your daily productivity.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href="/auth/register">
                  Get started <ArrowRight />
                </Link>
              }
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard">View dashboard</Link>}
            />
          </div>
        </div>

        <dl className="mt-20 grid gap-x-10 gap-y-8 border-t border-border pt-10 sm:grid-cols-3">
          {features.map(({ title, description }, index) => (
            <div key={title} className="grid content-start gap-2">
              <dt className="flex items-baseline gap-3 font-medium">
                <span className="font-mono text-xs text-primary tabular-nums">0{index + 1}</span>
                {title}
              </dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{description}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
