// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkoutStep =
  | {
      type: 'ExecutableStepDTO';
      stepId: null;
      stepOrder: number;
      childStepId: null;
      description: null;
      stepType: { stepTypeId: number; stepTypeKey: string };
      endCondition: { conditionTypeKey: string; conditionTypeId: number };
      preferredEndConditionUnit: { unitKey: string; unitId: number } | null;
      endConditionValue: number | null;
      endConditionCompare: null;
      endConditionZone: null;
      targetType: { workoutTargetTypeId: number; workoutTargetTypeKey: string };
      targetValueOne: number | null;
      targetValueTwo: number | null;
      zoneNumber: null;
    }
  | {
      type: 'RepeatGroupDTO';
      stepId: null;
      stepOrder: number;
      childStepId: number;
      stepType: { stepTypeId: number; stepTypeKey: string };
      endCondition: { conditionTypeKey: string; conditionTypeId: number };
      endConditionValue: number;
      workoutSteps: WorkoutStep[];
    };

export type WorkoutPayload = {
  workoutName: string;
  description: string;
  sportType: { sportTypeId: number; sportTypeKey: string };
  workoutSegments: {
    segmentOrder: number;
    sportType: { sportTypeId: number; sportTypeKey: string };
    workoutSteps: WorkoutStep[];
  }[];
};

// ─── Builder helpers ─────────────────────────────────────────────────────────

function execStep(
  stepOrder: number,
  typeKey: string,
  typeId: number,
  condKey: string,
  condId: number,
  condValue: number,
  unitKey: string | null,
  unitId: number | null,
  targetKey: string,
  targetId: number,
  targetLow: number | null,
  targetHigh: number | null,
): WorkoutStep {
  return {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder,
    childStepId: null,
    description: null,
    stepType: { stepTypeId: typeId, stepTypeKey: typeKey },
    endCondition: { conditionTypeKey: condKey, conditionTypeId: condId },
    preferredEndConditionUnit: unitKey ? { unitKey, unitId: unitId! } : null,
    endConditionValue: condValue,
    endConditionCompare: null,
    endConditionZone: null,
    targetType: { workoutTargetTypeId: targetId, workoutTargetTypeKey: targetKey },
    targetValueOne: targetLow,
    targetValueTwo: targetHigh,
    zoneNumber: null,
  };
}

function timeStep(
  order: number,
  typeKey: string,
  typeId: number,
  secs: number,
  tKey = 'no.target',
  tId = 1,
  tLow: number | null = null,
  tHigh: number | null = null,
): WorkoutStep {
  return execStep(order, typeKey, typeId, 'time', 2, secs, null, null, tKey, tId, tLow, tHigh);
}

function distStep(
  order: number,
  typeKey: string,
  typeId: number,
  meters: number,
  tKey = 'no.target',
  tId = 1,
  tLow: number | null = null,
  tHigh: number | null = null,
): WorkoutStep {
  return execStep(order, typeKey, typeId, 'distance', 3, meters, 'meter', 2, tKey, tId, tLow, tHigh);
}

function repeatGroup(order: number, iterations: number, steps: WorkoutStep[]): WorkoutStep {
  return {
    type: 'RepeatGroupDTO',
    stepId: null,
    stepOrder: order,
    childStepId: 1,
    stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
    endCondition: { conditionTypeKey: 'iterations', conditionTypeId: 7 },
    endConditionValue: iterations,
    workoutSteps: steps,
  };
}

function buildPayload(
  name: string,
  description: string,
  sportTypeId: number,
  sportTypeKey: string,
  steps: WorkoutStep[],
): WorkoutPayload {
  return {
    workoutName: name,
    description: description || 'Created with garmin-workout-mcp',
    sportType: { sportTypeId, sportTypeKey },
    workoutSegments: [{ segmentOrder: 1, sportType: { sportTypeId, sportTypeKey }, workoutSteps: steps }],
  };
}

