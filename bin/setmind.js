#!/usr/bin/env node
'use strict';
require('dotenv').config();
const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { planSet, crowdPulse, trackBrain } = require('../src/agent/nemotron');
const { bootstrapLarkWorkflows, runAllWorkflows, listWorkflows, createSetValidationWorkflow } = require('../src/lark/workflows');
const { launchTUI } = require('../src/tui/dashboard');

const program = new Command();

const banner = `
${chalk.red('╔══════════════════════════════════════╗')}
${chalk.red('║')}  ${chalk.bold.white('SETMIND')}  ${chalk.gray('Pro DJ AI Brain')}           ${chalk.red('║')}
${chalk.red('║')}  ${chalk.gray('Nemotron · Crusoe Cloud · Lark MCP')}   ${chalk.red('║')}
${chalk.red('╚══════════════════════════════════════╝')}
`;

program
  .name('setmind')
  .description('AI-powered Pro DJ workflow tool — Nemotron on Crusoe + Lark CLI/MCP')
  .version('1.0.0')
  .hook('preAction', () => console.log(banner));

// ── TUI Dashboard ──
program
  .command('tui')
  .description('Launch the live TUI dashboard (real-time crowd pulse + set control)')
  .action(async () => {
    await launchTUI();
  });

// ── Set Plan ──
program
  .command('plan')
  .description('Generate a full DJ set plan with energy arc')
  .option('-v, --venue <type>', 'Venue type (club/festival/warehouse/rooftop)', 'club')
  .option('-c, --crowd <desc>', 'Crowd description', '300 people aged 22-30')
  .option('-d, --duration <mins>', 'Set duration in minutes', '90')
  .option('-g, --genre <genre>', 'Primary genre', 'techno')
  .option('-p, --peak <time>', 'Peak time of night', '2am')
  .option('-r, --role <role>', 'opener or headliner', 'headliner')
  .option('--lark', 'Create a Lark validation workflow for this set plan')
  .action(async (opts) => {
    const spinner = ora({ text: chalk.gray('Nemotron is architecting your set...'), color: 'red' }).start();
    try {
      const plan = await planSet({
        venue: opts.venue,
        crowd: opts.crowd,
        duration: parseInt(opts.duration),
        genre: opts.genre,
        peakTime: opts.peak,
        openerOrHeadliner: opts.role
      });

      spinner.succeed(chalk.red.bold('Set plan ready'));
      console.log();
      console.log(chalk.bold.white(`  ${plan.setTitle}`));
      console.log(chalk.gray('  ─'.repeat(30)));
      console.log();

      // Energy arc
      console.log(chalk.red('  ENERGY ARC'));
      (plan.energyArc || []).forEach((phase, i) => {
        const bar = '█'.repeat(phase.energy) + '░'.repeat(10 - phase.energy);
        console.log(`\n  ${chalk.bold(phase.phase.padEnd(14))} ${chalk.gray(phase.bpmRange + ' BPM')}  E: ${chalk.red(bar)} ${phase.energy}/10`);
        console.log(chalk.gray(`  ${phase.description}`));
        if (phase.exampleTracks?.length) {
          phase.exampleTracks.forEach(t => console.log(chalk.gray(`    · ${t}`)));
        }
      });

      console.log();
      if (plan.crowdReadingTips?.length) {
        console.log(chalk.red('  CROWD TIPS'));
        plan.crowdReadingTips.forEach(t => console.log(chalk.gray(`  · ${t}`)));
      }

      console.log();
      if (plan.emergencyPivots?.length) {
        console.log(chalk.red('  EMERGENCY PIVOTS'));
        plan.emergencyPivots.forEach(p =>
          console.log(chalk.gray(`  · ${chalk.yellow(p.signal)} → ${p.action}`))
        );
      }

      // Optionally create Lark validation workflow
      if (opts.lark) {
        console.log();
        const larkSpinner = ora({ text: chalk.gray('Creating Lark validation workflow...'), color: 'red' }).start();
        const result = await createSetValidationWorkflow(plan.setTitle, plan.energyArc || []);
        if (result.success) {
          larkSpinner.succeed(chalk.gray('Lark workflow created: ' + result.output.split('\n')[0]));
        } else {
          larkSpinner.fail(chalk.gray('Lark: ' + result.output.slice(0, 100)));
        }
      }

    } catch (err) {
      spinner.fail(chalk.red('Error: ' + err.message));
      process.exit(1);
    }
  });

