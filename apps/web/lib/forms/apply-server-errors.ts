import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiRequestError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";

/** Maps an API error onto the form: field-level details where present, else a root error. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): void {
  if (error instanceof ApiRequestError && error.details) {
    for (const [field, messages] of Object.entries(error.details)) {
      setError(field as Path<T>, { message: messages[0] });
    }
    return;
  }

  setError("root", { message: getErrorMessage(error) });
}
