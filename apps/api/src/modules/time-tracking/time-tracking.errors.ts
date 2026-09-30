import { AppError } from "../../lib/app-error";

export const TimeTrackingErrors = {
  activeTimerExists: (onSameTask: boolean) =>
    new AppError(
      409,
      "ACTIVE_TIMER_EXISTS",
      onSameTask
        ? "A timer is already running for this task."
        : "Another timer is already running.",
    ),
  activeTimerNotFound: () =>
    new AppError(404, "ACTIVE_TIMER_NOT_FOUND", "No timer is running for this task."),
  // Lost a race: another request stopped this timer between our read and write.
  timerAlreadyStopped: () =>
    new AppError(409, "TIMER_ALREADY_STOPPED", "This timer has already been stopped."),
  taskCompleted: () =>
    new AppError(
      409,
      "INVALID_TIMER_STATE",
      "Completed tasks can't be timed. Reopen the task to track more time.",
    ),
};