// ── Crowd Pulse ──
program
  .command('pulse')
  .description('Real-time crowd analysis — get next track suggestions')
  .option('-t, --track <name>', 'Current track playing', 'Unknown Track')
  .option('-b, --bpm <bpm>', 'Current BPM', '128')
  .option('-e, --energy <level>', 'Energy level 1-10', '5')
  .option('-r, --reaction <desc>', 'Crowd reaction', 'moderate energy')
  .option('-m, --minutes <mins>', 'Minutes into set', '45')
  .option('-D, --duration <mins>', 'Total set duration', '90')
  .option('-g, --genre <genre>', 'Genre', 'techno')
  .action(async (opts) => {
    const spinner = ora({ text: chalk.gray('Reading the room via Nemotron...'), color: 'red' }).start();
    try {
      const result = await crowdPulse({
        currentTrack: opts.track,
        currentBpm: parseInt(opts.bpm),
        energyLevel: parseInt(opts.energy),
        crowdReaction: opts.reaction,
        minutesIntoSet: parseInt(opts.minutes),
        totalDuration: parseInt(opts.duration),
        genre: opts.genre,
        lastFiveTracks: ['Track A', 'Track B', 'Track C', 'Track D', opts.track]
      });

      const directiveColors = { PUSH: 'green', HOLD: 'yellow', 'PULL BACK': 'cyan', PIVOT: 'red' };
      const dColor = directiveColors[result.energyDirective] || 'white';

      spinner.succeed(chalk.red.bold('Crowd Pulse complete'));
      console.log();
      console.log(`  State:      ${chalk.bold(result.crowdState?.toUpperCase())}`);
      console.log(`  Momentum:   ${chalk.red('█'.repeat(result.momentumScore || 0))}${'░'.repeat(10 - (result.momentumScore || 0))} ${result.momentumScore}/10`);
      console.log(`  Directive:  ${chalk[dColor].bold(result.energyDirective)}`);
      console.log();
      console.log(chalk.gray(`  ${result.analysis}`));
      console.log();

      if (result.nextThreeTracks?.length) {
        console.log(chalk.red('  NEXT TRACKS'));
        result.nextThreeTracks.forEach((t, i) => {
          console.log(`\n  ${chalk.white((i + 1) + '. ' + t.track)}`);
          console.log(chalk.gray(`     ${t.bpm} BPM · ${t.reason}`));
        });
      }

      console.log();
      if (result.transitionTip) {
        console.log(chalk.red('  TRANSITION TIP'));
        console.log(chalk.gray(`  ${result.transitionTip}`));
      }

      if (result.urgentAlert) {
        console.log();
        console.log(chalk.bgRed.white.bold(`  ⚠ ALERT: ${result.urgentAlert}  `));
      }

    } catch (err) {
      spinner.fail(chalk.red('Error: ' + err.message));
      process.exit(1);
    }
  });

