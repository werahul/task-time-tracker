import Link from "next/link";
import { CheckCircle2, Clock, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: CheckCircle2,
    title: "Capture tasks",
    description: "Organize your work into clear, actionable tasks.",
  },
  {
    icon: Clock,
    title: "Track focused work",
    description: "Start and stop real-time timers as you work.",
  },
  {
    icon: LayoutDashboard,
    title: "Understand your day",
    description: "See daily summaries of where your time actually goes.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Task & Time Tracker</span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/auth/login">Sign in</Link>} />
            <Button size="sm" render={<Link href="/auth/register">Get started</Link>} />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Task & Time Tracker
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground text-balance">
          Capture tasks, track focused work, and understand your daily productivity.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button render={<Link href="/auth/register">Get started</Link>} />
          <Button variant="outline" render={<Link href="/dashboard">View dashboard</Link>} />
        </div>

        <div className="mt-20 grid w-full gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 text-card-foreground"
            >
              <Icon className="size-6 text-primary" />
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
