"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  canTransitionTaskStatus,
  createTaskSchema,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_STATUSES,
  taskStatusSchema,
  type TaskStatus,
  type TaskSuggestion,
} from "@task-time-tracker/shared";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyServerErrors } from "@/lib/forms/apply-server-errors";
import { TASK_STATUS_LABELS } from "../task-status";
import { AiTaskAssist } from "./ai-task-assist";

// Same title/description rules the API enforces, plus status for editing.
const taskFormSchema = createTaskSchema.extend({ status: taskStatusSchema });

type TaskFormInput = z.input<typeof taskFormSchema>;
export type TaskFormValues = z.output<typeof taskFormSchema>;

interface TaskFormProps {
  defaultValues?: { title: string; description: string | null; status: TaskStatus };
  /** Shows the status field; omitted when creating (new tasks start as PENDING). */
  showStatus?: boolean;
  /** Shows the optional "Improve with AI" helper that can pre-fill title/description. */
  showAiAssist?: boolean;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => Promise<unknown>;
  onCancel: () => void;
}

export function TaskForm({
  defaultValues,
  showStatus = false,
  showAiAssist = false,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const initialStatus = defaultValues?.status ?? "PENDING";
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      status: initialStatus,
    },
  });

  const statusOptions = TASK_STATUSES.filter((s) => canTransitionTaskStatus(initialStatus, s));

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyServerErrors(error, setError);
    }
  });

  // A suggestion only pre-fills the fields; the user can still edit everything,
  // and the normal submit (POST /tasks) remains the only way to create the task.
  const applySuggestion = (suggestion: TaskSuggestion, { focus }: { focus: boolean }) => {
    const options = { shouldDirty: true, shouldValidate: true };
    setValue("title", suggestion.title, options);
    setValue("description", suggestion.description ?? "", options);
    if (focus) setFocus("title");
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {showAiAssist && <AiTaskAssist onApply={applySuggestion} />}

      <FormField id="task-title" label="Title" error={errors.title?.message}>
        <Input
          id="task-title"
          autoFocus
          placeholder="e.g. Follow up with designer"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "task-title-error" : undefined}
          {...register("title")}
        />
      </FormField>

      <FormField
        id="task-description"
        label="Description (optional)"
        error={errors.description?.message}
      >
        <Textarea
          id="task-description"
          rows={4}
          maxLength={TASK_DESCRIPTION_MAX_LENGTH}
          placeholder="Add any details that will help you get started"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "task-description-error" : undefined}
          {...register("description")}
        />
      </FormField>

      {showStatus && (
        <FormField id="task-status" label="Status" error={errors.status?.message}>
          <select
            id="task-status"
            className="h-10 w-full rounded-xl border border-input bg-white/[0.03] px-3 text-sm transition-[border-color,box-shadow] outline-none hover:border-white/20 focus-visible:border-primary/70 focus-visible:ring-4 focus-visible:ring-primary/15 [&>option]:bg-popover"
            {...register("status")}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