// ── Track Brain ──
program
  .command('brain')
  .description('Analyze your track library and get smart pairing suggestions')
  .option('-f, --file <path>', 'Path to track list (one per line)', null)
  .option('-b, --bpm <range>', 'Target BPM range', '128-134')
  .option('-e, --energy <level>', 'Target energy level 1-10', '8')
  .option('-k, --key <key>', 'Current key', 'Cm')
  .action(async (opts) => {
    let tracks = [
      'Alignment - BICEP', 'Glue - Bicep', 'Strings of Life - Rhythim Is Rhythim',
      'Promised Land - Joe Smooth', 'Can You Feel It - Larry Heard',
      'Your Love - Jamie Principle', 'Mystery of Love - Frankie Knuckles',
      'Ride - Rivo', 'Cascade - Floating Points', 'LFO - LFO',
      'Spastik - Plastikman', 'Windowlicker - Aphex Twin'
    ];

    if (opts.file) {
      try {
        const fs = require('fs');
        tracks = fs.readFileSync(opts.file, 'utf8').split('\n').filter(Boolean);
      } catch { console.log(chalk.gray('  Could not read file, using demo library')); }
    }

    const spinner = ora({ text: chalk.gray(`Analyzing ${tracks.length} tracks via Nemotron...`), color: 'red' }).start();
    try {
      const result = await trackBrain({
        tracks,
        targetBpm: opts.bpm,
        targetEnergy: parseInt(opts.energy),
        currentKey: opts.key
      });

      spinner.succeed(chalk.red.bold('Track Brain analysis complete'));
      console.log();

      if (result.topPicks?.length) {
        console.log(chalk.red('  TOP PICKS'));
        result.topPicks.forEach(p => {
          console.log(`\n  ${chalk.white(p.track)}`);
          console.log(chalk.gray(`  Score: ${'★'.repeat(Math.round((p.compatibilityScore || 7) / 2))}  ${p.reason}`));
        });
      }

      console.log();
      if (result.powerSequence?.length) {
        console.log(chalk.red('  POWER SEQUENCE'));
        result.powerSequence.forEach((t, i) =>
          console.log(chalk.gray(`  ${i + 1}. ${t}`))
        );
      }

      console.log();
      if (result.libraryGaps?.length) {
        console.log(chalk.red('  LIBRARY GAPS'));
        result.libraryGaps.forEach(g => console.log(chalk.gray(`  · ${g}`)));
      }

    } catch (err) {
      spinner.fail(chalk.red('Error: ' + err.message));
      process.exit(1);
    }
  });

