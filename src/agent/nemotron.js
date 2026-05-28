'use strict';

require('dotenv').config();
const fetch = require('node-fetch');

const CRUSOE_API_URL = process.env.CRUSOE_API_URL || 'https://api.inference.crusoecloud.com/v1/chat/completions';
const CRUSOE_MODEL = process.env.CRUSOE_MODEL || 'hack-crusoe/Nemotron-3-Nano-30B-A3B-FP8';
const CRUSOE_API_KEY = process.env.CRUSOE_API_KEY || '42ffcJ8DTTyXkYJuqWWPeQ$2a$10$0yJ8QR8q0kPd.vo5thNGV.eOXwHcYR.BqVcyYKd.ghaZVaw8wGiEa';

const HERMES_SYSTEM = [
  'You are SETMIND, a professional AI DJ workflow agent for club and festival DJs.',
  'You use Hermes-style capability routing:',
  '[CAPABILITY: SET_PLAN] Create structured set plans.',
  '[CAPABILITY: CROWD_PULSE] Analyze current crowd state and next DJ moves.',
  '[CAPABILITY: TRACK_BRAIN] Analyze track libraries and compatibility.',
  '[CAPABILITY: DJ_PROMPT] Interpret free-form DJ instructions mid-set.',
  '[CAPABILITY: MIX_ENGINE] Design practical two-track transition plans for DJs.',
  'Reason internally step by step, then respond ONLY with valid JSON.',
  'Never include markdown, code fences, preamble, commentary, or explanation outside JSON.'
].join('\n');

function stripJsonFences(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonPayload(rawText) {
  const cleaned = stripJsonFences(rawText);
  try {
    return JSON.parse(cleaned);
  } catch (directError) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Nemotron returned invalid JSON: ${directError.message}`);
    }
    try {
      return JSON.parse(match[0]);
    } catch (fallbackError) {
      throw new Error(`Nemotron returned text that looked like JSON but could not be parsed: ${fallbackError.message}`);
    }
  }
}

function extractAssistantPayload(data) {
  const choice = data && data.choices && data.choices[0] ? data.choices[0] : null;
  const message = choice && choice.message ? choice.message : null;
  const content = message && typeof message.content === 'string' ? message.content : '';
  const reasoning = message && typeof message.reasoning === 'string' ? message.reasoning : '';
  const finishReason = choice && choice.finish_reason ? choice.finish_reason : '';
  return {
    content,
    reasoning,
    finishReason
  };
}

async function callNemotron(userPrompt, maxTokens = 800) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const attemptTokens = Math.min(2400, Math.max(maxTokens, maxTokens + (attempt - 1) * 400));
      const response = await fetch(CRUSOE_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRUSOE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: CRUSOE_MODEL,
          max_tokens: attemptTokens,
          messages: [
            { role: 'system', content: HERMES_SYSTEM },
            { role: 'user', content: userPrompt }
          ]
        }),
        timeout: 30000
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Crusoe Nemotron HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const extracted = extractAssistantPayload(data);
      const content = extracted.content || (data && data.content && data.content[0] && data.content[0].text ? data.content[0].text : '');

      if (!content) {
        if (extracted.finishReason === 'length') {
          throw new Error(`Crusoe Nemotron response hit token limit before final content. finish_reason=${extracted.finishReason}`);
        }
        if (extracted.reasoning) {
          return parseJsonPayload(extracted.reasoning);
        }
        throw new Error('Crusoe Nemotron response did not include message content.');
      }

      return parseJsonPayload(content);
    } catch (error) {
      lastError = error;
      console.error(`Nemotron attempt ${attempt} failed: ${error.message}`);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`Nemotron failed after 3 attempts using ${CRUSOE_MODEL} at ${CRUSOE_API_URL}: ${lastError.message}`);
}

async function planSet(params) {
  const prompt = [
    '[CAPABILITY: SET_PLAN]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"setTitle":"string","energyArc":[{"phase":"string","duration":"string","bpmRange":"string","energy":1,"description":"string","exampleTracks":["real song","real song"]}],"crowdReadingTips":["string","string","string"],"emergencyPivots":[{"signal":"string","action":"string"},{"signal":"string","action":"string"}]}',
    'energyArc must contain exactly 5 phases.',
    'Keep every field concise. Descriptions must stay under 18 words and example track names must be short.'
  ].join('\n');
  return callNemotron(prompt, 1600);
}

async function crowdPulse(params) {
  const prompt = [
    '[CAPABILITY: CROWD_PULSE]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"crowdState":"one word","momentumScore":1,"analysis":"two sentences","nextThreeTracks":[{"track":"Artist - Title","bpm":128,"reason":"string"}],"energyDirective":"HOLD","urgentAlert":null,"transitionTip":"string"}',
    'nextThreeTracks must contain exactly 3 items. energyDirective must be HOLD, PUSH, PULL BACK, or PIVOT.'
  ].join('\n');
  return callNemotron(prompt, 650);
}

async function trackBrain(params) {
  const prompt = [
    '[CAPABILITY: TRACK_BRAIN]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"topPicks":[{"track":"Artist - Title","compatibilityScore":1,"reason":"string"}],"libraryGaps":["string"],"powerSequence":["track","track","track","track","track"],"avoidNow":["string"]}',
    'topPicks must contain exactly 3 items.'
  ].join('\n');
  return callNemotron(prompt, 650);
}

async function promptDj(params) {
  const prompt = [
    '[CAPABILITY: DJ_PROMPT]',
    'Interpret this free-form DJ request and return practical playlist changes.',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"response":"string","suggestedTracks":[{"track":"Track Title - Artist","bpm":130,"reason":"string"}],"action":"PUSH"}',
    'Suggest 2 to 4 tracks. action must be one of PUSH, HOLD, PULL BACK, PIVOT, SEARCH.'
  ].join('\n');
  return callNemotron(prompt, 700);
}

async function planMixTransition(params) {
  const prompt = [
    '[CAPABILITY: MIX_ENGINE]',
    'You are planning a real DJ transition between two loaded decks.',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"headline":"string","targetDeck":"A or B","mode":"smooth or tight or hard","triggerPoint":0.72,"outgoingStartProgress":0.68,"outgoingEndProgress":0.9,"crossfadeSeconds":8,"targetBpm":128,"incomingCueStart":0.04,"phraseBars":16,"mixOnBar":12,"mixOnBeat":1,"entryPhraseBar":1,"preparation":["string","string"],"reasoning":"string","confidence":0.88}',
    'Rules:',
    '- triggerPoint must be between 0.55 and 0.9.',
    '- outgoingStartProgress must be between 0.55 and 0.9.',
    '- outgoingEndProgress must be between outgoingStartProgress and 0.99.',
    '- crossfadeSeconds must be between 2 and 12.',
    '- incomingCueStart must be between 0 and 0.24.',
    '- phraseBars must be 8, 16, or 32.',
    '- mixOnBar must be between 1 and phraseBars.',
    '- mixOnBeat must be 1, 2, 3, or 4.',
    '- entryPhraseBar must be between 1 and phraseBars.',
    '- preparation must contain 2 or 3 short steps.',
    '- reasoning must be concise and practical.',
    '- targetBpm should be a sensible transition BPM based on both tracks.'
  ].join('\n');
  return callNemotron(prompt, 900);
}

module.exports = {
  CRUSOE_API_URL,
  CRUSOE_MODEL,
  CRUSOE_API_KEY,
  planSet,
  crowdPulse,
  trackBrain,
  promptDj,
  planMixTransition,
  callNemotron
};
