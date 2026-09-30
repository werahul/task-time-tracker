"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { segmentedClassName } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { useTimeLogs } from "../hooks/use-time-logs";
import { TimeLogList } from "./time-log-list";

type Range = "all" | "today" | "week";

const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
];

/** Start of the range in the viewer's local timezone, sent to the API as UTC ISO. */
function rangeStart(range: Range): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") start.setDate(start.getDate() - 6);
  return start.toISOString();
}

export function TimeLogsView() {
  const [range, setRange] = useState<Range>("all");
  const [page, setPage] = useState(1);
  // Recomputed when the range changes, not on every render, so the query key is stable.
  const [from, setFrom] = useState<string | undefined>(undefined);
  const logs = useTimeLogs({ page, limit: 20, from });

  const selectRange = (value: Range) => {
    setRange(value);
    setFrom(rangeStart(value));
    setPage(1);
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 sm:px-6 md:py-10">
      <PageHeader title="Time logs" description="Every session you've tracked." />

      <div role="group" aria-label="Filter by date" className={segmentedClassName}>
        {RANGES.map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={range === value ? "soft" : "ghost"}
            aria-pressed={range === value}
            onClick={() => selectRange(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <TimeLogList
        showTask
        data={logs.data}
        isPending={logs.isPending}
        isError={logs.isError}
        isPlaceholderData={logs.isPlaceholderData}
        onRetry={() => logs.refetch()}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}
