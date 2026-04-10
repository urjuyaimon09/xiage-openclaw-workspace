# Ralph Loop

## Overview

This skill guides OpenClaw agents to execute Ralph Loop workflows using the exec and process tools. The agent orchestrates AI coding agent sessions following the Ralph playbook flow:

- Define Requirements → JTBD → Focus Topics → specs/*.md

- PLANNING Loop → Create/update IMPLEMENTATION_PLAN.md (do not implement)

- BUILDING Loop → Implement tasks, run tests (backpressure), update plan, commit

The loop persists context via PROMPT.md + AGENTS.md (loaded each iteration) and the plan/specs on disk.

## How This Skill Works

This skill generates instructions for OpenClaw agents to execute Ralph Loops using the exec and process tools.

- The agent calls exec tool with the coding agent command

- Uses pty: true to provide TTY for interactive CLIs

- Uses background: true for monitoring capabilities

- Uses process tool to monitor progress and detect completion

Important: Users don't run these scripts directly - the OpenClaw agent executes them using its tool capabilities.

## TTY Requirements

Some coding agents require a real terminal (TTY) to work properly, or they will hang:

Interactive CLIs (need TTY):
- OpenCode, Codex, Claude Code, Pi, Goose

Non-interactive CLIs (file-based):
- aider, custom scripts

Solution: Use exec + process mode for interactive CLIs, simple loops for file-based tools.

## Agent Tool Usage Patterns

### Interactive CLIs (Recommended Pattern)

For OpenCode, Codex, Claude Code, Pi, and Goose - these require TTY support:

When I (the agent) receive a Ralph Loop request, I will:

- Use exec tool to launch the coding agent:
  exec tool with parameters:
  - command: "opencode run --model \"$(cat PROMPT.md)\""
  - workdir:
  - background: true
  - pty: true
  - yieldMs: 60000
  - timeout: 3600

- Capture session ID from exec tool response

- Use process tool to monitor:
  process tool with:
  - action: "poll"
  - sessionId:
  process tool with:
  - action: "log"
  - sessionId:
  - offset: -30 (for recent output)

- Check completion by reading IMPLEMENTATION_PLAN.md for sentinel text

- Clean up with process kill if needed:
  process tool with:
  - action: "kill"
  - sessionId:

Benefits: TTY support, real-time logs, timeout handling, parallel sessions, workdir isolation
