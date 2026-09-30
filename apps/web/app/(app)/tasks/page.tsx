import type { Metadata } from "next";
import { TasksView } from "@/features/tasks/components/tasks-view";

export const metadata: Metadata = { title: "Tasks · Task & Time Tracker" };

export default function TasksPage() {
  return <TasksView />;
}
