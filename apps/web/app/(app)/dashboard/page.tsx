import { Suspense } from "react";
import type { Metadata } from "next";
import { DailySummary } from "@/features/dashboard/components/daily-summary";
import { WeeklySkeleton, WeeklySummary } from "@/features/dashboard/components/weekly-summary";

export const metadata: Metadata = { title: "Dashboard · Task & Time Tracker" };

export default function DashboardPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-8 sm:px-6">
      <DailySummary />
      {/* The weekly view reads ?week= from the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<WeeklySkeleton />}>
        <WeeklySummary />
      </Suspense>
    </div>
  );
}
