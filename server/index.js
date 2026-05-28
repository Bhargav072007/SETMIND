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
  CRUSOE_API_URL,
  CRUSOE_MODEL,
  CRUSOE_API_KEY
} = require('../src/agent/nemotron');
const { bootstrapLarkWorkflows } = require('../src/lark/workflows');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const webBuildPath = path.join(__dirname, '..', 'web', 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(webBuildPath));

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
  let payload;
  const crusoeConfigured = Boolean(CRUSOE_API_KEY && CRUSOE_API_KEY !== 'your_crusoe_api_key_here');
  try {
    if (!crusoeConfigured) {
      payload = {
        nemotron: false,
        error: 'CRUSOE_API_KEY is missing in Render environment variables.',
        model: CRUSOE_MODEL,
        crusoeConfigured: false,
        lark: Boolean(process.env.GETLARK_API_KEY && process.env.GETLARK_API_KEY !== 'your_lark_api_key_here')
      };
      res.json(payload);
      return;
    }

    const response = await fetch(CRUSOE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRUSOE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CRUSOE_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: 'ping' }]
      }),
      timeout: 20000
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`HTTP ${response.status}: ${body}`);
      console.error('Nemotron health check failed:', error);
      payload = {
        nemotron: false,
        error: error.message,
        model: CRUSOE_MODEL,
        crusoeConfigured,
        lark: Boolean(process.env.GETLARK_API_KEY && process.env.GETLARK_API_KEY !== 'your_lark_api_key_here')
      };
      res.json(payload);
      return;
    }

    payload = {
      nemotron: true,
      model: CRUSOE_MODEL,
      crusoeConfigured,
      lark: Boolean(process.env.GETLARK_API_KEY && process.env.GETLARK_API_KEY !== 'your_lark_api_key_here')
    };
    res.json(payload);
  } catch (error) {
    console.error('Nemotron health check failed:', error);
    payload = {
      nemotron: false,
      error: error.message,
      model: CRUSOE_MODEL,
      crusoeConfigured,
      lark: Boolean(process.env.GETLARK_API_KEY && process.env.GETLARK_API_KEY !== 'your_lark_api_key_here')
    };
    res.json(payload);
  }
}));

app.get('/api/search', asyncRoute(async function searchRoute(req, res) {
  const query = String(req.query.q || '').trim();
  const genre = String(req.query.genre || '').trim();
  const limit = Math.max(1, Math.min(25, Number(req.query.limit || 12)));
  if (!query) {
    res.json([]);
    return;
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(`${query} ${genre}`.trim())}&media=music&entity=song&limit=${limit}`;
  const response = await fetch(url, { timeout: 15000 });
  if (!response.ok) {
    throw new Error(`iTunes Search API HTTP ${response.status}`);
  }

  const data = await response.json();
  res.json((data.results || []).map((item) => normalizeItunesTrack(item, genre)));
}));

app.post('/api/plan', asyncRoute(async function planRoute(req, res) {
  res.json(await planSet(req.body || {}));
}));

app.post('/api/pulse', asyncRoute(async function pulseRoute(req, res) {
  res.json(await crowdPulse(req.body || {}));
}));

app.post('/api/brain', asyncRoute(async function brainRoute(req, res) {
  res.json(await trackBrain(req.body || {}));
}));

app.post('/api/prompt', asyncRoute(async function promptRoute(req, res) {
  res.json(await promptDj(req.body || {}));
}));

app.post('/api/mixplan', asyncRoute(async function mixPlanRoute(req, res) {
  res.json(await planMixTransition(req.body || {}));
}));

app.post('/api/lark/bootstrap', asyncRoute(async function larkRoute(req, res) {
  const results = await bootstrapLarkWorkflows();
  res.json({
    success: true,
    results
  });
}));

app.get('*', function spaFallback(req, res) {
  const indexPath = path.join(webBuildPath, 'index.html');
  res.sendFile(indexPath, function onSend(error) {
    if (error) {
      res.status(404).send('Build the web app first: cd web && npm install && npm run build');
    }
  });
});

app.listen(PORT, function onListen() {
  console.log(`SETMIND server running at http://localhost:${PORT}`);
  console.log(`Model: ${CRUSOE_MODEL}`);
  console.log(`Crusoe: ${CRUSOE_API_URL}`);
  console.log(`Crusoe key configured: ${Boolean(CRUSOE_API_KEY && CRUSOE_API_KEY !== 'your_crusoe_api_key_here')}`);
});
