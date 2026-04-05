import type {
  Schedule,
  ResourceConflict,
  ValidationResult,
  Dependency,
} from "./types";

/**
 * Detect circular dependencies via topological sort attempt.
 * Returns true if a cycle exists.
 */
export function detectCircularDependencies(
  activityIds: string[],
  dependencies: Dependency[]
): boolean {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of activityIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const dep of dependencies) {
    inDegree.set(dep.toId, (inDegree.get(dep.toId) ?? 0) + 1);
    adjacency.get(dep.fromId)?.push(dep.toId);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let count = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    count++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return count !== activityIds.length;
}

/**
 * Detect resource over-allocation.
 * For each day, sums resource requirements of active activities (ES <= day < EF)
 * and flags when the sum exceeds availability.
 */
export function detectResourceConflicts(
  schedule: Schedule
): ResourceConflict[] {
  const conflicts: ResourceConflict[] = [];
  if (schedule.projectDuration === 0) return conflicts;

  for (const resource of schedule.resources) {
    for (let day = 0; day < schedule.projectDuration; day++) {
      let required = 0;
      for (const activity of schedule.activities) {
        if (day >= activity.es && day < activity.ef) {
          for (const req of activity.resources) {
            if (req.resourceId === resource.id) {
              required += req.quantity;
            }
          }
        }
      }
      if (required > resource.available) {
        conflicts.push({
          resourceId: resource.id,
          resourceName: resource.name,
          day,
          required,
          available: resource.available,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect activities with negative float (caused by date constraints).
 */
export function detectNegativeFloat(schedule: Schedule): string[] {
  return schedule.activities
    .filter((a) => a.float < 0)
    .map((a) => a.id);
}

/**
 * Run all validation checks on a schedule.
 */
export function validate(schedule: Schedule): ValidationResult {
  const activityIds = schedule.activities.map((a) => a.id);
  const hasCircularDependency = detectCircularDependencies(
    activityIds,
    schedule.dependencies
  );
  const resourceConflicts = detectResourceConflicts(schedule);
  const negativeFloatActivities = detectNegativeFloat(schedule);

  const warnings: string[] = [];

  if (hasCircularDependency) {
    warnings.push("Circular dependency detected — change rejected.");
  }

  for (const conflict of resourceConflicts) {
    warnings.push(
      `Resource conflict: ${conflict.resourceName} over-allocated on day ${conflict.day} ` +
        `(${conflict.required} needed, ${conflict.available} available)`
    );
  }

  for (const actId of negativeFloatActivities) {
    const activity = schedule.activities.find((a) => a.id === actId);
    warnings.push(
      `Negative float on ${activity?.name ?? actId}: date constraint creates an infeasible schedule`
    );
  }

  return {
    valid: !hasCircularDependency,
    hasCircularDependency,
    resourceConflicts,
    negativeFloatActivities,
    warnings,
  };
}
