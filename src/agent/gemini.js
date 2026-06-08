'use strict';

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Fallback chain: 2.5-flash (primary) → 1.5-flash (stable) → 1.5-flash-8b (last resort)
const FALLBACK_MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-8b'];

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

function isRetryable(error) {
  if (error?.status === 503 || error?.status === 429) return true;
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted')
  );
}

function isModelGone(error) {
  if (error?.status === 404 || error?.status === 400) return true; // 400 or 404 status codes indicate model not found/bad request
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not exist') ||
    msg.includes('no longer available') ||
    msg.includes('deprecated')
  );
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

  // Model ladder: primary first (2 attempts with short waits), then each fallback once
  const modelLadder = [
    { model: GEMINI_MODEL, wait: 0 },
    { model: GEMINI_MODEL, wait: 2000 },
    { model: FALLBACK_MODELS[0], wait: 1500 },
    { model: FALLBACK_MODELS[1], wait: 0 },
  ];

  let lastError = null;

  for (let i = 0; i < modelLadder.length; i++) {
    const { model, wait } = modelLadder[i];
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      const result = await callModel(ai, model, userPrompt, maxTokens);
      if (i > 0) console.log(`[gemini] succeeded on fallback: ${model}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[gemini] attempt ${i + 1} (${model}) failed: ${error.message}`);
      // Skip remaining attempts with this model if it's gone/deprecated
      if (isModelGone(error)) {
        console.warn(`[gemini] model ${model} unavailable, skipping to next`);
        // Skip the second attempt for primary if model is 404
        if (i === 0) i += 1;
        continue;
      }
      // For non-retryable errors (bad key, quota, bad request), give up immediately
      if (!isRetryable(error)) {
        throw new Error(`Gemini error: ${error.message}`);
      }
    }
  }

  throw new Error(`Gemini models unavailable (high demand). Last error: ${lastError?.message || 'unknown'}. Try again in a moment.`);
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
