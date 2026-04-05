// --- Domain types ---

export type Activity = {
  id: string;
  name: string;
  duration: number;
  resources: ResourceRequirement[];
  // CPM-computed values (populated by runCPM)
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
};

export type Dependency = {
  fromId: string;
  toId: string;
  type: "FINISH_TO_START";
};

export type ResourceRequirement = {
  resourceId: string;
  quantity: number;
};

export type Resource = {
  id: string;
  name: string;
  available: number;
};

export type DateConstraint = {
  activityId: string;
  day: number; // integer offset from project start
  type: "START_AFTER" | "FINISH_BEFORE";
};

export type Schedule = {
  activities: Activity[];
  dependencies: Dependency[];
  resources: Resource[];
  constraints: DateConstraint[];
  projectDuration: number;
  criticalPath: string[]; // activity IDs
};

// --- Pipeline artifact types ---

export type IntentArtifact = {
  intentClearEnough: boolean;
  clarificationAsked: boolean;
  clarificationOptions?: { label: string; description: string }[];
  operationType?:
    | "modify_duration"
    | "add_dependency"
    | "remove_dependency"
    | "apply_constraint"
    | "query_info";
  targetActivityIds?: string[];
  parameters?: Record<string, unknown>;
  summary: string;
};

export type CodeArtifact = {
  code: string;
  description: string;
  sdkCalls: string[]; // names of SDK functions used
};

export type ExecutionArtifact = {
  success: boolean;
  error?: string;
  warnings: string[];
  projectDurationBefore: number;
  projectDurationAfter: number;
  criticalPathBefore: string[];
  criticalPathAfter: string[];
  changedActivities: {
    id: string;
    field: string;
    before: unknown;
    after: unknown;
  }[];
};

export type PipelineRun = {
  userMessage: string;
  scheduleBefore: Schedule;
  intent: IntentArtifact | null;
  code: CodeArtifact | null;
  execution: ExecutionArtifact | null;
  scheduleAfter: Schedule;
};

export type PendingPipelineRun = {
  userMessage: string;
  scheduleBefore: Schedule;
  intent: IntentArtifact | null;
  code: CodeArtifact | null;
};

// --- Runtime state ---

export type ScheduleState = {
  current: Schedule;
  previous: Schedule | null;
  lastPipelineRun: PipelineRun | null;
  pendingPipelineRun: PendingPipelineRun | null;
};

// --- Validation types ---

export type ResourceConflict = {
  resourceId: string;
  resourceName: string;
  day: number;
  required: number;
  available: number;
};

export type ValidationResult = {
  valid: boolean;
  hasCircularDependency: boolean;
  resourceConflicts: ResourceConflict[];
  negativeFloatActivities: string[];
  warnings: string[];
};
