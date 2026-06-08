'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const {
  planSet,
  crowdPulse,
  trackBrain,
  promptDj,
  planMixTransition,
  GEMINI_API_KEY,
  GEMINI_MODEL
} = require('../src/agent/gemini');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const webBuildPath = path.join(__dirname, '..', 'web', 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(webBuildPath));

function getRequestApiKey(req) {
  return req.headers['x-gemini-api-key'] || GEMINI_API_KEY || '';
}

function asyncRoute(handler) {
  return async function routeHandler(req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[server] request failed:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function bpmFromGenre(genre) {
  const normalized = String(genre || '').toLowerCase();
  if (normalized.includes('techno')) return 132;
  if (normalized.includes('house')) return 126;
  if (normalized.includes('dnb')) return 174;
  if (normalized.includes('hip-hop') || normalized.includes('hip hop')) return 95;
  if (normalized.includes('afrobeats')) return 110;
  if (normalized.includes('pop')) return 118;
  if (normalized.includes('ambient')) return 78;
  return 128;
}

function normalizeItunesTrack(item, fallbackGenre) {
  return {
    trackId: item.trackId || item.collectionId || `${item.trackName || ''}-${item.artistName || ''}`,
    trackName: item.trackName || 'Unknown Track',
    artist: item.artistName || 'Unknown Artist',
    bpm: bpmFromGenre(item.primaryGenreName || fallbackGenre),
    key: 'Cm',
    duration: Math.max(30, Math.round(Number(item.trackTimeMillis || 225000) / 1000)),
    artwork: item.artworkUrl100 || item.artworkUrl60 || '',
    previewUrl: item.previewUrl || '',
    genre: item.primaryGenreName || fallbackGenre || 'music',
    durationLabel: formatMs(item.trackTimeMillis || 225000)
  };
}

app.get('/api/health', asyncRoute(async function healthRoute(req, res) {
  const apiKey = getRequestApiKey(req);
  if (!apiKey) {
    res.json({ gemini: false, error: 'No API key configured. Enter your Gemini API key in the app.', model: GEMINI_MODEL, geminiConfigured: false });
    return;
  }
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const healthModels = [GEMINI_MODEL, 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
  let lastErr = null;
  for (const model of healthModels) {
    try {
      const response = await ai.models.generateContent({ model, contents: 'ping' });
      if (response.text) {
        res.json({ gemini: true, model, geminiConfigured: true });
        return;
      }
    } catch (err) {
      lastErr = err;
      console.error(`Health check failed for ${model}:`, err.message);
      const msg = String(err.message || '');
      const gone = msg.includes('404') || msg.includes('no longer available') || msg.includes('not found');
      const busy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
      if (!gone && !busy) break; // auth error, bad key — no point trying other models
    }
  }
  res.json({ gemini: false, error: lastErr?.message || 'All models unavailable', model: GEMINI_MODEL, geminiConfigured: Boolean(apiKey) });
}));

app.get('/api/search', asyncRoute(async function searchRoute(req, res) {
  const query = String(req.query.q || '').trim();
  const genre = String(req.query.genre || '').trim();
  const limit = Math.max(1, Math.min(25, Number(req.query.limit || 12)));
  if (!query) { res.json([]); return; }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(`${query} ${genre}`.trim())}&media=music&entity=song&limit=${limit}`;
  const response = await fetch(url, { timeout: 15000 });
  if (!response.ok) throw new Error(`iTunes Search API HTTP ${response.status}`);
  const data = await response.json();
  res.json((data.results || []).map((item) => normalizeItunesTrack(item, genre)));
}));

app.post('/api/plan', asyncRoute(async (req, res) => res.json(await planSet(req.body || {}, getRequestApiKey(req)))));
app.post('/api/pulse', asyncRoute(async (req, res) => res.json(await crowdPulse(req.body || {}, getRequestApiKey(req)))));
app.post('/api/brain', asyncRoute(async (req, res) => res.json(await trackBrain(req.body || {}, getRequestApiKey(req)))));
app.post('/api/prompt', asyncRoute(async (req, res) => res.json(await promptDj(req.body || {}, getRequestApiKey(req)))));
app.post('/api/mixplan', asyncRoute(async (req, res) => res.json(await planMixTransition(req.body || {}, getRequestApiKey(req)))));

app.get('*', function spaFallback(req, res) {
  const indexPath = path.join(webBuildPath, 'index.html');
  res.sendFile(indexPath, function onSend(error) {
    if (error) res.status(404).send('Build the web app first: cd web && npm install && npm run build');
  });
});

app.listen(PORT, function onListen() {
  console.log(`SETMIND server running at http://localhost:${PORT}`);
  console.log(`Model: ${GEMINI_MODEL}`);
  console.log(`Server-side Gemini key configured: ${Boolean(GEMINI_API_KEY)}`);
});
