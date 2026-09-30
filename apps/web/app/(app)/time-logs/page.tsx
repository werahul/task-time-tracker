import type { Metadata } from "next";
import { TimeLogsView } from "@/features/time-tracking/components/time-logs-view";

export const metadata: Metadata = { title: "Time logs · Task & Time Tracker" };

export default function TimeLogsPage() {
  return <TimeLogsView />;
}
