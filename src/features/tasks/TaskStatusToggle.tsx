"use client";

import { useCallback, useRef, useState } from "react";

import {
  setTaskStatusAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";
import type { TaskDto } from "@/server/tasks/service";

/**
 * TaskStatusToggle (feature 003-task-management, T024; FR-008/FR-009, D3/D8)
 * — the single-interaction complete/reopen control wired to the
 * `setTaskStatusAction` server action.
 *
 * Optimistic (D3): the label flips to the TARGET state immediately; on
 * success the DISPLAYED state settles to the server's returned status and
 * stays there until the refreshed `task` prop confirms it — the prop lags
 * (RSC refresh is async), so a stale prop must never resurrect the old
 * state or the next click would compute the wrong target. The parent's
 * `onUpdated` receives the server's DTO (resync); on failure the optimistic
 * flip rolls back, ONE friendly error shows, and `onUpdated` fires so the
 * UI resyncs from the server (D3) — this also covers transport-level drops
 * where the write's fate is unknown. The single-flight ref makes rapid
 * re-fires no-ops so rapid toggling settles consistent (D8, D12 S11
 * pattern).
 */
export function TaskStatusToggle({
  task,
  onUpdated,
}: {
  task: TaskDto;
  onUpdated?: (task: TaskDto) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic target status while the write is in flight.
  const [optimisticStatus, setOptimisticStatus] = useState<
    TaskDto["status"] | null
  >(null);
  // The last server-confirmed status: rendered until the (async-refreshed)
  // prop carries the same value, then dropped so external changes stay
  // visible. The override tracks the prop it was confirmed against via the
  // render-phase reset pattern (setState in an effect would fire an extra
  // commit and violates the react-hooks lint rules).
  const [confirmedStatus, setConfirmedStatus] = useState<
    TaskDto["status"] | null
  >(null);
  const [confirmedFor, setConfirmedFor] = useState(task.status);
  if (confirmedFor !== task.status) {
    setConfirmedFor(task.status);
    setConfirmedStatus(null);
  }
  const inFlightRef = useRef(false);

  const displayStatus = optimisticStatus ?? confirmedStatus ?? task.status;
  const target: TaskDto["status"] =
    displayStatus === "COMPLETED" ? "TODO" : "COMPLETED";

  const handleToggle = useCallback(async () => {
    if (inFlightRef.current) return; // D8 single-flight
    inFlightRef.current = true;
    setPending(true);
    setError(null);
    setOptimisticStatus(target); // optimistic flip (D3)
    try {
      const result: TaskActionResult = await setTaskStatusAction(
        task.id,
        target,
      );
      if (result.status === "success") {
        onUpdated?.(result.task);
        // Settle to the server's status (see confirmedStatus above) instead
        // of dropping straight back to the (possibly stale) prop.
        setOptimisticStatus(null);
        setConfirmedStatus(result.task.status);
      } else {
        setOptimisticStatus(null); // roll back
        setError(
          result.status === "validation_error"
            ? (result.fieldErrors[0]?.message ?? "Please try again.")
            : result.message,
        );
        // Resync from the server on failure (D3): the write may even have
        // landed (e.g. dropped response), so the parent refreshes.
        onUpdated?.(task);
      }
    } catch {
      setOptimisticStatus(null); // roll back
      setError("Something went wrong. Please try again.");
      onUpdated?.(task); // resync — the write's fate is unknown
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, [task, target, onUpdated]);

  const label = displayStatus === "COMPLETED" ? "Reopen" : "Complete";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-label={`${label} "${task.title}"`}
        className="border-border hover:bg-muted focus-visible:outline-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        data-testid="toggle-status"
      >
        <span aria-hidden="true">
          {displayStatus === "COMPLETED" ? "↩" : "✓"}
        </span>
        {label}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
