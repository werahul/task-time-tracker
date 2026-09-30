"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  TASK_SUGGESTION_INPUT_MAX_LENGTH,
  TASK_SUGGESTION_INPUT_MIN_LENGTH,
  type TaskSuggestion,
} from "@task-time-tracker/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { suggestionErrorMessage, useTaskSuggestion } from "../hooks/use-task-suggestion";

interface AiTaskAssistProps {
  /** Copies the suggestion into the form; `focus` moves the cursor there to edit. */
  onApply: (suggestion: TaskSuggestion, options: { focus: boolean }) => void;
}

/**
 * Optional helper above the task form. It only proposes a title/description;
 * the user reviews and edits it, and the form's own submit creates the task.
 */
export function AiTaskAssist({ onApply }: AiTaskAssistProps) {
  const [note, setNote] = useState("");
  const suggestion = useTaskSuggestion();
  const canSubmit = note.trim().length >= TASK_SUGGESTION_INPUT_MIN_LENGTH && !suggestion.isPending;

  const apply = (focus: boolean) => {
    if (!suggestion.data) return;
    onApply(suggestion.data, { focus });
    suggestion.reset();
  };

  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="grid gap-2">
        <Label htmlFor="ai-note" className="gap-1.5">
          <Sparkles aria-hidden className="size-3.5 text-primary" />
          What do you need to do?
        </Label>
        <Textarea
          id="ai-note"
          rows={2}
          maxLength={TASK_SUGGESTION_INPUT_MAX_LENGTH}
          placeholder="e.g. need to finish login stuff and test it"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        disabled={!canSubmit}
        onClick={() => suggestion.mutate(note)}
      >
        <Sparkles /> {suggestion.isPending ? "Improving task..." : "Improve with AI"}
      </Button>

      {suggestion.isError && (
        <p role="alert" className="text-sm text-destructive">
          {suggestionErrorMessage(suggestion.error)}
        </p>
      )}

      {suggestion.data && (
        <section
          aria-label="Suggested task"
          aria-live="polite"
          className="grid animate-fade-up gap-2 rounded-lg border border-primary/30 bg-background p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">Suggested task</p>
          <p className="font-medium break-words">{suggestion.data.title}</p>
          {suggestion.data.description && (
            <p className="text-sm break-words text-muted-foreground">
              {suggestion.data.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => apply(false)}>
              Use suggestion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => apply(true)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => suggestion.reset()}>
              Discard
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
