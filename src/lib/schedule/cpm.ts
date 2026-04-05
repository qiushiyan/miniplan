import type { Activity, Dependency, DateConstraint, Schedule } from "./types";

/**
 * Topological sort of activities based on dependencies.
 * Returns ordered activity IDs. Throws if a cycle is detected.
 */
export function topologicalSort(
  activities: Activity[],
  dependencies: Dependency[]
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const a of activities) {
    inDegree.set(a.id, 0);
    adjacency.set(a.id, []);
  }

  for (const dep of dependencies) {
    inDegree.set(dep.toId, (inDegree.get(dep.toId) ?? 0) + 1);
    adjacency.get(dep.fromId)?.push(dep.toId);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== activities.length) {
    throw new Error("Circular dependency detected in schedule");
  }

  return sorted;
}

/**
 * Forward pass: compute Early Start (ES) and Early Finish (EF) for each activity.
 * ES = max(EF of all predecessors), or 0 if no predecessors.
 * EF = ES + duration.
 * Also applies START_AFTER constraints.
 */
function forwardPass(
  activities: Activity[],
  dependencies: Dependency[],
  constraints: DateConstraint[],
  order: string[]
): void {
  const activityMap = new Map(activities.map((a) => [a.id, a]));

  // Build predecessor map: activityId -> list of predecessor activity IDs
  const predecessors = new Map<string, string[]>();
  for (const a of activities) predecessors.set(a.id, []);
  for (const dep of dependencies) {
    predecessors.get(dep.toId)?.push(dep.fromId);
  }

  for (const id of order) {
    const activity = activityMap.get(id)!;
    const preds = predecessors.get(id) ?? [];

    let es = 0;
    for (const predId of preds) {
      const pred = activityMap.get(predId)!;
      es = Math.max(es, pred.ef);
    }

    // Apply START_AFTER constraints
    for (const c of constraints) {
      if (c.activityId === id && c.type === "START_AFTER") {
        es = Math.max(es, c.day);
      }
    }

    activity.es = es;
    activity.ef = es + activity.duration;
  }
}

/**
 * Backward pass: compute Late Start (LS) and Late Finish (LF) for each activity.
 * LF = min(LS of all successors), or project duration if no successors.
 * LS = LF - duration.
 * Also applies FINISH_BEFORE constraints.
 */
function backwardPass(
  activities: Activity[],
  dependencies: Dependency[],
  constraints: DateConstraint[],
  order: string[],
  projectDuration: number
): void {
  const activityMap = new Map(activities.map((a) => [a.id, a]));

  // Build successor map: activityId -> list of successor activity IDs
  const successors = new Map<string, string[]>();
  for (const a of activities) successors.set(a.id, []);
  for (const dep of dependencies) {
    successors.get(dep.fromId)?.push(dep.toId);
  }

  // Traverse in reverse topological order
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const activity = activityMap.get(id)!;
    const succs = successors.get(id) ?? [];

    let lf = projectDuration;
    for (const succId of succs) {
      const succ = activityMap.get(succId)!;
      lf = Math.min(lf, succ.ls);
    }

    // Apply FINISH_BEFORE constraints
    for (const c of constraints) {
      if (c.activityId === id && c.type === "FINISH_BEFORE") {
        lf = Math.min(lf, c.day);
      }
    }

    activity.lf = lf;
    activity.ls = lf - activity.duration;
  }
}

/**
 * Run the Critical Path Method on a schedule.
 * Computes ES, EF, LS, LF, float for all activities.
 * Identifies the critical path and project duration.
 * Returns a new Schedule with all CPM values populated.
 */
export function runCPM(schedule: Schedule): Schedule {
  const activities = schedule.activities.map((a) => ({ ...a }));
  const order = topologicalSort(activities, schedule.dependencies);

  // Forward pass
  forwardPass(activities, schedule.dependencies, schedule.constraints, order);

  // Project duration = max EF across all activities
  const projectDuration = Math.max(...activities.map((a) => a.ef));

  // Backward pass
  backwardPass(
    activities,
    schedule.dependencies,
    schedule.constraints,
    order,
    projectDuration
  );

  // Compute float and identify critical path
  for (const a of activities) {
    a.float = a.ls - a.es;
  }
  const criticalPath = order.filter((id) => {
    const a = activities.find((act) => act.id === id)!;
    return a.float === 0;
  });

  return {
    ...schedule,
    activities,
    projectDuration,
    criticalPath,
  };
}
