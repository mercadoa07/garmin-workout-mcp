#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GarminAuth } from './auth.js';
import { buildRunningWorkout, buildCyclingWorkout, type RunningWorkoutArgs, type CyclingWorkoutArgs } from './workouts.js';

const GARMIN_EMAIL = process.env.GARMIN_EMAIL;
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD;

if (!GARMIN_EMAIL || !GARMIN_PASSWORD) {
  console.error(
    'Error: GARMIN_EMAIL and GARMIN_PASSWORD environment variables are required.\n\n' +
    'Add this to your Claude Desktop config:\n\n' +
    '  claude mcp add garmin-workouts \\\n' +
    '    -e GARMIN_EMAIL=you@email.com \\\n' +
    '    -e GARMIN_PASSWORD=yourpassword \\\n' +
    '    -- npx -y garmin-workout-mcp',
  );
  process.exit(1);
}

const auth = new GarminAuth(GARMIN_EMAIL, GARMIN_PASSWORD);

async function garminRequest<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  return auth.request<T>(endpoint, { method, body });
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'garmin-workout-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_running_workout',
      description:
        'Creates a running workout in Garmin Connect. Supports simple runs (just duration or distance) and structured workouts with warmup, intervals and cooldown.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Workout name (e.g. "Easy 45min run" or "8x400m intervals")' },
          description: { type: 'string', description: 'Optional description' },
          simpleDurationSecs: { type: 'number', description: 'For simple runs: total duration in seconds (e.g. 2700 = 45 min)' },
          simpleDistanceMeters: { type: 'number', description: 'For simple runs: total distance in meters (e.g. 10000 = 10km)' },
          warmupSecs: { type: 'number', description: 'Warm-up duration in seconds' },
          intervals: { type: 'number', description: 'Number of interval repetitions' },
          intervalDistanceMeters: { type: 'number', description: 'Distance per interval in meters (e.g. 400)' },
          intervalPaceMinPerKm: { type: 'number', description: 'Target pace in min/km (e.g. 4.5 = 4:30/km)' },
          restSecs: { type: 'number', description: 'Recovery duration between intervals in seconds' },
          cooldownSecs: { type: 'number', description: 'Cool-down duration in seconds' },
        },
        required: ['name'],
      },
    },
    {
      name: 'create_cycling_workout',
      description:
        'Creates a cycling workout in Garmin Connect. Supports simple rides and structured workouts with warmup, intervals and cooldown.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Workout name' },
          description: { type: 'string', description: 'Optional description' },
          simpleDurationSecs: { type: 'number', description: 'For simple rides: total duration in seconds' },
          warmupSecs: { type: 'number', description: 'Warm-up duration in seconds' },
          intervals: { type: 'number', description: 'Number of interval repetitions' },
          intervalSecs: { type: 'number', description: 'Duration per interval in seconds' },
          intervalPowerWatts: { type: 'number', description: 'Target power in watts' },
          restSecs: { type: 'number', description: 'Recovery duration between intervals in seconds' },
          cooldownSecs: { type: 'number', description: 'Cool-down duration in seconds' },
        },
        required: ['name'],
      },
    },
    {
      name: 'list_workouts',
      description: 'Lists all saved workouts in Garmin Connect',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'schedule_workout',
      description: 'Schedules an existing workout on a specific date in the Garmin calendar',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workoutId: { type: 'string', description: 'Workout ID (from list_workouts or returned when creating)' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (e.g. "2024-12-25")' },
        },
        required: ['workoutId', 'date'],
      },
    },
    {
      name: 'delete_workout',
      description: 'Deletes a workout from Garmin Connect',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workoutId: { type: 'string', description: 'Workout ID to delete' },
        },
        required: ['workoutId'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'create_running_workout') {
      const workout = buildRunningWorkout(args as RunningWorkoutArgs);
      const result = await garminRequest<{ workoutName: string; workoutId: string }>(
        '/workout-service/workout',
        'POST',
        workout,
      );
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Workout created!\n\nName: ${result.workoutName}\nID: ${result.workoutId}\n\nUse schedule_workout with this ID to add it to your calendar.`,
        }],
      };
    }

    if (name === 'create_cycling_workout') {
      const workout = buildCyclingWorkout(args as CyclingWorkoutArgs);
      const result = await garminRequest<{ workoutName: string; workoutId: string }>(
        '/workout-service/workout',
        'POST',
        workout,
      );
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Workout created!\n\nName: ${result.workoutName}\nID: ${result.workoutId}\n\nUse schedule_workout with this ID to add it to your calendar.`,
        }],
      };
    }

    if (name === 'list_workouts') {
      const workouts = await garminRequest<{ workoutName: string; workoutId: string; sportType?: { sportTypeKey: string } }[]>(
        '/workout-service/workouts?start=0&limit=50&myWorkoutsOnly=true',
      );
      if (!workouts?.length) {
        return { content: [{ type: 'text' as const, text: 'No saved workouts found.' }] };
      }
      const list = workouts.map((w) => `• ${w.workoutName} (ID: ${w.workoutId}) — ${w.sportType?.sportTypeKey ?? '?'}`).join('\n');
      return { content: [{ type: 'text' as const, text: `Saved workouts (${workouts.length}):\n\n${list}` }] };
    }

    if (name === 'schedule_workout') {
      const { workoutId, date } = args as { workoutId: string; date: string };
      await garminRequest(`/workout-service/schedule/${workoutId}`, 'POST', { date });
      return { content: [{ type: 'text' as const, text: `✅ Workout scheduled for ${date}.` }] };
    }

    if (name === 'delete_workout') {
      const { workoutId } = args as { workoutId: string };
      await garminRequest(`/workout-service/workout/${workoutId}`, 'DELETE');
      return { content: [{ type: 'text' as const, text: `✅ Workout ${workoutId} deleted.` }] };
    }

    return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
