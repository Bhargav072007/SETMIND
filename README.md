# SETMIND — Pro DJ AI Brain

> **Hackathon submission** · Crusoe Cloud (Nemotron Agent) + Lark CLI/MCP (Best Use)

An AI-powered professional DJ workflow tool built for **club and festival DJs**. SETMIND uses NVIDIA Nemotron running on Crusoe Cloud Managed Inference as its reasoning brain, with a Lark-powered CI/MCP layer for workflow validation and developer tooling.

---

## What it does

### 1. Set Architect
Generate a full professional DJ set plan from a single command. Nemotron builds a 5-phase energy arc (Warm Up → Build → Peak → Second Wind → Close) with BPM ranges, example tracks, crowd-reading tips, and emergency pivot strategies.

```bash
setmind plan --venue club --crowd "500 aged 22-30" --duration 90 --genre techno --peak 2am
```

### 2. Crowd Pulse
Real-time crowd analysis mid-set. Tell SETMIND what's playing, the BPM, and how the crowd is reacting — Nemotron analyzes the moment and returns the next 3 track suggestions, an energy directive (PUSH / HOLD / PULL BACK / PIVOT), and a specific transition tip.

```bash
setmind pulse --track "Spastik - Plastikman" --bpm 132 --energy 4 --reaction "people leaving floor" --minutes 60
```

### 3. Track Brain
Upload your rekordbox/Serato library as a text file — Nemotron analyzes your collection, builds the optimal track sequence, identifies library gaps, and flags tracks that would kill the current momentum.

```bash
setmind brain --file ~/my-library.txt --bpm 128-134 --energy 8 --key Cm
```

### 4. Live TUI Dashboard
A beautiful terminal dashboard (built with blessed + blessed-contrib) showing real-time crowd momentum, energy arc, next track suggestions, and system log — all powered by Nemotron.

```bash
setmind tui
```

### 5. Lark CI/MCP Integration
SETMIND uses Lark to create, manage, and run automated validation workflows for every AI-generated set plan. This ensures the Nemotron agent's outputs meet professional DJ standards before they reach the decks.

```bash
setmind lark bootstrap   # Create all Lark test workflows
setmind lark run         # Run all workflows via Lark CLI
setmind lark list        # List all workflows
setmind plan --lark      # Generate set + auto-create Lark validation
```

---

## Architecture

```
DJ Input (CLI / TUI)
       │
       ▼
  Lark CLI/MCP ──── Workflow Validation ──── Lark Dashboard
       │
       ▼
  SETMIND Agent (Hermes-style Nemotron prompt)
       │
       ▼
  Crusoe Cloud Managed Inference
  model: hack-crusoe/Nemotron-3-Nano-30B-A3B-FP8
       │
       ▼
  Structured JSON Response
  (Set Plan / Crowd Pulse / Track Brain)
       │
       ▼
  TUI Dashboard / CLI Output
```

---

## Why this wins both tracks

**Crusoe track** — SETMIND is a full Hermes-style agentic workflow. The system prompt uses structured capability tags (`[CAPABILITY: SET_PLAN]`, `[CAPABILITY: CROWD_PULSE]`, `[CAPABILITY: TRACK_BRAIN]`) that guide Nemotron through multi-step reasoning before producing structured JSON. This is exactly the Hermes/NemoClaw agent pattern — not just a chatbot, but a tool-using reasoning agent.

**Lark track** — SETMIND uses Lark CLI to create, manage, and run AI-driven validation workflows for every DJ set generated. The Lark MCP server integrates directly into the agent loop. Every set plan auto-generates a corresponding Lark test workflow that validates the output meets professional standards.

---

## Setup

```bash
# Clone and install
git clone https://github.com/your-repo/setmind
cd setmind
npm install

# Configure API keys
cp .env.example .env
# Add your CRUSOE_API_KEY and GETLARK_API_KEY

# Run demo (no API keys needed)
node bin/setmind.js demo

# Or install globally
npm install -g .
setmind demo
setmind plan --venue festival --genre techno
setmind tui
```

---

## Tech stack

| Layer | Tech |
|---|---|
| AI Brain | NVIDIA Nemotron-3-Nano-30B-A3B-FP8 |
| Inference | Crusoe Cloud Managed Inference |
| Agent Pattern | Hermes-style structured prompting |
| CLI Framework | Commander.js |
| Terminal UI | blessed + blessed-contrib |
| CI/Workflow | Lark CLI + Lark MCP |
| Runtime | Node.js 18+ |

---

## Contact

Built for the Crusoe + Lark Hackathon 2026.
