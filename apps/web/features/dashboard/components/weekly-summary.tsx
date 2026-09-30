"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
} from "lucide-react";
import type { WeeklySummary as WeeklySummaryData } from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/client";
import { formatWeekRange, isIsoDate, localIsoDate, shiftIsoDate, startOfWeek } from "../date";
import { useWeeklySummary } from "../hooks/use-weekly-summary";
import { StatCard } from "./productivity-stats";
import { TopTasks } from "./top-tasks";
import { WeeklyTaskBreakdown } from "./weekly-task-breakdown";
import { WeeklyTimeChart } from "./weekly-time-chart";

const WEEK_PARAM = "week";

/**
 * Weekly analytics. The selected week lives in the URL (`?week=YYYY-MM-DD`,
 * a Monday) so the view is shareable and survives a refresh; no param means
 * this week. Every number is computed by the API — nothing is re-derived here.
 */
export function WeeklySummary() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Captured once per visit, like the daily view's "today".
  const [thisWeek] = useState(() => startOfWeek(localIsoDate()));

  const param = searchParams.get(WEEK_PARAM);
  const week = param && isIsoDate(param) ? startOfWeek(param) : thisWeek;
  const isFuture = week > thisWeek;
  const summary = useWeeklySummary(week, !isFuture);

  function goTo(target: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (target === thisWeek) params.delete(WEEK_PARAM);
    else params.set(WEEK_PARAM, target);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section className="grid gap-6" aria-labelledby="weekly-heading">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="weekly-heading" className="text-xl font-semibold tracking-tight">
            {week === thisWeek ? "This week" : "Week"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatWeekRange(week, shiftIsoDate(week, 6))}
          </p>
        </div>
        <nav aria-label="Choose week" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => goTo(shiftIsoDate(week, -7))}>
            <ChevronLeft /> Previous week
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={week === thisWeek}
            onClick={() => goTo(thisWeek)}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={week >= thisWeek}
            onClick={() => goTo(shiftIsoDate(week, 7))}
          >
            Next week <ChevronRight />
          </Button>
        </nav>
      </header>

      {isFuture || isFutureDateError(summary.error) ? (
        <Notice>
          <span>This week hasn&apos;t started yet, so there&apos;s no productivity data.</span>
          <Button variant="outline" size="sm" onClick={() => goTo(thisWeek)}>
            Go to this week
          </Button>
        </Notice>
      ) : summary.isPending ? (
        <WeeklySkeleton />
      ) : summary.isError ? (
        <Notice>
          <span>We couldn&apos;t load this week&apos;s productivity data.</span>
          <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
            Try again
          </Button>
        </Notice>
      ) : (
        <WeeklyContent summary={summary.data} />
      )}
    </section>
  );
}

function WeeklyContent({ summary }: { summary: WeeklySummaryData }) {
  const hasActivity = summary.totalTrackedSeconds > 0 || summary.completedTasks > 0;
  const days = summary.elapsedDays;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Total time" value={summary.totalTrackedFormatted} />
        <StatCard
          icon={CalendarDays}
          label="Average / day"
          value={summary.averageDailyFormatted}
          hint={
            summary.isCurrentWeek
              ? `Over ${days} day${days === 1 ? "" : "s"} so far`
              : "Over 7 days"
          }
        />
        <StatCard icon={ListChecks} label="Tasks worked on" value={String(summary.tasksWorkedOn)} />
        <StatCard icon={CheckCircle2} label="Completed" value={String(summary.completedTasks)} />
      </ul>

      {!hasActivity && (
        <div className="grid gap-1 rounded-xl border border-dashed border-border px-6 py-6 text-center">
          <p className="font-medium">No productivity data for this week.</p>
          <p className="text-sm text-muted-foreground">Start a timer when you begin working.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Time per day">
          <WeeklyTimeChart days={summary.dailyBreakdown} />
        </Section>
        <Section title="Daily breakdown">
          <WeeklyTaskBreakdown days={summary.dailyBreakdown} />
        </Section>
      </div>

      {summary.topTasks.length > 0 && (
        <Section title="Top tasks this week" description="Share of the week's tracked time">
          <TopTasks tasks={summary.topTasks} totalSeconds={summary.totalTrackedSeconds} />
        </Section>
      )}
    </>
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
    <section className="grid content-start gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
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

export function WeeklySkeleton() {
  return (
    <div className="grid gap-6" aria-busy aria-label="Loading weekly productivity data">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
