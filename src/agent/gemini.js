'use strict';

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function resolveKey(overrideKey) {
  const key = overrideKey || GEMINI_API_KEY;
  if (!key) throw new Error('No Gemini API key provided. Add one in the app settings or set GEMINI_API_KEY on the server.');
  return key;
}

const SYSTEM_INSTRUCTION = [
  'You are SETMIND, a professional AI DJ workflow agent for club and festival DJs.',
  'You have these capabilities:',
  '[CAPABILITY: SET_PLAN] Create structured set plans.',
  '[CAPABILITY: CROWD_PULSE] Analyze current crowd state and next DJ moves.',
  '[CAPABILITY: TRACK_BRAIN] Analyze track libraries and compatibility.',
  '[CAPABILITY: DJ_PROMPT] Interpret free-form DJ instructions mid-set.',
  '[CAPABILITY: MIX_ENGINE] Design practical two-track transition plans for DJs.',
  'Reason step by step internally, then respond ONLY with valid JSON.',
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
    if (!match) throw new Error(`Gemini returned invalid JSON: ${directError.message}`);
    try {
      return JSON.parse(match[0]);
    } catch (fallbackError) {
      throw new Error(`Gemini returned unparseable JSON: ${fallbackError.message}`);
    }
  }
}

async function callGemini(userPrompt, maxTokens = 800, overrideKey) {
  const key = resolveKey(overrideKey);
  const ai = new GoogleGenAI({ apiKey: key });

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: Math.min(2400, maxTokens + (attempt - 1) * 400),
          temperature: 0.7
        }
      });
      const text = response.text;
      if (!text) throw new Error('Gemini returned empty response.');
      return parseJsonPayload(text);
    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt} failed: ${error.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`Gemini failed after 3 attempts: ${lastError.message}`);
}

async function planSet(params, apiKey) {
  const prompt = [
    '[CAPABILITY: SET_PLAN]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"setTitle":"string","energyArc":[{"phase":"string","duration":"string","bpmRange":"string","energy":1,"description":"string","exampleTracks":["real song","real song"]}],"crowdReadingTips":["string","string","string"],"emergencyPivots":[{"signal":"string","action":"string"},{"signal":"string","action":"string"}]}',
    'energyArc must contain exactly 5 phases. Keep every field concise. Descriptions under 18 words.'
  ].join('\n');
  return callGemini(prompt, 1600, apiKey);
}

async function crowdPulse(params, apiKey) {
  const prompt = [
    '[CAPABILITY: CROWD_PULSE]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"crowdState":"one word","momentumScore":1,"analysis":"two sentences","nextThreeTracks":[{"track":"Artist - Title","bpm":128,"reason":"string"}],"energyDirective":"HOLD","urgentAlert":null,"transitionTip":"string"}',
    'nextThreeTracks must contain exactly 3 items. energyDirective must be HOLD, PUSH, PULL BACK, or PIVOT.'
  ].join('\n');
  return callGemini(prompt, 650, apiKey);
}

async function trackBrain(params, apiKey) {
  const prompt = [
    '[CAPABILITY: TRACK_BRAIN]',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"topPicks":[{"track":"Artist - Title","compatibilityScore":1,"reason":"string"}],"libraryGaps":["string"],"powerSequence":["track","track","track","track","track"],"avoidNow":["string"]}',
    'topPicks must contain exactly 3 items.'
  ].join('\n');
  return callGemini(prompt, 650, apiKey);
}

async function promptDj(params, apiKey) {
  const prompt = [
    '[CAPABILITY: DJ_PROMPT]',
    'Interpret this free-form DJ request and return practical playlist changes.',
    'Input:',
    JSON.stringify(params, null, 2),
    'Return JSON exactly shaped as:',
    '{"response":"string","suggestedTracks":[{"track":"Track Title - Artist","bpm":130,"reason":"string"}],"action":"PUSH"}',
    'Suggest 2 to 4 tracks. action must be one of PUSH, HOLD, PULL BACK, PIVOT, SEARCH.'
  ].join('\n');
  return callGemini(prompt, 700, apiKey);
}

async function planMixTransition(params, apiKey) {
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
  return callGemini(prompt, 900, apiKey);
}

module.exports = {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  planSet,
  crowdPulse,
  trackBrain,
  promptDj,
  planMixTransition,
  callGemini
};