// ── Lark Workflows ──
program
  .command('lark')
  .description('Manage Lark CI/MCP workflows for SETMIND')
  .addCommand(
    new Command('bootstrap')
      .description('Create all SETMIND test workflows in Lark')
      .action(async () => {
        console.log(chalk.gray('\n  Bootstrapping SETMIND Lark workflow suite...\n'));
        const results = await bootstrapLarkWorkflows();
        results.forEach(r => {
          const icon = r.success ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${icon} ${chalk.gray(r.step)}`);
          if (!r.success) console.log(chalk.gray(`    ${r.output.slice(0, 120)}`));
        });
        console.log();
        console.log(chalk.gray('  Run `setmind lark run` to execute all workflows'));
      })
  )
  .addCommand(
    new Command('run')
      .description('Run all SETMIND Lark workflows and wait for results')
      .action(() => {
        const spinner = ora({ text: chalk.gray('Running Lark workflows...'), color: 'red' }).start();
        const result = runAllWorkflows();
        if (result.success) {
          spinner.succeed(chalk.gray('All workflows passed'));
          console.log(chalk.gray(result.output));
        } else {
          spinner.fail(chalk.red('Some workflows failed'));
          console.log(chalk.gray(result.output.slice(0, 500)));
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all SETMIND Lark workflows')
      .action(() => {
        const result = listWorkflows();
        console.log(result.success
          ? chalk.gray(result.output)
          : chalk.red(result.output.slice(0, 300))
        );
      })
  );

// ── Demo mode (no API key needed) ──
program
  .command('demo')
  .description('Run a full demo with mocked responses (no API keys needed)')
  .action(async () => {
    console.log(chalk.gray('\n  Running SETMIND demo (mocked Nemotron responses)...\n'));

    const mockPlan = {
      setTitle: 'Midnight Architecture',
      energyArc: [
        { phase: 'Warm Up', bpmRange: '120-126', energy: 3, description: 'Subtle grooves, let the room fill', exampleTracks: ['Cascade - Floating Points', 'Glue - Bicep'] },
        { phase: 'Build', bpmRange: '126-132', energy: 6, description: 'Layering tension, deeper techno', exampleTracks: ['Alignment - Bicep', 'LFO - LFO'] },
        { phase: 'Peak', bpmRange: '132-138', energy: 9, description: 'Full peak hour — relentless, hypnotic', exampleTracks: ['Spastik - Plastikman', 'Strings of Life'] },
        { phase: 'Second Wind', bpmRange: '128-133', energy: 7, description: 'Give them a breath, then pull back in', exampleTracks: ['Promised Land - Joe Smooth'] },
        { phase: 'Close', bpmRange: '122-126', energy: 4, description: 'Emotional close, leave them wanting more', exampleTracks: ['Can You Feel It - Larry Heard'] }
      ],
      crowdReadingTips: [
        'Watch the perimeter — people drifting to the edges = energy dropping',
        'Arms in the air at peak = you can hold this longer than you think',
        'Check the bar queue length — long queue = they need a pivot'
      ],
      emergencyPivots: [
        { signal: 'crowd losing energy', action: 'Drop to 126 BPM, introduce a classic groove, rebuild from there' },
        { signal: 'crowd going too hard too early', action: 'Ride the energy for 2 more tracks then make a subtle key change to de-escalate' }
      ]
    };

    console.log(chalk.red.bold('  SET ARCHITECT — Midnight Architecture'));
    console.log(chalk.gray('  ─'.repeat(35)));
    mockPlan.energyArc.forEach(p => {
      const bar = '█'.repeat(p.energy) + '░'.repeat(10 - p.energy);
      console.log(`\n  ${chalk.bold(p.phase.padEnd(14))} ${chalk.gray(p.bpmRange + ' BPM')}  ${chalk.red(bar)} ${p.energy}/10`);
      console.log(chalk.gray(`  ${p.description}`));
      p.exampleTracks.forEach(t => console.log(chalk.gray(`    · ${t}`)));
    });

    console.log('\n' + chalk.red('  EMERGENCY PIVOTS'));
    mockPlan.emergencyPivots.forEach(p =>
      console.log(chalk.gray(`  · ${chalk.yellow(p.signal)} → ${p.action}`))
    );

    console.log('\n' + chalk.red('  CROWD PULSE (demo)'));
    console.log(chalk.gray('  State: BUILDING  ·  Momentum: ████████░░ 8/10'));
    console.log(chalk.green.bold('  Directive: PUSH'));
    console.log(chalk.gray('\n  Floor is responding — BPM has room to climb 2-3 more.'));
    console.log(chalk.gray('  Next: Spastik - Plastikman (132 BPM) — the crowd is primed'));

    console.log('\n' + chalk.gray('  ─'.repeat(35)));
    console.log(chalk.gray('  Run `setmind tui` for the live dashboard'));
    console.log(chalk.gray('  Run `setmind plan` for AI-generated set plans'));
    console.log(chalk.gray('  Run `setmind pulse` for real-time crowd analysis'));
    console.log(chalk.gray('  Run `setmind lark bootstrap` to set up Lark CI workflows\n'));
  });

// ── Health check ──
program
  .command('health')
  .description('Test the Nemotron / Crusoe Cloud connection')
  .action(async () => {
    const spinner = ora({ text: chalk.gray('Testing Nemotron connection…'), color: 'red' }).start();
    try {
      const fetch = require('node-fetch');
      const url = process.env.CRUSOE_API_URL || 'https://api.inference.crusoecloud.com/v1/chat/completions';
      const key = process.env.CRUSOE_API_KEY || '';
      const model = process.env.CRUSOE_MODEL || 'nvidia/Nemotron-3-Nano-30B-A3B';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] }),
        timeout: 8000
      });

      if (res.ok) {
        spinner.succeed(chalk.green('Nemotron connected ✓'));
        console.log(chalk.gray(`  Model: ${model}`));
        console.log(chalk.gray(`  Endpoint: ${url}`));
      } else {
        const err = await res.text();
        spinner.fail(chalk.red(`Nemotron error ${res.status}`));
        console.log(chalk.gray(`  ${err.slice(0, 200)}`));
      }
    } catch (err) {
      spinner.fail(chalk.red('Nemotron unreachable: ' + err.message));
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log(banner);
  program.outputHelp();
}
