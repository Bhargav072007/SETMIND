'use strict';
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const { crowdPulse, planSet } = require('../agent/nemotron');

const PHASES = ['Warm Up', 'Build', 'Peak', 'Second Wind', 'Close'];
const ENERGY_COLORS = ['white', 'cyan', 'green', 'yellow', 'red'];

function getEnergyBar(score) {
  const filled = Math.round((score / 10) * 20);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

function getDirectiveColor(directive) {
  const map = { 'PUSH': 'green', 'HOLD': 'yellow', 'PULL BACK': 'cyan', 'PIVOT': 'red' };
  return map[directive] || 'white';
}

async function launchTUI(opts = {}) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'SETMIND — Pro DJ AI Brain'
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  // ── Header banner ──
  const header = blessed.box({
    top: 0, left: 0, width: '100%', height: 3,
    content: ' {bold}SETMIND{/bold}  PRO DJ AI BRAIN  ·  Nemotron on Crusoe Cloud  ·  Lark CI/MCP',
    tags: true,
    style: { fg: 'white', bg: '#1a1a1a', border: { fg: '#fc3c44' } },
    border: { type: 'line' }
  });
  screen.append(header);

  // ── Energy arc gauge ──
  const energyGauge = grid.set(1, 0, 3, 4, contrib.gauge, {
    label: ' Energy Arc ',
    stroke: 'red',
    fill: 'white',
    border: { type: 'line', fg: '#333' }
  });

  // ── Crowd state spark line ──
  const sparkline = grid.set(1, 4, 3, 8, contrib.sparkline, {
    label: ' Crowd Momentum (last 10 reads) ',
    tags: true,
    style: { fg: 'red', titleFg: 'white' },
    border: { type: 'line', fg: '#333' }
  });

  // ── Now Playing ──
  const nowPlaying = grid.set(4, 0, 3, 6, blessed.box, {
    label: ' Now Playing ',
    border: { type: 'line', fg: '#333' },
    style: { fg: 'white' },
    padding: { left: 1, right: 1 },
    content: 'Press [P] to enter current track...'
  });

  // ── Crowd Pulse ──
  const pulseBox = grid.set(4, 6, 3, 6, blessed.box, {
    label: ' Crowd Pulse ',
    border: { type: 'line', fg: '#fc3c44' },
    style: { fg: 'white' },
    padding: { left: 1 },
    content: 'Press [Space] to run crowd pulse analysis...'
  });

  // ── Next Tracks ──
  const nextTracks = grid.set(7, 0, 4, 7, contrib.table, {
    keys: true,
    label: ' Next Track Suggestions ',
    columnSpacing: 2,
    columnWidth: [40, 6, 4, 30],
    border: { type: 'line', fg: '#333' },
    style: {
      header: { fg: 'red', bold: true },
      cell: { fg: 'white', selected: { bg: '#1a1a1a' } }
    }
  });
  nextTracks.setData({
    headers: ['Track', 'BPM', 'Fit', 'Reason'],
    data: [['—', '—', '—', 'Run crowd pulse to get suggestions']]
  });

  // ── Status log ──
  const log = grid.set(7, 7, 4, 5, contrib.log, {
    label: ' System Log ',
    border: { type: 'line', fg: '#333' },
    style: { fg: '#888', label: { fg: 'white' } }
  });

  // ── Controls footer ──
  const footer = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 1,
    content: ' [Space] Crowd Pulse  [P] Set Track  [S] Set Plan  [L] Lark Workflows  [Q] Quit',
    style: { fg: '#888', bg: '#111' }
  });
  screen.append(footer);

  screen.render();

  // State
  let momentumHistory = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  let currentPhaseIdx = 0;
  let currentTrack = 'Unknown Track';
  let currentBpm = 128;
  let minutesIntoSet = 0;
  let isLoading = false;

  function logMsg(msg) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    log.log(`{grey-fg}${time}{/} ${msg}`);
    screen.render();
  }

  function updateEnergyGauge(score) {
    energyGauge.setPercent(score * 10);
    screen.render();
  }

  function updateSparkline() {
    sparkline.setData(
      ['Momentum'],
      [momentumHistory]
    );
    screen.render();
  }

  // Initial state
  updateEnergyGauge(5);
  updateSparkline();
  logMsg('SETMIND initialized. Nemotron agent ready.');
  logMsg('Waiting for set data...');

  // ── Crowd Pulse handler ──
  async function runCrowdPulse() {
    if (isLoading) return;
    isLoading = true;
    logMsg('Running Crowd Pulse via Nemotron...');
    pulseBox.setContent(' {yellow-fg}Analyzing crowd...{/yellow-fg}');
    screen.render();

    try {
      const result = await crowdPulse({
        currentTrack,
        currentBpm,
        energyLevel: Math.round(momentumHistory[momentumHistory.length - 1]),
        crowdReaction: 'moderate energy, some dancing',
        minutesIntoSet,
        totalDuration: 90,
        genre: 'techno',
        lastFiveTracks: ['Track A', 'Track B', 'Track C', 'Track D', currentTrack]
      });

      // Update momentum
      momentumHistory.push(result.momentumScore || 5);
      if (momentumHistory.length > 10) momentumHistory.shift();
      updateSparkline();
      updateEnergyGauge(result.momentumScore || 5);

      // Update pulse box
      const dirColor = getDirectiveColor(result.energyDirective);
      pulseBox.setContent(
        ` State: {bold}${result.crowdState?.toUpperCase()}{/bold}\n` +
        ` Score: ${getEnergyBar(result.momentumScore || 5)} ${result.momentumScore}/10\n` +
        ` Directive: {${dirColor}-fg}{bold}${result.energyDirective}{/bold}{/}\n` +
        ` ${result.analysis}\n\n` +
        ` Transition: ${result.transitionTip || '—'}`
      );

      // Update next tracks table
      if (result.nextThreeTracks?.length) {
        nextTracks.setData({
          headers: ['Track', 'BPM', 'Fit', 'Reason'],
          data: result.nextThreeTracks.map(t => [
            t.track?.slice(0, 38) || '—',
            String(t.bpm || '—'),
            '★★★',
            (t.reason || '—').slice(0, 28)
          ])
        });
      }

      if (result.urgentAlert) logMsg(`⚠ ALERT: ${result.urgentAlert}`);
      logMsg(`Pulse complete. Directive: ${result.energyDirective}`);
      minutesIntoSet += 5;

    } catch (err) {
      pulseBox.setContent(` {red-fg}Error: ${err.message}{/red-fg}`);
      logMsg(`Error: ${err.message}`);
    }

    isLoading = false;
    screen.render();
  }

  // ── Set Plan handler ──
  async function runSetPlan() {
    if (isLoading) return;
    isLoading = true;
    logMsg('Generating set plan via Nemotron Set Architect...');
    nowPlaying.setContent(' {yellow-fg}Building your set plan...{/yellow-fg}');
    screen.render();

    try {
      const plan = await planSet({
        venue: 'club',
        crowd: '300-500, aged 22-30',
        duration: 90,
        genre: 'techno / dark electronica',
        peakTime: '2am',
        openerOrHeadliner: 'headliner'
      });

      nowPlaying.setContent(
        ` {bold}{red-fg}${plan.setTitle || 'Untitled Set'}{/}{/bold}\n\n` +
        (plan.energyArc || []).map((p, i) =>
          ` ${PHASES[i] || p.phase}: ${p.bpmRange} BPM  E:${p.energy}/10`
        ).join('\n')
      );

      if (plan.energyArc?.[0]) {
        updateEnergyGauge(plan.energyArc[0].energy);
      }

      logMsg(`Set plan ready: ${plan.setTitle}`);
      if (plan.crowdReadingTips) {
        plan.crowdReadingTips.forEach(tip => logMsg(`Tip: ${tip}`));
      }

    } catch (err) {
      nowPlaying.setContent(` {red-fg}Error: ${err.message}{/red-fg}`);
      logMsg(`Set plan error: ${err.message}`);
    }

    isLoading = false;
    screen.render();
  }

  // ── Key bindings ──
  screen.key(['space'], runCrowdPulse);
  screen.key(['s', 'S'], runSetPlan);
  screen.key(['q', 'Q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });
  screen.key(['p', 'P'], () => {
    const prompt = blessed.prompt({
      parent: screen,
      top: 'center', left: 'center',
      width: '50%', height: 'shrink',
      label: ' Enter current track (Name - Artist @ BPM) ',
      border: { type: 'line', fg: '#fc3c44' },
      style: { fg: 'white', bg: '#1a1a1a' }
    });
    prompt.input('Track:', '', (err, val) => {
      if (val) {
        const bpmMatch = val.match(/@\s*(\d+)/);
        currentTrack = val.replace(/@.*/, '').trim();
        if (bpmMatch) currentBpm = parseInt(bpmMatch[1]);
        nowPlaying.setContent(` {bold}${currentTrack}{/bold}\n ${currentBpm} BPM\n\nPress [Space] for crowd pulse`);
        logMsg(`Track set: ${currentTrack} @ ${currentBpm} BPM`);
        screen.render();
      }
    });
  });
  screen.key(['l', 'L'], () => {
    const { listWorkflows } = require('../lark/workflows');
    logMsg('Fetching Lark workflows...');
    const result = listWorkflows();
    logMsg(result.success ? 'Lark workflows fetched ✓' : `Lark error: ${result.output.slice(0, 80)}`);
  });

  screen.render();
  logMsg('Ready. [Space] = Crowd Pulse · [S] = Set Plan · [P] = Set Track');
}

module.exports = { launchTUI };
