"use client";

import { getErrorMessage } from "@/lib/api/errors";
import type { Task } from "@task-time-tracker/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateTask, useDeleteTask, useUpdateTask } from "../hooks/use-tasks";
import { TaskForm } from "./task-form";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: DialogProps) {
  const createTask = useCreateTask();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Capture what you need to work on.</DialogDescription>
        </DialogHeader>
        {open && (
          <TaskForm
            showAiAssist
            submitLabel="Create task"
            onCancel={() => onOpenChange(false)}
            onSubmit={async ({ title, description }) => {
              await createTask.mutateAsync({ title, description });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditTaskDialog({ task, open, onOpenChange }: DialogProps & { task: Task }) {
  const updateTask = useUpdateTask();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Update the details or status of this task.</DialogDescription>
        </DialogHeader>
        {open && (
          <TaskForm
            showStatus
            submitLabel="Save changes"
            defaultValues={task}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (values) => {
              await updateTask.mutateAsync({ id: task.id, input: values });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTaskDialog({ task, open, onOpenChange }: DialogProps & { task: Task }) {
  const deleteTask = useDeleteTask();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{task.title}&rdquo; and any time tracked against it will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteTask.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(deleteTask.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteTask.isPending}
            onClick={() => deleteTask.mutate(task.id, { onSuccess: () => onOpenChange(false) })}
          >
            {deleteTask.isPending ? "Deleting..." : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
