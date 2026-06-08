'use strict';

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-8b';

function resolveKey(overrideKey) {
  const key = overrideKey || GEMINI_API_KEY;
  if (!key) throw new Error('No Gemini API key provided. Add one in the app settings.');
  return key;
}

const SYSTEM_INSTRUCTION = [
  'You are SETMIND, a professional AI DJ workflow agent for club and festival DJs.',
  '[CAPABILITY: SET_PLAN] Create structured set plans.',
  '[CAPABILITY: CROWD_PULSE] Analyze current crowd state and next DJ moves.',
  '[CAPABILITY: TRACK_BRAIN] Analyze track libraries and compatibility.',
  '[CAPABILITY: DJ_PROMPT] Interpret free-form DJ instructions mid-set.',
  '[CAPABILITY: MIX_ENGINE] Design practical two-track transition plans for DJs.',
  'Respond ONLY with valid JSON. No markdown, no code fences, no explanation.'
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
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini returned invalid JSON');
    return JSON.parse(match[0]);
  }
}

function is503(error) {
  const msg = String(error?.message || '');
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
}

async function callModel(ai, model, userPrompt, maxTokens) {
  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: maxTokens,
      temperature: 0.7
    }
  });
  const text = response.text;
  if (!text) throw new Error('Gemini returned empty response');
  return parseJsonPayload(text);
}

async function callGemini(userPrompt, maxTokens = 800, overrideKey) {
  const key = resolveKey(overrideKey);
  const ai = new GoogleGenAI({ apiKey: key });

  // Try primary model with retries, then fallback model
  const RETRIES = [1500, 3000, 6000, 10000]; // ms waits between attempts
  let lastError = null;

  for (let attempt = 0; attempt < RETRIES.length; attempt++) {
    const model = attempt < 3 ? GEMINI_MODEL : GEMINI_FALLBACK_MODEL;
    try {
      return await callModel(ai, model, userPrompt, maxTokens);
    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt + 1} (${model}) failed: ${error.message}`);
      if (!is503(error)) break; // non-503 errors won't get better with retries
      if (attempt < RETRIES.length - 1) {
        await new Promise((r) => setTimeout(r, RETRIES[attempt]));
      }
    }
  }

  throw new Error(`Gemini unavailable after ${RETRIES.length} attempts. Try again in a moment.`);
}

async function planSet(params, apiKey) {
  return callGemini([
    '[CAPABILITY: SET_PLAN]',
    'Input:', JSON.stringify(params, null, 2),
    'Return JSON: {"setTitle":"string","energyArc":[{"phase":"string","duration":"string","bpmRange":"string","energy":1,"description":"string","exampleTracks":["string","string"]}],"crowdReadingTips":["string","string","string"],"emergencyPivots":[{"signal":"string","action":"string"}]}',
    'energyArc must have exactly 5 phases. Descriptions under 18 words.'
  ].join('\n'), 1600, apiKey);
}

async function crowdPulse(params, apiKey) {
  return callGemini([
    '[CAPABILITY: CROWD_PULSE]',
    'Input:', JSON.stringify(params, null, 2),
    'Return JSON: {"crowdState":"string","momentumScore":5,"analysis":"string","nextThreeTracks":[{"track":"Artist - Title","bpm":128,"reason":"string"}],"energyDirective":"HOLD","urgentAlert":null,"transitionTip":"string"}',
    'nextThreeTracks must have exactly 3 items. energyDirective: HOLD, PUSH, PULL BACK, or PIVOT.'
  ].join('\n'), 650, apiKey);
}

async function trackBrain(params, apiKey) {
  return callGemini([
    '[CAPABILITY: TRACK_BRAIN]',
    'Input:', JSON.stringify(params, null, 2),
    'Return JSON: {"topPicks":[{"track":"Artist - Title","compatibilityScore":9,"reason":"string"}],"libraryGaps":["string"],"powerSequence":["string","string","string","string","string"],"avoidNow":["string"]}',
    'topPicks must have exactly 3 items.'
  ].join('\n'), 650, apiKey);
}

async function promptDj(params, apiKey) {
  return callGemini([
    '[CAPABILITY: DJ_PROMPT]',
    'Input:', JSON.stringify(params, null, 2),
    'Return JSON: {"response":"string","suggestedTracks":[{"track":"Artist - Title","bpm":128,"reason":"string"}],"action":"PUSH"}',
    'Suggest 2-4 tracks. action: PUSH, HOLD, PULL BACK, PIVOT, or SEARCH.'
  ].join('\n'), 700, apiKey);
}

async function planMixTransition(params, apiKey) {
  return callGemini([
    '[CAPABILITY: MIX_ENGINE]',
    'Plan a DJ transition between two loaded decks.',
    'Input:', JSON.stringify(params, null, 2),
    'Return JSON: {"headline":"string","targetDeck":"A","mode":"smooth","triggerPoint":0.72,"outgoingStartProgress":0.68,"outgoingEndProgress":0.9,"crossfadeSeconds":8,"targetBpm":128,"incomingCueStart":0.04,"phraseBars":16,"mixOnBar":12,"mixOnBeat":1,"entryPhraseBar":1,"preparation":["string","string"],"reasoning":"string","confidence":0.88}',
    'triggerPoint 0.55-0.9. crossfadeSeconds 2-12. phraseBars: 8, 16, or 32.'
  ].join('\n'), 900, apiKey);
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
