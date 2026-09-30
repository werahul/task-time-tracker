"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useElapsedSeconds } from "@/features/time-tracking/hooks/use-elapsed-seconds";
import { ApiRequestError } from "@/lib/api/client";
import { formatLongDate, greeting, localIsoDate, shiftIsoDate } from "../date";
import { useDailySummary } from "../hooks/use-daily-summary";
import type { DailySummaryState } from "../types/dashboard.types";
import { ActiveTimerCard } from "./active-timer-card";
import { ProductivityStats } from "./productivity-stats";
import { TopTasks } from "./top-tasks";

export function DailySummary() {
  const { data: user } = useCurrentUser();
  // Captured once per visit; the dashboard doesn't roll over at midnight on its own.
  const [today] = useState(() => localIsoDate());
  const [hour] = useState(() => new Date().getHours());
  const [date, setDate] = useState(today);

  const isFuture = date > today;
  const summary = useDailySummary(date, !isFuture);
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(hour)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{formatLongDate(date)}</p>
        </div>
        <nav aria-label="Choose day" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(shiftIsoDate(date, -1))}>
            <ChevronLeft /> Previous day
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={date === today}
            onClick={() => setDate(today)}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={date >= today}
            onClick={() => setDate(shiftIsoDate(date, 1))}
          >
            Next day <ChevronRight />
          </Button>
        </nav>
      </header>

      {isFuture || isFutureDateError(summary.error) ? (
        <Notice>No productivity data available for this date.</Notice>
      ) : summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError ? (
        <Notice>
          <span>We couldn&apos;t load today&apos;s productivity data.</span>
          <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
            Try again
          </Button>
        </Notice>
      ) : (
        <SummaryContent summary={summary.data} />
      )}
    </div>
  );
}

function SummaryContent({ summary }: { summary: DailySummaryState }) {
  const hasActivity = summary.totalTrackedSeconds > 0 || summary.completedTasks > 0;

  return (
    <>
      <LiveProductivityStats summary={summary} />

      {summary.isToday && (
        <Section title="Currently working">
          <ActiveTimerCard />
        </Section>
      )}

      <Section title={summary.isToday ? "Today's focus" : "Focus"}>
        {summary.topTasks.length > 0 ? (
          <TopTasks tasks={summary.topTasks} />
        ) : (
          <div className="grid gap-1 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-medium">
              {summary.isToday ? "No productivity data yet." : "No time was tracked on this day."}
            </p>
            {summary.isToday && (
              <p className="text-sm text-muted-foreground">Start a timer when you begin working.</p>
            )}
          </div>
        )}
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        {hasActivity && (
          <Section title="Insight">
            <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <ul className="grid gap-1 text-sm">
                {summary.insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        <Section title="Task status" description="Your open tasks right now">
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
            <StatusCount label="Pending" value={summary.pendingTasks} />
            <StatusCount label="In progress" value={summary.inProgressTasks} />
          </dl>
        </Section>
      </div>
    </>
  );
}

/**
 * While a timer runs, today's total ticks forward from the server's figure.
 * Isolated so only the stat cards re-render each second, not the whole summary.
 */
function LiveProductivityStats({ summary }: { summary: DailySummaryState }) {
  const runningToday = summary.isToday && summary.activeTimer !== null;
  const sinceReceived = useElapsedSeconds(runningToday ? summary.receivedAt : undefined);

  return (
    <ProductivityStats
      totalTrackedSeconds={summary.totalTrackedSeconds + sinceReceived}
      tasksWorkedOn={summary.tasksWorkedOn}
      completedTasks={summary.completedTasks}
    />
  );
}

function isFutureDateError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "DATE_IN_FUTURE";
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-8" aria-busy aria-label="Loading productivity data">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
