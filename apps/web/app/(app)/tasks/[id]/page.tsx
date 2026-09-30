import type { Metadata } from "next";
import { TaskDetailView } from "@/features/tasks/components/task-detail-view";

export const metadata: Metadata = { title: "Task · Task & Time Tracker" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailView taskId={id} />;
}
