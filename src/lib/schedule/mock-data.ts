import type { Activity, Dependency, Resource, Schedule } from "./types";
import { runCPM } from "./cpm";

/** Fixed demo project start date */
export const PROJECT_START_DATE = "2026-01-05";

const activities: Activity[] = [
  {
    id: "EXC",
    name: "Excavation",
    duration: 5,
    resources: [{ resourceId: "excavators", quantity: 2 }],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
  {
    id: "FND",
    name: "Foundation",
    duration: 8,
    resources: [{ resourceId: "cranes", quantity: 1 }],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
  {
    id: "STL",
    name: "Structural Steel",
    duration: 10,
    resources: [{ resourceId: "cranes", quantity: 2 }],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
  {
    id: "ELC",
    name: "Electrical Installation",
    duration: 6,
    resources: [],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
  {
    id: "CPR",
    name: "Concrete Pour",
    duration: 4,
    resources: [{ resourceId: "cranes", quantity: 1 }],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
  {
    id: "COM",
    name: "Commissioning",
    duration: 3,
    resources: [],
    es: 0, ef: 0, ls: 0, lf: 0, float: 0,
  },
];

const dependencies: Dependency[] = [
  { fromId: "EXC", toId: "FND", type: "FINISH_TO_START" },
  { fromId: "FND", toId: "STL", type: "FINISH_TO_START" },
  { fromId: "FND", toId: "ELC", type: "FINISH_TO_START" },
  { fromId: "STL", toId: "CPR", type: "FINISH_TO_START" },
  { fromId: "CPR", toId: "COM", type: "FINISH_TO_START" },
  { fromId: "ELC", toId: "COM", type: "FINISH_TO_START" },
];

const resources: Resource[] = [
  { id: "excavators", name: "Excavators", available: 3 },
  { id: "cranes", name: "Cranes", available: 2 },
];

/**
 * Create the initial mock schedule with CPM values computed.
 */
export function createMockSchedule(): Schedule {
  const raw: Schedule = {
    activities: activities.map((a) => ({ ...a })),
    dependencies: dependencies.map((d) => ({ ...d })),
    resources: resources.map((r) => ({ ...r })),
    constraints: [],
    projectDuration: 0,
    criticalPath: [],
  };
  return runCPM(raw);
}
