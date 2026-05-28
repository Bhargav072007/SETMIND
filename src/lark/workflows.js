'use strict';
require('dotenv').config();
const { execSync } = require('child_process');
const fetch = require('node-fetch');

const LARK_KEY = process.env.GETLARK_API_KEY || '';
const LARK_MCP = process.env.GETLARK_MCP_URL || 'https://api.getlark.ai/mcp';

/**
 * Run a Lark CLI command and return stdout
 */
function larkCLI(cmd) {
  try {
    const result = execSync(
      `GETLARK_API_KEY=${LARK_KEY} npx -y @getlark/cli ${cmd} 2>&1`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return { success: true, output: result.trim() };
  } catch (err) {
    return { success: false, output: err.stdout || err.message };
  }
}

/**
 * Create a Lark workflow to test a DJ set plan
 * This validates that the AI-generated set meets pro standards
 */
async function createSetValidationWorkflow(setTitle, energyArc) {
  const description = `
    Validate the SETMIND DJ set plan titled "${setTitle}".
    Verify that:
    1. The energy arc has ${energyArc.length} phases (warm up → build → peak → second wind → close)
    2. BPM ranges are musically coherent and progressive
    3. Each phase has example tracks provided
    4. Emergency pivot strategies are actionable
    5. The set duration totals correctly
    The set phases are: ${energyArc.map(p => p.phase).join(' → ')}
  `.trim();

  return larkCLI(
    `workflows create --name "SETMIND: Validate ${setTitle.slice(0, 40)}" --description "${description.replace(/"/g, "'")}" --mode ai_driven`
  );
}

/**
 * Create a Lark workflow to test the Crowd Pulse feature
 */
async function createCrowdPulseWorkflow() {
  const description = `
    Test the SETMIND Crowd Pulse feature end-to-end.
    1. Simulate a crowd state: energy level 4, crowd reaction "losing energy", 45 minutes into a 90-minute set
    2. Call the Crowd Pulse API with these parameters
    3. Verify the response contains: crowdState, momentumScore, nextThreeTracks (3 tracks), energyDirective
    4. Verify energyDirective is one of: HOLD, PUSH, PULL BACK, PIVOT
    5. Verify nextThreeTracks contains valid track suggestions with BPM values
  `.trim();

  return larkCLI(
    `workflows create --name "SETMIND: Crowd Pulse E2E Test" --description "${description.replace(/"/g, "'")}" --mode deterministic`
  );
}

/**
 * Create a full SETMIND workflow group and test suite via Lark
 */
async function bootstrapLarkWorkflows() {
  const results = [];

  // Create workflow group
  const group = larkCLI(`workflow-groups create --name "SETMIND Pro DJ Suite"`);
  results.push({ step: 'Create workflow group', ...group });

  // Create core test workflows
  const workflows = [
    {
      name: 'SETMIND: Set Plan Generation',
      description: 'Test that the Set Architect generates a valid 5-phase DJ set plan. Input: venue=club, crowd=500 aged 22-30, duration=90, genre=techno, peakTime=2am, role=headliner. Verify response has energyArc with 5 phases, BPM ranges, example tracks, and emergency pivots.'
    },
    {
      name: 'SETMIND: Crowd Pulse Real-Time',
      description: 'Test the Crowd Pulse with a fading crowd scenario. Input: currentTrack=some techno track, bpm=132, energyLevel=3, crowdReaction=people leaving floor, minutesIntoSet=60, totalDuration=90. Verify: energyDirective=PIVOT, nextThreeTracks has 3 suggestions, urgentAlert is not null.'
    },
    {
      name: 'SETMIND: Track Brain Library Analysis',
      description: 'Test Track Brain with a 10-track library at targetBpm=128-134, targetEnergy=8, currentKey=Cm. Verify response has topPicks (3 tracks), libraryGaps (at least 1), powerSequence (5 tracks), avoidNow list.'
    },
    {
      name: 'SETMIND: Nemotron API Health',
      description: 'Test connectivity to Crusoe Cloud Nemotron inference endpoint. Send a minimal request and verify: HTTP 200 response, response contains choices array, content is valid JSON, model field matches expected Nemotron model string.'
    },
    {
      name: 'SETMIND: Full Gig Workflow',
      description: 'End-to-end test of a full gig workflow. Step 1: Generate a set plan for a 2-hour club set. Step 2: Run 3 crowd pulse checks at 30min, 60min, 90min intervals. Step 3: Verify energy arc progresses correctly. Step 4: Confirm all API responses are under 3 seconds.'
    }
  ];

  for (const wf of workflows) {
    const result = larkCLI(
      `workflows create --name "${wf.name}" --description "${wf.description.replace(/"/g, "'")}" --mode ai_driven`
    );
    results.push({ step: wf.name, ...result });
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

/**
 * Run all SETMIND Lark workflows and return results
 */
function runAllWorkflows() {
  return larkCLI('workflows invoke --all --wait --timeout 300 --verbose');
}

/**
 * List all SETMIND workflows
 */
function listWorkflows() {
  return larkCLI('workflows list --limit 20');
}

/**
 * MCP tool call — for AI agent integration
 */
async function mcpCall(toolName, params) {
  if (!LARK_KEY || LARK_KEY === 'your_lark_api_key_here') {
    return { error: 'GETLARK_API_KEY not set — add it to .env to use MCP features' };
  }

  const res = await fetch(`${LARK_MCP}?api_key=${LARK_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, params })
  });

  return res.json();
}

module.exports = {
  createSetValidationWorkflow,
  createCrowdPulseWorkflow,
  bootstrapLarkWorkflows,
  runAllWorkflows,
  listWorkflows,
  larkCLI,
  mcpCall
};