// ─── Running ─────────────────────────────────────────────────────────────────

export type RunningWorkoutArgs = {
  name: string;
  description?: string;
  simpleDurationSecs?: number;
  simpleDistanceMeters?: number;
  warmupSecs?: number;
  intervals?: number;
  intervalDistanceMeters?: number;
  intervalPaceMinPerKm?: number;
  restSecs?: number;
  cooldownSecs?: number;
};

export function buildRunningWorkout(args: RunningWorkoutArgs): WorkoutPayload {
  const steps: WorkoutStep[] = [];
  let order = 1;

  // Simple run — just duration or distance, no structure
  if (!args.intervals) {
    if (args.simpleDurationSecs) {
      steps.push(timeStep(1, 'interval', 3, args.simpleDurationSecs));
    } else if (args.simpleDistanceMeters) {
      steps.push(distStep(1, 'interval', 3, args.simpleDistanceMeters));
    } else {
      steps.push(timeStep(1, 'interval', 3, 1800)); // default 30min
    }
    return buildPayload(args.name, args.description ?? '', 1, 'running', steps);
  }

  // Structured workout
  if (args.warmupSecs) steps.push(timeStep(order++, 'warmup', 1, args.warmupSecs));

  if (args.intervalDistanceMeters) {
    const paceTarget = args.intervalPaceMinPerKm
      ? { key: 'pace.zone', id: 6, low: 1000 / (args.intervalPaceMinPerKm * 1.1), high: 1000 / (args.intervalPaceMinPerKm * 0.9) }
      : { key: 'no.target', id: 1, low: null, high: null };

    const iSteps: WorkoutStep[] = [
      distStep(1, 'interval', 3, args.intervalDistanceMeters, paceTarget.key, paceTarget.id, paceTarget.low, paceTarget.high),
    ];
    if (args.restSecs) iSteps.push(timeStep(2, 'recovery', 4, args.restSecs));
    steps.push(repeatGroup(order++, args.intervals, iSteps));
  }

  if (args.cooldownSecs) steps.push(timeStep(order++, 'cooldown', 2, args.cooldownSecs));

  return buildPayload(args.name, args.description ?? '', 1, 'running', steps);
}

// ─── Cycling ─────────────────────────────────────────────────────────────────

export type CyclingWorkoutArgs = {
  name: string;
  description?: string;
  simpleDurationSecs?: number;
  warmupSecs?: number;
  intervals?: number;
  intervalSecs?: number;
  intervalPowerWatts?: number;
  restSecs?: number;
  cooldownSecs?: number;
};

export function buildCyclingWorkout(args: CyclingWorkoutArgs): WorkoutPayload {
  const steps: WorkoutStep[] = [];
  let order = 1;

  if (!args.intervals) {
    steps.push(timeStep(1, 'interval', 3, args.simpleDurationSecs ?? 3600));
    return buildPayload(args.name, args.description ?? '', 2, 'cycling', steps);
  }

  if (args.warmupSecs) steps.push(timeStep(order++, 'warmup', 1, args.warmupSecs));

  if (args.intervalSecs) {
    const powerTarget = args.intervalPowerWatts
      ? { key: 'power.zone', id: 4, low: args.intervalPowerWatts * 0.95, high: args.intervalPowerWatts * 1.05 }
      : { key: 'no.target', id: 1, low: null, high: null };

    const iSteps: WorkoutStep[] = [
      timeStep(1, 'interval', 3, args.intervalSecs, powerTarget.key, powerTarget.id, powerTarget.low, powerTarget.high),
    ];
    if (args.restSecs) iSteps.push(timeStep(2, 'recovery', 4, args.restSecs));
    steps.push(repeatGroup(order++, args.intervals, iSteps));
  }

  if (args.cooldownSecs) steps.push(timeStep(order++, 'cooldown', 2, args.cooldownSecs));

  return buildPayload(args.name, args.description ?? '', 2, 'cycling', steps);
}
