# garmin-workout-mcp

An MCP (Model Context Protocol) server that lets Claude create and schedule structured workouts directly in Garmin Connect.

## What it does

Talk to Claude naturally and it will create workouts in your Garmin calendar:

> *"Create an interval workout: 10 min warmup, 8x400m at 4:20/km pace with 90s recovery, 10 min cooldown. Schedule it for next Tuesday."*

> *"Add a simple 45-minute easy run for tomorrow."*

## Tools available

| Tool | Description |
|---|---|
| `create_running_workout` | Creates a running workout (simple or structured with intervals) |
| `create_cycling_workout` | Creates a cycling workout (simple or structured with power targets) |
| `list_workouts` | Lists all saved workouts |
| `schedule_workout` | Schedules a workout on a specific date |
| `delete_workout` | Deletes a workout |

## Setup

### 1. Add to Claude Desktop

Open your `claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "garmin-workouts": {
      "command": "npx",
      "args": ["-y", "garmin-workout-mcp"],
      "env": {
        "GARMIN_EMAIL": "your@email.com",
        "GARMIN_PASSWORD": "yourpassword"
      }
    }
  }
}
```

**Config file locations:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

### 2. Restart Claude Desktop

That's it! Claude will now have access to your Garmin workouts.

## Usage examples

**Simple run:**
> "Add a 45-minute easy run for tomorrow"

**Interval workout:**
> "Create 8x400m intervals at 4:20/km pace with 90 seconds rest, 10 min warmup and cooldown"

**Cycling:**
> "Create a 1-hour endurance ride"

**Schedule:**
> "Schedule workout ID 12345 for next Monday"

## Notes

- Authentication tokens are stored in `~/.garmin-mcp/` (shared with [@nicolasvegam/garmin-connect-mcp](https://github.com/nicolasvegam/garmin-connect-mcp) if you use both)
- MFA accounts: first login will fail if MFA is enabled — disable app-based MFA temporarily or use an app-specific password

## License

MIT
