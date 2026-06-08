import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

const MODEL = 'gemini-2.5-flash';
const GENRES = ['techno', 'house', 'dnb', 'hip-hop', 'afrobeats', 'pop', 'ambient', 'other'];
const KEYS = ['Cm', 'C', 'Dm', 'D', 'Em', 'E', 'Fm', 'F', 'Gm', 'G', 'Am', 'A', 'Bm', 'B'];
const TABS = ['DECKS', 'CROWD AI', 'SET PLAN', 'LIBRARY'];
const QUICK_PROMPTS = ['make it darker', 'drop the energy', 'go 90s house', 'find 130 BPM', 'crowd is losing it', 'build to peak'];
const LANDING_QUERIES = ['Daft Punk', 'Fred again..', 'Calvin Harris', 'Drake', 'The Weeknd', 'Bicep'];

const BASE_TRACK = {
  trackName: 'Load a track',
  artist: 'Search iTunes or import a library',
  bpm: 128,
  key: 'Cm',
  duration: 225,
  artwork: '',
  previewUrl: '',
  genre: 'techno'
};

const STARTER_TRACKS = [
  {
    trackName: 'Spastik',
    artist: 'Plastikman',
    bpm: 132,
    key: 'Cm',
    duration: 225,
    artwork: '',
    previewUrl: '',
    genre: 'techno'
  },
  {
    trackName: 'Glue',
    artist: 'Bicep',
    bpm: 128,
    key: 'Am',
    duration: 252,
    artwork: '',
    previewUrl: '',
    genre: 'house'
  }
];

const CAMELOT_MAP = {
  Abm: '1A',
  'G#m': '1A',
  B: '1B',
  Ebm: '2A',
  'D#m': '2A',
  'F#': '2B',
  Gb: '2B',
  Bbm: '3A',
  'A#m': '3A',
  Db: '3B',
  'C#': '3B',
  Fm: '4A',
  Ab: '4B',
  'G#': '4B',
  Cm: '5A',
  Eb: '5B',
  'D#': '5B',
  Gm: '6A',
  Bb: '6B',
  'A#': '6B',
  Dm: '7A',
  F: '7B',
  Am: '8A',
  C: '8B',
  Em: '9A',
  G: '9B',
  Bm: '10A',
  D: '10B',
  'F#m': '11A',
  A: '11B',
  'C#m': '12A',
  Dbm: '12A',
  E: '12B'
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatSeconds(total) {
  const safe = Math.max(0, Math.floor(Number(total || 0)));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const GEMINI_KEY_STORAGE = 'setmind_gemini_api_key';

function getStoredApiKey() {
  try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ''; } catch { return ''; }
}

function api(path, options = {}) {
  const apiKey = getStoredApiKey();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Gemini-Api-Key': apiKey } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

function parseSuggestedTrackName(input) {
  const value = String(input || '').trim();
  if (!value) return { query: '', trackName: '', artist: '' };
  const parts = value.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      query: `${parts[0]} ${parts.slice(1).join(' ')}`.trim(),
      artist: parts[0],
      trackName: parts.slice(1).join(' - ')
    };
  }
  return { query: value, trackName: value, artist: '' };
}

async function resolvePlayableTrack(candidate, fallbackGenre = 'music') {
  if (candidate.previewUrl) return candidate;
  const parsed = parseSuggestedTrackName(candidate.track || candidate.trackName || '');
  const query = parsed.query || candidate.artist || candidate.trackName || '';
  const genre = candidate.genre || fallbackGenre;
  const results = await api(`/api/search?q=${encodeURIComponent(query)}&genre=${encodeURIComponent(genre)}&limit=6`);
  if (!results.length) {
    return {
      ...BASE_TRACK,
      ...candidate,
      trackName: candidate.trackName || parsed.trackName || candidate.track || 'Unknown Track',
      artist: candidate.artist || parsed.artist || 'Unknown Artist'
    };
  }

  const exact = results.find((item) => {
    const name = String(item.trackName || '').toLowerCase();
    const artist = String(item.artist || '').toLowerCase();
    return (!parsed.trackName || name.includes(parsed.trackName.toLowerCase())) && (!parsed.artist || artist.includes(parsed.artist.toLowerCase()));
  });

  return exact || results.find((item) => item.previewUrl) || results[0];
}

function makeDeck(id, track) {
  return {
    id,
    trackName: track.trackName,
    artist: track.artist,
    bpm: Number(track.bpm || 128),
    key: track.key || 'Cm',
    duration: Number(track.duration || 225),
    artwork: track.artwork || '',
    previewUrl: track.previewUrl || '',
    genre: track.genre || 'techno',
    progress: 0,
    isPlaying: false,
    volume: 82,
    pitch: 0,
    keyLock: false,
    loop: false,
    hotCues: [null, null, null, null],
    eq: { low: 0, mid: 0, high: 0 },
    queue: [],
    taps: [],
    error: ''
  };
}

function adjustedBpm(deck) {
  return Math.round(Number(deck.bpm || 128) * (1 + Number(deck.pitch || 0) / 100) * 10) / 10;
}

function waveformSeed(input) {
  let value = 0;
  String(input || '').split('').forEach((char) => {
    value = (value * 31 + char.charCodeAt(0)) | 0;
  });
  return Math.abs(value) || 1;
}

function drawWave(canvas, deck) {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.offsetWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.offsetHeight * ratio));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let seed = waveformSeed(`${deck.trackName}-${deck.artist}-${deck.id}`);
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);

  const playhead = clamp(width * deck.progress, 0, width);

  for (let x = 0; x < width; x += 5) {
    const barHeight = Math.max(4, Math.floor((0.15 + next() * 0.82) * height));
    const cx = x + 2;
    const cy = height / 2;
    const top = cy - barHeight / 2;
    if (x <= playhead) {
      const grad = ctx.createLinearGradient(0, top, 0, top + barHeight);
      grad.addColorStop(0, 'rgba(252,60,68,0.5)');
      grad.addColorStop(0.5, 'rgba(252,60,68,1)');
      grad.addColorStop(1, 'rgba(252,60,68,0.5)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
    }
    ctx.beginPath();
    ctx.roundRect(x, top, 3, barHeight, 2);
    ctx.fill();
  }

  const headGrad = ctx.createLinearGradient(0, 0, 0, height);
  headGrad.addColorStop(0, 'rgba(255,255,255,0)');
  headGrad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  headGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = headGrad;
  ctx.fillRect(Math.max(0, playhead - 1), 0, 2, height);
}

function getCamelot(key) {
  return CAMELOT_MAP[key] || '';
}

function getCompatibility(firstKey, secondKey) {
  const first = getCamelot(firstKey);
  const second = getCamelot(secondKey);
  if (!first || !second) return { tone: 'neutral', text: 'Neutral', score: 0.5 };

  const firstNumber = Number(first.slice(0, -1));
  const secondNumber = Number(second.slice(0, -1));
  const firstLetter = first.slice(-1);
  const secondLetter = second.slice(-1);
  const neighbor = Math.abs(firstNumber - secondNumber) === 1 || Math.abs(firstNumber - secondNumber) === 11;

  if ((firstNumber === secondNumber && firstLetter === secondLetter) || (firstNumber === secondNumber && firstLetter !== secondLetter) || (neighbor && firstLetter === secondLetter)) {
    return { tone: 'good', text: 'Keys compatible', score: 1 };
  }

  return { tone: 'bad', text: 'Keys clash', score: 0 };
}

function makeAutoMixAdvice(deckA, deckB) {
  const bpmGap = Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB));
  const keyInfo = getCompatibility(deckA.key, deckB.key);
  if (!deckA.previewUrl || !deckB.previewUrl) {
    return {
      ready: false,
      headline: 'Preview audio required on both decks',
      detail: 'Load two iTunes preview tracks to let AI Mixer auto-transition them.'
    };
  }
  if (bpmGap <= 2 && keyInfo.score === 1) {
    return {
      ready: true,
      headline: 'Smooth blend available',
      detail: `Low BPM gap (${bpmGap.toFixed(1)}) and ${keyInfo.text.toLowerCase()} make this an easy auto mix.`
    };
  }
  if (bpmGap <= 5) {
    return {
      ready: true,
      headline: 'Controlled handoff available',
      detail: `BPM gap is ${bpmGap.toFixed(1)}. AI Mixer can still blend this with a longer transition.`
    };
  }
  return {
    ready: true,
    headline: 'Harder transition',
    detail: `BPM gap is ${bpmGap.toFixed(1)}. AI Mixer will pitch and fade more aggressively.`
  };
}

function analyzeBeatGrid(deck, mixTrigger = 0.75, phraseBars = 16) {
  const bpm = Math.max(60, adjustedBpm(deck));
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const phraseDuration = barDuration * phraseBars;
  const currentSeconds = deck.duration * deck.progress;
  const totalBeats = Math.floor(currentSeconds / beatDuration);
  const beatInPhrase = ((totalBeats % (phraseBars * 4)) + (phraseBars * 4)) % (phraseBars * 4);
  const beatInBar = (beatInPhrase % 4) + 1;
  const barInPhrase = Math.floor(beatInPhrase / 4) + 1;
  const triggerSeconds = deck.duration * mixTrigger;
  const closestPhraseBoundary = Math.round(triggerSeconds / phraseDuration) * phraseDuration;

  return {
    bpm,
    beatDuration,
    barDuration,
    phraseDuration,
    currentSeconds,
    beatInBar,
    barInPhrase,
    totalBeats,
    secsUntilTrigger: triggerSeconds - currentSeconds,
    secsUntilPhraseMix: closestPhraseBoundary - currentSeconds
  };
}

function buildFallbackMixPlan(deckA, deckB, energy) {
  const bpmGap = Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB));
  const compatibility = getCompatibility(deckA.key, deckB.key);
  const smooth = bpmGap <= 3 && compatibility.score === 1;
  const tight = bpmGap <= 6;

  return {
    headline: smooth ? 'Fallback smooth blend ready' : tight ? 'Fallback controlled transition ready' : 'Fallback hard transition ready',
    targetDeck: deckA.isPlaying ? 'B' : 'A',
    mode: smooth ? 'smooth' : tight ? 'tight' : 'hard',
    triggerPoint: smooth ? 0.7 : tight ? 0.76 : 0.82,
    outgoingStartProgress: smooth ? 0.68 : tight ? 0.74 : 0.8,
    outgoingEndProgress: smooth ? 0.9 : tight ? 0.93 : 0.97,
    crossfadeSeconds: smooth ? 8 : tight ? 6 : 3,
    targetBpm: Math.round((adjustedBpm(deckA) + adjustedBpm(deckB)) / 2),
    incomingCueStart: smooth ? 0.04 : tight ? 0.02 : 0,
    phraseBars: smooth ? 16 : 8,
    preparation: [
      'Set the incoming cue before the phrase change',
      `Aim to hold the room near energy ${energy}/10`,
      compatibility.score === 1 ? 'Lean on harmonic blend during the fade' : 'Use EQ and filter to soften the key clash'
    ],
    reasoning: 'Generated locally because the remote mix planner was unavailable for a moment.',
    confidence: 0.62
  };
}

function useAudioEngine(deckA, deckB, setDeckA, setDeckB, crossfader) {
  const audioMap = useRef({ A: null, B: null });

  function ensure() {
    ['A', 'B'].forEach((deckId) => {
      if (audioMap.current[deckId]) return;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audioMap.current[deckId] = audio;
    });
  }

  function deckGain(deckId, volume) {
    const curve = (crossfader / 100) * (Math.PI / 2);
    const side = deckId === 'A' ? Math.cos(curve) : Math.sin(curve);
    return clamp((volume / 100) * side, 0, 1);
  }

  function getAudio(deckId) {
    ensure();
    return audioMap.current[deckId];
  }

  function stop(deckId) {
    const audio = audioMap.current[deckId];
    if (!audio) return;
    audio.pause();
  }

  function updateProgress(deckId, deck, setDeck) {
    const audio = audioMap.current[deckId];
    if (!audio) return;
    const safeDuration = audio.duration && Number.isFinite(audio.duration)
      ? audio.duration
      : Number(deck.duration || 225);
    setDeck((prev) => ({
      ...prev,
      duration: Math.max(1, Math.round(safeDuration || prev.duration || 225)),
      progress: safeDuration > 0 ? clamp(audio.currentTime / safeDuration, 0, 1) : prev.progress
    }));
  }

  async function play(deckId, deck, setDeck) {
    if (!deck.previewUrl) {
      setDeck((prev) => ({ ...prev, error: 'No preview available for this track. Use iTunes search or a preview-enabled result.' }));
      return false;
    }

    const audio = getAudio(deckId);
    const desiredSrc = deck.previewUrl;
    if (audio.src !== desiredSrc) {
      audio.src = desiredSrc;
      audio.load();
    }

    audio.volume = deckGain(deckId, deck.volume);
    audio.playbackRate = clamp(1 + deck.pitch / 100, 0.5, 1.5);
    audio.onended = () => {
      if (deck.loop) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setDeck((prev) => ({ ...prev, isPlaying: true, progress: 0 }));
        return;
      }
      setDeck((prev) => ({ ...prev, isPlaying: false, progress: 1 }));
    };

    await new Promise((resolve) => {
      if (audio.readyState >= 1) {
        resolve();
        return;
      }
      const onMeta = () => resolve();
      audio.addEventListener('loadedmetadata', onMeta, { once: true });
      setTimeout(resolve, 1500);
    });

    const safeDuration = audio.duration && Number.isFinite(audio.duration)
      ? audio.duration
      : Number(deck.duration || 225);
    const offset = clamp(safeDuration * deck.progress, 0, Math.max(0, safeDuration - 0.05));
    try {
      audio.currentTime = offset;
    } catch {
      // ignore seek races
    }

    await audio.play();
    setDeck((prev) => ({ ...prev, isPlaying: true, error: '' }));
    return true;
  }

  function pause(deckId, deck, setDeck) {
    const audio = audioMap.current[deckId];
    if (!audio) return;
    audio.pause();
    const safeDuration = audio.duration && Number.isFinite(audio.duration)
      ? audio.duration
      : Number(deck.duration || 225);
    const progress = safeDuration > 0 ? clamp(audio.currentTime / safeDuration, 0, 1) : deck.progress;
    setDeck({ ...deck, isPlaying: false, progress });
  }

  function seek(deckId, progress, deck, setDeck) {
    const nextProgress = clamp(progress, 0, 1);
    const audio = getAudio(deckId);
    const safeDuration = audio.duration && Number.isFinite(audio.duration)
      ? audio.duration
      : Number(deck.duration || 225);
    try {
      audio.currentTime = clamp(safeDuration * nextProgress, 0, Math.max(0, safeDuration - 0.05));
    } catch {
      // ignore seek races
    }
    setDeck((prev) => ({ ...prev, progress: nextProgress }));
    if (!deck.isPlaying) return;
    audio.play().catch((error) => {
      setDeck((prev) => ({ ...prev, error: error.message }));
    });
  }

  useEffect(() => {
    ['A', 'B'].forEach((deckId) => {
      const audio = audioMap.current[deckId];
      if (!audio) return;
      const deck = deckId === 'A' ? deckA : deckB;
      audio.volume = deckGain(deckId, deck.volume);
      audio.playbackRate = clamp(1 + deck.pitch / 100, 0.5, 1.5);
    });
  }, [crossfader, deckA.volume, deckB.volume, deckA.pitch, deckB.pitch]);

  useEffect(() => {
    const timer = setInterval(() => {
      ['A', 'B'].forEach((deckId) => {
        const audio = audioMap.current[deckId];
        if (!audio || audio.paused) return;
        const deck = deckId === 'A' ? deckA : deckB;
        const setDeck = deckId === 'A' ? setDeckA : setDeckB;
        updateProgress(deckId, deck, setDeck);
      });
    }, 120);
    return () => clearInterval(timer);
  }, [deckA, deckB, setDeckA, setDeckB]);

  useEffect(() => () => {
    ['A', 'B'].forEach((deckId) => {
      const audio = audioMap.current[deckId];
      if (!audio) return;
      audio.pause();
      audio.src = '';
    });
  }, []);

  return { ensure, play, pause, seek, stop };
}

function BrandMark() {
  return (
    <div className="brand-mark">
      <div className="brand-fader" aria-hidden="true">
        <div className="brand-fader-rail" />
        <div className="brand-fader-ticks">
          {Array.from({ length: 15 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="brand-fader-knob">
          <i />
        </div>
      </div>
      <strong>SETMIND</strong>
    </div>
  );
}

function LandingPage() {
  const [landingTracks, setLandingTracks] = useState([]);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredApiKey()));

  useEffect(() => {
    let cancelled = false;

    async function loadLandingTracks() {
      try {
        const batches = await Promise.all(LANDING_QUERIES.map((query) => api(`/api/search?q=${encodeURIComponent(query)}&genre=pop&limit=2`)));
        const next = batches.flat().filter((item) => item.artwork).slice(0, 8);
        if (!cancelled) setLandingTracks(next);
      } catch {
        if (!cancelled) setLandingTracks([]);
      }
    }

    loadLandingTracks();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-shell">
      <div className="landing-backdrop" />
      <nav className="landing-nav">
        <BrandMark />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowKeyPanel(true)}
            style={{
              background: hasKey ? 'rgba(34,197,94,0.08)' : 'rgba(252,60,68,0.1)',
              border: hasKey ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(252,60,68,0.3)',
              borderRadius: 8, padding: '7px 14px',
              color: hasKey ? '#22c55e' : '#fc3c44',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {hasKey ? 'API Key Set ✓' : 'Add API Key'}
          </button>
          <Link to="/app" className="button-accent nav-button">Launch App</Link>
        </div>
      </nav>
      {showKeyPanel && (
        <ApiKeyPanel
          onClose={() => { setShowKeyPanel(false); setHasKey(Boolean(getStoredApiKey())); }}
          onSave={() => setHasKey(Boolean(getStoredApiKey()))}
        />
      )}

      <section className="hero-block">
        <div className="hero-layout">
          <div className="hero-copy-column">
            <p className="eyebrow">POWERED BY GOOGLE GEMINI AI</p>
            <h1>
              <span>The AI brain</span>
              <span>professional DJs actually use</span>
            </h1>
            <p className="hero-copy">
              Real-time crowd analysis, set architecture, and AI-assisted transitions for DJs who need faster reads and cleaner decisions at show speed.
            </p>
            <div className="hero-actions">
              <Link to="/app" className="button-accent">Launch SETMIND</Link>
              <a href="#features" className="button-ghost">View Features</a>
            </div>
            <div className="hero-mini-stats">
              <article>
                <strong>Live</strong>
                <span>Crowd reads</span>
              </article>
              <article>
                <strong>AI</strong>
                <span>Mix planning</span>
              </article>
              <article>
                <strong>Decks</strong>
                <span>Performance UI</span>
              </article>
            </div>
          </div>

          <div className="hero-visual glass-card">
            <div className="hero-visual-top">
              <span>SETMIND SESSION</span>
              <span>132.0 / 128.0 BPM</span>
            </div>
            <div className="hero-visual-main">
              <div className="hero-track-card active">
                <small>DECK A</small>
                <strong>Peak driver loaded</strong>
                <p>AI reading the room and holding pressure</p>
                <div className="hero-track-wave red" />
              </div>
              <div className="hero-track-card">
                <small>DECK B</small>
                <strong>Transition target queued</strong>
                <p>Prepared for the next energy lift</p>
                <div className="hero-track-wave" />
              </div>
            </div>
            <div className="hero-mixer-strip">
              <div>
                <label>AI MIXER</label>
                <strong>Transition plan armed</strong>
              </div>
              <div className="hero-meter">
                <i className="on" />
                <i className="on" />
                <i className="on" />
                <i className="on" />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>

        {!!landingTracks.length && (
          <div className="album-ticker-wrap" aria-hidden="true">
            <div className="album-ticker-track">
              {[...landingTracks, ...landingTracks].map((track, index) => (
                <article key={`${track.trackId}-${index}`} className="album-ribbon-card">
                  <img src={track.artwork} alt="" />
                  <div className="album-ribbon-meta">
                    <strong>{track.trackName}</strong>
                    <span>{track.artist}</span>
                  </div>
                  <div className="album-ribbon-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="hero-waves" aria-hidden="true">
          <div className="wave wave-four" />
          <div className="wave wave-one" />
          <div className="wave wave-two" />
          <div className="wave wave-three" />
        </div>
      </section>

      <section className="stats-row">
        <article><strong>3</strong><span>AI capabilities</span></article>
        <article><strong>Live</strong><span>Real-time room reads</span></article>
        <article><strong>Pro</strong><span>Deck-first workflow</span></article>
      </section>

      <section className="features-section" id="features">
        <FeatureCard title="Crowd Pulse" text="Read the room, assess momentum, and get instant next-track recommendations." icon={<WaveIcon />} />
        <FeatureCard title="Set Architect" text="Design warm-up to close arcs with BPM ranges, emergency pivots, and phase intent." icon={<StackIcon />} />
        <FeatureCard title="AI Prompter" text="Type short, high-pressure DJ prompts and get fast, usable answers with track direction." icon={<SparkIcon />} />
      </section>

      <section className="bottom-cta">
        <h2>Ready to elevate your sets?</h2>
        <Link to="/app" className="button-accent">Launch SETMIND</Link>
        <p>Powered by Google Gemini AI</p>
      </section>

      <footer className="landing-footer">
        <span>SETMIND © 2026</span>
        <span>AI-Powered DJ Platform</span>
      </footer>
    </div>
  );
}

function FeatureCard({ title, text, icon }) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2 18c3-8 6-8 9 0s6 8 9 0 6-8 10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 12c3-6 6-6 9 0s6 6 9 0 6-6 10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 4 4 11l12 7 12-7-12-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m8 16 8 5 8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m8 21 8 5 8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 4 18.8 13.2 28 16l-9.2 2.8L16 28l-2.8-9.2L4 16l9.2-2.8L16 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m25 4 .9 2.1L28 7l-2.1.9L25 10l-.9-2.1L22 7l2.1-.9L25 4Z" fill="currentColor" />
    </svg>
  );
}

function StatusDot({ label, tone }) {
  return (
    <div className="status-pill">
      <i className={`status-dot ${tone}`} />
      <span>{label}</span>
    </div>
  );
}

function ApiKeyPanel({ onClose, onSave }) {
  const [val, setVal] = React.useState(() => getStoredApiKey());
  const [visible, setVisible] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null); // null | 'ok' | string(error)

  async function save() {
    const trimmed = val.trim();
    if (!trimmed) return;
    try { localStorage.setItem(GEMINI_KEY_STORAGE, trimmed); } catch {}
    setTesting(true);
    setTestResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000); // 12s max
    try {
      const res = await fetch('/api/health', {
        headers: { 'X-Gemini-Api-Key': trimmed },
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.gemini) {
        setTestResult('ok');
        onSave();
        setTimeout(onClose, 900);
      } else {
        setTestResult(data.error || 'Key was rejected by Gemini.');
        onSave();
      }
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        setTestResult('Connection timed out. Key saved — Gemini may be slow right now.');
      } else {
        setTestResult('Could not reach server to verify key.');
      }
      onSave(); // save the key even if test timed out
    }
    setTesting(false);
  }

  function clear() {
    setVal('');
    setTestResult(null);
    try { localStorage.removeItem(GEMINI_KEY_STORAGE); } catch {}
    onSave();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '28px 28px 24px', width: 420, maxWidth: '90vw',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
      }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Gemini API Key</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Stored locally in your browser — never sent to our servers without your request</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={visible ? 'text' : 'password'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="AIza..."
            onKeyDown={(e) => e.key === 'Enter' && save()}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '11px 44px 11px 14px',
              color: '#fff', fontSize: 13, fontFamily: 'monospace',
              outline: 'none'
            }}
          />
          <button onClick={() => setVisible(v => !v)} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13
          }}>{visible ? 'hide' : 'show'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: testResult ? 10 : 16 }}>
          <button onClick={save} disabled={testing || !val.trim()} style={{
            flex: 1,
            background: testResult === 'ok' ? '#22c55e' : '#fc3c44',
            color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700,
            cursor: testing ? 'wait' : 'pointer', opacity: (!val.trim() || testing) ? 0.6 : 1,
            transition: 'background 0.2s'
          }}>
            {testing ? 'Testing…' : testResult === 'ok' ? 'Connected ✓' : 'Save & Test'}
          </button>
          {val && (
            <button onClick={clear} style={{
              background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer'
            }}>Clear</button>
          )}
        </div>

        {testResult && testResult !== 'ok' && (
          <div style={{
            marginBottom: 12, padding: '8px 12px',
            background: 'rgba(252,60,68,0.08)', border: '1px solid rgba(252,60,68,0.2)',
            borderRadius: 8, fontSize: 11, color: '#fc3c44', lineHeight: 1.5
          }}>
            {testResult}
          </div>
        )}

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 0', color: '#888', fontSize: 12,
            fontWeight: 600, textDecoration: 'none', transition: 'border-color 0.15s'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Get a free API key from Google AI Studio
        </a>
      </div>
    </div>
  );
}

function AppHeader({ activeTab, setActiveTab, status, onRefreshHealth }) {
  const [showKeyPanel, setShowKeyPanel] = React.useState(false);
  const hasKey = Boolean(getStoredApiKey());

  return (
    <>
      <header className="app-header">
        <div className="header-row">
          <Link to="/" className="app-logo-link"><BrandMark /></Link>
          <nav className="tab-strip">
            {TABS.map((tab) => (
              <button key={tab} className={activeTab === tab ? 'tab-chip active' : 'tab-chip'} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>
          <div className="header-right">
            <StatusDot label="Gemini" tone={status.gemini === null ? 'grey' : status.gemini ? 'green' : 'red'} />
            <button
              onClick={() => setShowKeyPanel(true)}
              style={{
                background: hasKey ? 'rgba(255,255,255,0.05)' : 'rgba(252,60,68,0.12)',
                border: hasKey ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(252,60,68,0.3)',
                borderRadius: 7, padding: '5px 11px',
                color: hasKey ? '#888' : '#fc3c44',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.4px',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {hasKey ? 'API Key' : 'Add API Key'}
            </button>
            <Link to="/" className="home-link">Back to Home</Link>
          </div>
        </div>
        <div className="header-wave" />
      </header>
      {showKeyPanel && (
        <ApiKeyPanel
          onClose={() => setShowKeyPanel(false)}
          onSave={onRefreshHealth}
        />
      )}
    </>
  );
}

function Artwork({ deck }) {
  if (deck.artwork) {
    return <img src={deck.artwork} alt="" className="artwork" />;
  }
  return <div className="artwork placeholder">MIX</div>;
}

function Waveform({ deck }) {
  const ref = useRef(null);
  useEffect(() => {
    drawWave(ref.current, deck);
  }, [deck]);
  return <canvas ref={ref} className="waveform" />;
}

function PhraseIndicator({ deck, mixTrigger, mixPlan }) {
  const phraseBars = Number(mixPlan?.phraseBars || 16);
  const beatInfo = analyzeBeatGrid(deck, mixTrigger || 0.75, phraseBars);
  const barInPhrase = beatInfo.barInPhrase - 1;
  const beatInBar = beatInfo.beatInBar;
  const secsUntilTrigger = beatInfo.secsUntilTrigger;
  const secsUntilPhraseMix = beatInfo.secsUntilPhraseMix;
  const showMixHint = deck.isPlaying && secsUntilPhraseMix > 0 && secsUntilPhraseMix < 90;
  const targetBar = clamp(Number(mixPlan?.mixOnBar || 0), 0, phraseBars);

  if (!deck.previewUrl) return null;

  return (
    <div className="phrase-indicator">
      <div className="phrase-header">
        <span className="phrase-label">Bar {barInPhrase + 1} / {phraseBars} · Beat {beatInBar}</span>
        {showMixHint && (
          <span className="phrase-mix-hint">Mix window {formatSeconds(Math.max(0, secsUntilPhraseMix))} · Trigger {formatSeconds(Math.max(0, secsUntilTrigger))}</span>
        )}
      </div>
      <div className="phrase-grid">
        {Array.from({ length: phraseBars }).map((_, i) => (
          <div key={i} className={`phrase-cell${i < barInPhrase ? ' past' : i === barInPhrase ? ' active' : ''}${targetBar > 0 && i === targetBar - 1 ? ' target' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function CustomSelect({ value, options, onChange, mono = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const getLabel = (opt) => (typeof opt === 'string' ? opt : opt.label);
  const getValue = (opt) => (typeof opt === 'string' ? opt : opt.value);
  const currentLabel = getLabel(options.find((o) => getValue(o) === String(value)) || options[0]);

  return (
    <div className={`custom-select${open ? ' open' : ''}${mono ? ' mono' : ''}`} ref={ref}>
      <button type="button" className="custom-select-trigger" onClick={() => setOpen((p) => !p)}>
        <span>{currentLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-list">
          {options.map((opt) => (
            <button
              type="button"
              key={getValue(opt)}
              className={`custom-select-option${getValue(opt) === String(value) ? ' active' : ''}`}
              onClick={() => { onChange(getValue(opt)); setOpen(false); }}
            >
              {getLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchModal({ deckId, library, onClose, onLoad, pushQueue }) {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('techno');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  async function runSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResults(await api(`/api/search?q=${encodeURIComponent(query)}&genre=${encodeURIComponent(genre)}&limit=12`));
    } catch (requestError) {
      setResults([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const list = tab === 'search' ? results : library;

  return (
    <div className="modal-shell" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <label>LOAD TRACK</label>
            <h3>Deck {deckId}</h3>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="subtabs">
          <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Search iTunes</button>
          <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>From Library</button>
        </div>

        {tab === 'search' && (
          <form className="search-bar" onSubmit={runSearch}>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artist, track, or energy..." />
            <CustomSelect value={genre} options={GENRES} onChange={setGenre} />
            <button className="button-accent" type="submit">{loading ? 'Searching...' : 'Search'}</button>
          </form>
        )}

        <div className="modal-list">
          {error && <p className="error-copy">{error}</p>}
          {!list.length && <div className="empty-card">No tracks here yet. Search iTunes or import a library first.</div>}
          {list.map((track, index) => (
            <article key={`${track.trackId || track.trackName}-${index}`} className="modal-item">
              <div className="modal-art">{track.artwork ? <img src={track.artwork} alt="" /> : 'MIX'}</div>
              <div className="modal-copy">
                <b>{track.trackName}</b>
                <p>{track.artist}</p>
                <small>{track.bpm} BPM · {formatSeconds(track.duration)} · {track.previewUrl ? 'Preview ready' : 'Metadata only'}</small>
              </div>
              <div className="modal-actions">
                <button className="button-surface" onClick={() => { onLoad(track, deckId); onClose(); }}>Load</button>
                <button className="button-surface" onClick={() => pushQueue(deckId, track)}>Queue</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistorySidebar({ history, open, setOpen }) {
  function exportHistory() {
    const body = history.map((item) => `${item.time} | Deck ${item.deck} | ${item.trackName} | ${item.durationLabel}`).join('\n');
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'setmind-history.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className={open ? 'history-sidebar open' : 'history-sidebar'}>
      <button className="history-toggle" onClick={() => setOpen((prev) => !prev)}>{open ? 'Close' : 'History'}</button>
      <div className="history-card glass-card">
        <div className="history-head">
          <label>SET HISTORY</label>
          <button onClick={exportHistory}>Export</button>
        </div>
        <div className="history-list">
          {!history.length && <p className="muted-copy">Played tracks will appear here after you start mixing.</p>}
          {history.map((item, index) => (
            <article key={`${item.time}-${index}`}>
              <strong>{item.trackName}</strong>
              <p>{item.time} · Deck {item.deck} · {item.durationLabel}</p>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}

function DeckPanel({ deck, setDeck, audio, openSearch, openAi, pushHistory, active, mixTrigger, mixPlan }) {
  const currentSeconds = Math.floor(deck.duration * deck.progress);

  function togglePlay() {
    if (deck.isPlaying) {
      audio.pause(deck.id, deck, setDeck);
      return;
    }
    audio.play(deck.id, deck, setDeck).then((started) => {
      if (started) pushHistory(deck.id, deck);
    }).catch((error) => {
      setDeck((prev) => ({ ...prev, error: error.message }));
    });
  }

  function tapTempo() {
    setDeck((prev) => {
      const taps = [...prev.taps, Date.now()].slice(-8);
      if (taps.length < 3) return { ...prev, taps };
      const diffs = taps.slice(1).map((value, index) => value - taps[index]);
      const average = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
      return { ...prev, taps, bpm: Math.round(60000 / average) };
    });
  }

  function updateEq(name, value) {
    setDeck((prev) => ({
      ...prev,
      eq: { ...prev.eq, [name]: Number(value) }
    }));
  }

  return (
    <section className={active ? 'deck-card glass-card active' : 'deck-card glass-card'}>
      <div className="panel-header">
        <div>
          <label>Deck {deck.id}{active ? <span className="deck-live-tag">LIVE</span> : null}</label>
          <h2>{deck.trackName}</h2>
          <p>{deck.artist}</p>
        </div>
        <Artwork deck={deck} />
      </div>

      <div className="deck-stat-row">
        <div className="deck-stat">
          <span>BPM</span>
          <strong>{adjustedBpm(deck).toFixed(1)}</strong>
        </div>
        <div className="deck-stat">
          <span>Pitch</span>
          <strong>{deck.pitch >= 0 ? '+' : ''}{deck.pitch.toFixed(1)}%</strong>
        </div>
        <div className="deck-stat key-stat">
          <span>Key</span>
          <CustomSelect value={deck.key} options={KEYS} onChange={(key) => setDeck((prev) => ({ ...prev, key }))} mono />
        </div>
      </div>

      <Waveform deck={deck} />
      <PhraseIndicator deck={deck} mixTrigger={mixTrigger} mixPlan={mixPlan} />

      <div className="timeline-card">
        <div className="progress-bar" onClick={(event) => audio.seek(deck.id, event.nativeEvent.offsetX / event.currentTarget.clientWidth, deck, setDeck)}>
          <span style={{ width: `${deck.progress * 100}%` }} />
        </div>
        <div className="time-row">
          <small>{formatSeconds(currentSeconds)}</small>
          <small>{formatSeconds(deck.duration)}</small>
        </div>
      </div>

      <div className="transport-row">
        <button onClick={() => audio.seek(deck.id, 0, deck, setDeck)}>Start</button>
        <button onClick={() => audio.seek(deck.id, clamp(deck.progress - 0.08, 0, 1), deck, setDeck)}>- Jump</button>
        <button className={deck.isPlaying ? 'transport-main live' : 'transport-main'} onClick={togglePlay}>{deck.isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => audio.seek(deck.id, clamp(deck.progress + 0.08, 0, 1), deck, setDeck)}>+ Jump</button>
        <button onClick={tapTempo}>Tap BPM</button>
      </div>

      <div className="pill-row">
        <button className={deck.loop ? 'pill-button active' : 'pill-button'} onClick={() => setDeck((prev) => ({ ...prev, loop: !prev.loop }))}>Loop</button>
        <button className={deck.keyLock ? 'pill-button active' : 'pill-button'} onClick={() => setDeck((prev) => ({ ...prev, keyLock: !prev.keyLock }))}>Key Lock</button>
        <button className="pill-button" onClick={() => setDeck((prev) => ({ ...prev, hotCues: [prev.progress, ...prev.hotCues.slice(1)] }))}>Set Cue</button>
        <button className="pill-button" onClick={() => openAi(deck.id)}>AI Suggest</button>
      </div>

      <div className="cue-grid">
        {deck.hotCues.map((cue, index) => (
          <button
            key={`${deck.id}-cue-${index}`}
            className={cue !== null ? 'cue-pad set' : 'cue-pad'}
            onClick={() => cue !== null && audio.seek(deck.id, cue, deck, setDeck)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="deck-control-grid">
        <label>
          Pitch
          <input type="range" min="-8" max="8" step="0.1" value={deck.pitch} onChange={(event) => setDeck((prev) => ({ ...prev, pitch: Number(event.target.value) }))} />
        </label>
        <label>
          Volume
          <input type="range" min="0" max="100" value={deck.volume} onChange={(event) => setDeck((prev) => ({ ...prev, volume: Number(event.target.value) }))} />
        </label>
      </div>

      <div className="eq-row">
        {['low', 'mid', 'high'].map((band) => (
          <label key={band} className="eq-control">
            <span>{band.toUpperCase()}</span>
            <input type="range" min="-12" max="12" value={deck.eq[band]} onChange={(event) => updateEq(band, event.target.value)} />
            <small>{deck.eq[band]}</small>
          </label>
        ))}
      </div>

      <div className="queue-box">
        <div className="queue-head">
          <span>Next Queue</span>
          <button onClick={() => openSearch(deck.id)}>+ Add</button>
        </div>
        {[0, 1, 2].map((slot) => {
          const item = deck.queue[slot];
          return (
            <div key={`${deck.id}-queue-${slot}`} className="queue-item">
              <div>
                <b>{item ? item.trackName : 'Queue slot empty'}</b>
                <small>{item ? `${item.artist} · ${item.bpm} BPM` : 'Search or import tracks to prep this deck.'}</small>
              </div>
              {item && (
                <button className="button-surface slim" onClick={() => setDeck(makeDeck(deck.id, item))}>Load</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="deck-action-row">
        <button className="button-surface wide-button" onClick={() => openSearch(deck.id)}>Load Track</button>
        <button className="button-accent wide-button" onClick={() => openAi(deck.id)}>AI Suggest</button>
      </div>

      {deck.error && <p className="error-copy">{deck.error}</p>}
    </section>
  );
}

function MixerPanel({
  deckA,
  deckB,
  setDeckA,
  setDeckB,
  crossfader,
  setCrossfader,
  effects,
  setEffects,
  energy,
  setEnergy,
  aiMixer,
  setAiMixer,
  autoMixAdvice,
  mixPlan,
  mixPlanLoading,
  mixPlanError,
  requestMixPlan,
  autoLoadSimilarTrack,
  liveBeatHint,
  aiQueueLane
}) {
  const compatibility = getCompatibility(deckA.key, deckB.key);

  return (
    <div className="mixer-column">
      <section className="mixer-card glass-card">
        <div className="panel-header compact">
          <div>
            <label>MIXER</label>
            <h3>Center Engine</h3>
          </div>
          <span className={`compat-chip ${compatibility.tone}`}>{compatibility.text}</span>
        </div>

        <div className="sync-summary">
          <span>{adjustedBpm(deckA).toFixed(1)}</span>
          <span className={Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)) <= 1 ? 'bpm-sync-text' : 'bpm-gap-text'}>
            {Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)) <= 1 ? 'IN SYNC' : `Δ ${Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)).toFixed(1)} BPM`}
          </span>
          <span>{adjustedBpm(deckB).toFixed(1)}</span>
        </div>

        <div className="mixer-actions">
          <button className="pill-button" onClick={() => setDeckB((prev) => ({ ...prev, bpm: adjustedBpm(deckA), pitch: 0 }))}>Sync A to B</button>
          <button className="pill-button" onClick={() => setDeckA((prev) => ({ ...prev, bpm: adjustedBpm(deckB), pitch: 0 }))}>Sync B to A</button>
        </div>

        <div className="crossfader-card">
          <div className="cross-label">
            <small>A</small>
            <input type="range" min="0" max="100" value={crossfader} onChange={(event) => setCrossfader(Number(event.target.value))} />
            <small>B</small>
          </div>
          <div className="cross-readout">Crossfader {Math.round(crossfader)}%</div>
        </div>

        <div className="energy-stack">
          <div className="energy-topline">
            <span>Energy meter</span>
            <strong>{energy}/10</strong>
          </div>
          <div className="energy-meter horizontal">
            {Array.from({ length: 10 }).map((_, index) => <i key={index} className={index < energy ? 'on' : ''} />)}
          </div>
          <input type="range" min="1" max="10" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} />
        </div>

        <div className="effects-grid">
          {['REVERB', 'DELAY', 'FILTER', 'FLANGER'].map((effect) => (
            <button key={effect} className={effects[effect] ? 'effect-chip active' : 'effect-chip'} onClick={() => setEffects((prev) => ({ ...prev, [effect]: !prev[effect] }))}>
              {effect}
            </button>
          ))}
        </div>
      </section>

      <section className="ai-mixer-card glass-card">
        <div className="panel-header compact">
          <div>
            <label>AI MIXER</label>
            <h3>Auto-transition engine</h3>
          </div>
          <button className={aiMixer.enabled ? 'pill-button active' : 'pill-button'} onClick={() => setAiMixer((prev) => ({ ...prev, enabled: !prev.enabled }))}>
            {aiMixer.enabled ? 'Armed' : 'Off'}
          </button>
        </div>

        <p className="mixer-copy">{autoMixAdvice.headline}</p>
        <p className="muted-copy">{autoMixAdvice.detail}</p>

        <div className="auto-load-row">
          <button
            className="auto-load-btn"
            disabled={!deckA.previewUrl || aiMixer.status.includes('Finding')}
            onClick={() => autoLoadSimilarTrack(deckA, 'B')}
          >
            Similar for B
          </button>
          <button
            className="auto-load-btn"
            disabled={!deckB.previewUrl || aiMixer.status.includes('Finding')}
            onClick={() => autoLoadSimilarTrack(deckB, 'A')}
          >
            Similar for A
          </button>
        </div>

        <div className="mixplan-card">
          <div className="mixplan-head">
            <div>
              <label>AI TRANSITION PLAN</label>
              <strong>{mixPlan ? mixPlan.headline : 'No plan generated yet'}</strong>
            </div>
            <button className="button-surface slim" onClick={requestMixPlan}>{mixPlanLoading ? 'Thinking...' : 'Refresh Plan'}</button>
          </div>
          {mixPlanError && <p className="error-copy">{mixPlanError}</p>}
          {mixPlan && (
            <>
              <p className="muted-copy">{mixPlan.reasoning}</p>
              <div className="mixplan-stats">
                <article><span>Mode</span><strong>{mixPlan.mode}</strong></article>
                <article><span>Out At</span><strong>{Math.round(Number(mixPlan.outgoingStartProgress || mixPlan.triggerPoint || aiMixer.trigger) * 100)}%</strong></article>
                <article><span>Fade</span><strong>{mixPlan.crossfadeSeconds}s</strong></article>
                <article><span>In At</span><strong>{Math.round(Number(mixPlan.incomingCueStart || mixPlan.cueStart || 0) * 100)}%</strong></article>
                <article><span>BPM</span><strong>{mixPlan.targetBpm}</strong></article>
                {mixPlan.phraseBars && <article><span>Phrase</span><strong>{mixPlan.phraseBars} bars</strong></article>}
              </div>
              <div className="mixplan-steps">
                {(mixPlan.preparation || []).map((step) => <p key={step}>{step}</p>)}
              </div>
            </>
          )}
        </div>

        <div className="ai-mixer-grid">
          <label>
            Transition style
            <CustomSelect
              value={aiMixer.mode}
              options={[{ value: 'smooth', label: 'Smooth blend' }, { value: 'tight', label: 'Tight handoff' }, { value: 'hard', label: 'Hard cut' }]}
              onChange={(mode) => setAiMixer((prev) => ({ ...prev, mode }))}
            />
          </label>
          <label>
            Trigger point
            <CustomSelect
              value={String(aiMixer.trigger)}
              options={[{ value: '0.65', label: '65%' }, { value: '0.72', label: '72%' }, { value: '0.8', label: '80%' }]}
              onChange={(val) => setAiMixer((prev) => ({ ...prev, trigger: Number(val) }))}
            />
          </label>
        </div>

        <div className="mixplan-card">
          <div className="mixplan-head">
            <div>
              <label>LIVE COUNTDOWN</label>
              <strong>{liveBeatHint.headline}</strong>
            </div>
          </div>
          <p className="muted-copy">{liveBeatHint.detail}</p>
        </div>

        <div className="mixplan-card">
          <div className="mixplan-head">
            <div>
              <label>AI QUEUE LANE</label>
              <strong>{aiQueueLane.length ? 'Prepared suggestions' : 'No AI queued tracks yet'}</strong>
            </div>
          </div>
          <div className="mixplan-steps">
            {aiQueueLane.length ? aiQueueLane.map((item) => (
              <p key={`${item.deck}-${item.trackName}`}>Deck {item.deck}: {item.trackName} · {item.artist || 'Unknown Artist'} · {item.bpm} BPM</p>
            )) : <p>Use AI Assist queue buttons to stage tracks here before loading them.</p>}
          </div>
        </div>

        <div className={aiMixer.enabled ? 'ai-mixer-status armed' : 'ai-mixer-status'}>
          <strong>{aiMixer.enabled ? '● Live' : 'Status'}</strong>
          <span>{aiMixer.status}</span>
        </div>
      </section>
    </div>
  );
}

function AIDrawer({ open, setOpen, deckA, deckB, contextDeckId, onLoadSmart, onQueueSmart }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');

  async function send(text = prompt) {
    const message = String(text || '').trim();
    if (!message) return;
    setLoading(true);
    setError('');
    try {
      setResponse(await api('/api/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: message, deckA, deckB, contextDeckId })
      }));
      setPrompt('');
    } catch (requestError) {
      setResponse(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrack(track, deckId) {
    const key = `${track.track}-${deckId}`;
    setLoadingDeck(key);
    try {
      await onLoadSmart({ trackName: track.track, track: track.track, bpm: track.bpm, genre: deckId === 'A' ? deckA.genre : deckB.genre }, deckId);
    } finally {
      setLoadingDeck('');
    }
  }

  async function queueTrack(track, deckId) {
    const key = `${track.track}-queue-${deckId}`;
    setLoadingDeck(key);
    try {
      await onQueueSmart({ trackName: track.track, track: track.track, bpm: track.bpm, genre: deckId === 'A' ? deckA.genre : deckB.genre }, deckId);
    } finally {
      setLoadingDeck('');
    }
  }

  return (
    <>
      {!open && <button className="ai-fab" onClick={() => setOpen(true)}>AI</button>}
      <section className={open ? 'ai-drawer open' : 'ai-drawer'}>
        <div className="ai-top">
          <div>
            <label>AI PROMPTER</label>
            <h3>Tell SETMIND what to do</h3>
          </div>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>

        <div className="ai-response">
          {error && <p className="error-copy">{error}</p>}
          {!error && !response && !loading && (
            <p className="muted-copy">Ask for darker tracks, energy changes, BPM shifts, or crowd rescue moves.</p>
          )}
          {loading && <p className="muted-copy">Thinking...</p>}
          {response && (
            <>
              {response.response && <p>{response.response}</p>}
              {(response.suggestedTracks || []).map((track, index) => (
                <article key={`${track.track}-${index}`} className="ai-track-card">
                  <div className="suggestion-info">
                    <b>{track.track}</b>
                    <small>{track.bpm} BPM · {track.reason}</small>
                  </div>
                  <div className="suggestion-deck-buttons">
                    <button
                      className="deck-load-btn deck-a"
                      onClick={() => loadTrack(track, 'A')}
                      disabled={loadingDeck === `${track.track}-A`}
                    >
                      <span className="deck-badge">A</span>
                      <span>{loadingDeck === `${track.track}-A` ? '...' : 'Load'}</span>
                    </button>
                    <button
                      className="deck-load-btn deck-b"
                      onClick={() => loadTrack(track, 'B')}
                      disabled={loadingDeck === `${track.track}-B`}
                    >
                      <span className="deck-badge">B</span>
                      <span>{loadingDeck === `${track.track}-B` ? '...' : 'Load'}</span>
                    </button>
                    <button
                      className="deck-load-btn deck-queue"
                      onClick={() => queueTrack(track, 'A')}
                      disabled={loadingDeck === `${track.track}-queue-A`}
                    >
                      <span className="deck-badge">A+</span>
                      <span>{loadingDeck === `${track.track}-queue-A` ? '...' : 'Queue'}</span>
                    </button>
                    <button
                      className="deck-load-btn deck-queue"
                      onClick={() => queueTrack(track, 'B')}
                      disabled={loadingDeck === `${track.track}-queue-B`}
                    >
                      <span className="deck-badge">B+</span>
                      <span>{loadingDeck === `${track.track}-queue-B` ? '...' : 'Queue'}</span>
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>

        <div className="chip-row">
          {QUICK_PROMPTS.map((item) => <button key={item} onClick={() => send(item)}>{item}</button>)}
        </div>

        <div className="ai-input">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder="make it darker, go 130 BPM, crowd is losing it..."
          />
          <button className="button-accent" onClick={() => send()} disabled={loading}>
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </section>
    </>
  );
}

function CrowdTab({ deckA, deckB, energy, setEnergy, onLoadSmart }) {
  const active = deckA.isPlaying ? deckA : deckB.isPlaying ? deckB : deckA;
  const [form, setForm] = useState({
    crowdReaction: '',
    minutesIntoSet: 45,
    genre: 'techno',
    currentTrack: active.trackName,
    currentBpm: adjustedBpm(active)
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      currentTrack: active.trackName,
      currentBpm: adjustedBpm(active)
    }));
  }, [active.trackName, active.bpm, active.pitch]);

  async function run() {
    setLoading(true);
    setError('');
    try {
      setResult(await api('/api/pulse', {
        method: 'POST',
        body: JSON.stringify({
          currentTrack: form.currentTrack,
          currentBpm: Number(form.currentBpm),
          energyLevel: energy,
          crowdReaction: form.crowdReaction,
          minutesIntoSet: Number(form.minutesIntoSet),
          totalDuration: 90,
          genre: form.genre,
          lastFiveTracks: [deckA.trackName, deckB.trackName]
        })
      }));
    } catch (requestError) {
      setResult(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const stateTone = {
    peaking: 'green',
    building: 'blue',
    fading: 'orange',
    steady: 'grey',
    confused: 'red',
    high: 'green',
    euphoric: 'green'
  };

  const directiveTone = {
    PUSH: 'green',
    HOLD: 'amber',
    'PULL BACK': 'cyan',
    PIVOT: 'red'
  };

  return (
    <section className="tab-shell split-layout">
      <aside className="glass-card form-card">
        <div className="panel-header compact">
          <div>
            <label>CROWD ANALYSIS</label>
            <h3>Read the room</h3>
          </div>
          <span className="tiny-note">Powered by Gemini AI</span>
        </div>

        <div className="field-group">
          <span>Energy Level</span>
          <strong>{energy}/10</strong>
          <input type="range" min="1" max="10" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} />
        </div>

        <label>
          Crowd Reaction
          <input value={form.crowdReaction} onChange={(event) => setForm({ ...form, crowdReaction: event.target.value })} placeholder="describe what you're seeing..." />
        </label>

        <label>
          Minutes Into Set
          <div className="inline-group">
            <input type="number" value={form.minutesIntoSet} onChange={(event) => setForm({ ...form, minutesIntoSet: event.target.value })} />
            <small>/ 90 min total</small>
          </div>
        </label>

        <label>
          Genre
          <CustomSelect value={form.genre} options={GENRES} onChange={(genre) => setForm({ ...form, genre })} />
        </label>

        <label>
          Current Track
          <input value={form.currentTrack} onChange={(event) => setForm({ ...form, currentTrack: event.target.value })} />
        </label>

        <label>
          Current BPM
          <input type="number" value={form.currentBpm} onChange={(event) => setForm({ ...form, currentBpm: event.target.value })} />
        </label>

        <button className="button-accent tall-button" onClick={run}>{loading ? 'Running...' : 'RUN CROWD PULSE'}</button>
      </aside>

      <main className="glass-card result-card">
        {error && <p className="error-copy">{error}</p>}
        {!error && !result && <div className="empty-card large">Fill in the crowd details and run analysis. Gemini AI will read the room for you.</div>}
        {result && (
          <>
            <div className="result-top">
              <span className={`badge ${stateTone[String(result.crowdState || '').toLowerCase()] || 'grey'}`}>{String(result.crowdState || 'steady').toUpperCase()}</span>
              <div className="momentum-row">
                {Array.from({ length: 10 }).map((_, index) => <i key={index} className={index < Number(result.momentumScore || 0) ? 'on' : ''} />)}
                <strong>{result.momentumScore}/10</strong>
              </div>
              <span className={`badge ${directiveTone[result.energyDirective] || 'grey'}`}>{result.energyDirective}</span>
            </div>

            <p className="analysis-text">{result.analysis}</p>

            <section className="result-section">
              <h3>Next Tracks</h3>
              <div className="suggestion-stack">
                {(result.nextThreeTracks || []).map((track, index) => (
                  <article key={`${track.track}-${index}`} className="suggestion-card">
                    <div className="suggestion-icon">AI</div>
                    <div className="suggestion-copy">
                      <b>{track.track}</b>
                      <small>{track.bpm} BPM</small>
                      <p><i>{track.reason}</i></p>
                    </div>
                    <div className="suggestion-buttons">
                      <button className="button-surface" onClick={() => onLoadSmart({ trackName: track.track, track: track.track, bpm: track.bpm, genre: form.genre }, 'A')}>Load A</button>
                      <button className="button-surface" onClick={() => onLoadSmart({ trackName: track.track, track: track.track, bpm: track.bpm, genre: form.genre }, 'B')}>Load B</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <blockquote className="tip-card">{result.transitionTip}</blockquote>
            {result.urgentAlert && <div className="alert-card">Alert: {result.urgentAlert}</div>}
          </>
        )}
      </main>
    </section>
  );
}

function SetPlanTab({ onLoadSmart }) {
  const [form, setForm] = useState({
    venue: 'club',
    crowd: '300 people, aged 22-30',
    duration: 90,
    genre: 'techno',
    peakTime: '2am',
    openerOrHeadliner: 'headliner'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      setResult(await api('/api/plan', {
        method: 'POST',
        body: JSON.stringify(form)
      }));
    } catch (requestError) {
      setResult(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'setmind-plan.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }


  return (
    <section className="tab-shell split-layout plan-layout">
      <aside className="glass-card form-card narrow">
        <div className="panel-header compact">
          <div>
            <label>SET ARCHITECT</label>
            <h3>Build the night</h3>
          </div>
        </div>

        <label>
          Venue
          <CustomSelect value={form.venue} options={['club', 'festival', 'warehouse', 'rooftop', 'bar', 'private']} onChange={(venue) => setForm({ ...form, venue })} />
        </label>
        <label>
          Crowd
          <input value={form.crowd} onChange={(event) => setForm({ ...form, crowd: event.target.value })} />
        </label>
        <label>
          Duration
          <div className="inline-group">
            <input type="number" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} />
            <small>mins</small>
          </div>
        </label>
        <label>
          Genre
          <CustomSelect value={form.genre} options={GENRES} onChange={(genre) => setForm({ ...form, genre })} />
        </label>
        <label>
          Peak time
          <input value={form.peakTime} onChange={(event) => setForm({ ...form, peakTime: event.target.value })} />
        </label>
        <div className="role-row">
          <span>Role</span>
          <button className={form.openerOrHeadliner === 'opener' ? 'pill-button active' : 'pill-button'} onClick={() => setForm({ ...form, openerOrHeadliner: 'opener' })}>Opener</button>
          <button className={form.openerOrHeadliner === 'headliner' ? 'pill-button active' : 'pill-button'} onClick={() => setForm({ ...form, openerOrHeadliner: 'headliner' })}>Headliner</button>
        </div>
        <button className="button-accent tall-button" onClick={generate}>{loading ? 'Gemini is building your set...' : 'GENERATE SET PLAN'}</button>
        {result && <button className="button-surface wide-button" onClick={exportPlan}>Export .txt</button>}
      </aside>

      <main className="glass-card result-card">
        {error && <p className="error-copy">{error}</p>}
        {!error && !result && <div className="empty-card large">Describe your gig and Gemini AI will architect your full set.</div>}
        {result && (
          <>
            <h2>{result.setTitle}</h2>
            <div className="phase-row">
              {(result.energyArc || []).map((phase) => (
                <article className="phase-card" key={`${phase.phase}-${phase.bpmRange}`}>
                  <span>{phase.phase}</span>
                  <strong>{phase.bpmRange}</strong>
                  <div className="phase-energy">
                    {Array.from({ length: 10 }).map((_, index) => <i key={index} className={index < Number(phase.energy || 0) ? 'on' : ''} />)}
                  </div>
                  <small>{phase.duration}</small>
                  <p>{phase.description}</p>
                  <div className="phase-links">
                    {(phase.exampleTracks || []).map((track) => (
                      <button key={track} onClick={() => onLoadSmart({ trackName: track, track, genre: form.genre }, 'A')}>{track}</button>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <section className="result-section">
              <h3>Crowd Tips</h3>
              <ul className="clean-list">{(result.crowdReadingTips || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            <section className="result-section">
              <h3>Emergency Pivots</h3>
              <div className="pivot-stack">
                {(result.emergencyPivots || []).map((pivot, index) => (
                  <article key={index}>
                    <span>Signal</span>
                    <p>{typeof pivot === 'string' ? pivot : `${pivot.signal} -> ${pivot.action}`}</p>
                  </article>
                ))}
              </div>
            </section>

          </>
        )}
      </main>
    </section>
  );
}

function LibraryTab({ library, setLibrary, onLoad }) {
  const [subtab, setSubtab] = useState('search');
  const [libQuery, setLibQuery] = useState('');
  const [libGenre, setLibGenre] = useState('techno');
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  async function runSearch(event) {
    event.preventDefault();
    setError('');
    try {
      setResults(await api(`/api/search?q=${encodeURIComponent(libQuery)}&genre=${encodeURIComponent(libGenre)}&limit=12`));
    } catch (requestError) {
      setResults([]);
      setError(requestError.message);
    }
  }

  function importFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      let next = [];
      if (ext === 'csv') {
        next = text.split(/\r?\n/).filter(Boolean).slice(1).map((line) => {
          const [trackName, artist, bpm, key, duration] = line.split(',');
          return {
            ...BASE_TRACK,
            trackName: trackName?.trim() || 'Unknown Track',
            artist: artist?.trim() || 'Unknown Artist',
            bpm: Number(bpm || 128),
            key: key?.trim() || 'Cm',
            duration: Number(duration || 225),
            genre: 'imported'
          };
        });
      } else {
        next = text.split(/\r?\n/).filter(Boolean).map((line) => {
          const [artist, ...rest] = line.split(' - ');
          return {
            ...BASE_TRACK,
            trackName: rest.join(' - ') || line,
            artist: rest.length ? artist : 'Unknown Artist',
            genre: 'imported'
          };
        });
      }
      setLibrary(next);
    };
    reader.readAsText(file);
  }

  async function runBrain() {
    setError('');
    try {
      setAnalysis(await api('/api/brain', {
        method: 'POST',
        body: JSON.stringify({
          tracks: library.map((track) => `${track.trackName} - ${track.artist}`),
          targetBpm: '128-134',
          targetEnergy: 8,
          currentKey: 'Cm'
        })
      }));
    } catch (requestError) {
      setAnalysis(null);
      setError(requestError.message);
    }
  }

  function updateLibraryItem(index, field, value) {
    setLibrary((prev) => prev.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      [field]: field === 'bpm' || field === 'duration' ? Number(value) : value
    } : item));
  }

  return (
    <section className="tab-shell library-stage">
      <div className="subtabs">
        <button className={subtab === 'search' ? 'active' : ''} onClick={() => setSubtab('search')}>Search</button>
        <button className={subtab === 'import' ? 'active' : ''} onClick={() => setSubtab('import')}>Import</button>
      </div>

      {subtab === 'search' ? (
        <div className="glass-card library-card">
          {error && <p className="error-copy">{error}</p>}
          <form className="search-bar full" onSubmit={runSearch}>
            <input value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder="Search for tracks to add to your decks" />
            <CustomSelect value={libGenre} options={GENRES} onChange={setLibGenre} />
            <button className="button-accent" type="submit">Search iTunes</button>
          </form>

          <div className="library-grid">
            {!results.length && <div className="empty-card large">Search for tracks to add to your decks.</div>}
            {results.map((track, index) => (
              <article key={`${track.trackId || track.trackName}-${index}`} className="library-tile">
                <div className="tile-art">{track.artwork ? <img src={track.artwork} alt="" /> : 'AI'}</div>
                <div className="tile-copy">
                  <b>{track.trackName}</b>
                  <p>{track.artist}</p>
                  <div>
                    <span>{track.bpm} BPM</span>
                    <small>{formatSeconds(track.duration)}</small>
                    <small>{track.previewUrl ? 'Preview ready' : 'Metadata only'}</small>
                  </div>
                </div>
                <div className="tile-actions">
                  <button className="button-surface" onClick={() => onLoad(track, 'A')}>Load A</button>
                  <button className="button-surface" onClick={() => onLoad(track, 'B')}>Load B</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <>
          <label className="glass-card import-drop" onDrop={(event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); }} onDragOver={(event) => event.preventDefault()}>
            <input type="file" accept=".txt,.csv,.m3u,.m3u8" onChange={(event) => importFile(event.target.files[0])} />
            <strong>Drop .txt, .csv, or .m3u file</strong>
            <span>or click to browse</span>
            <small>Imported tracks can load into decks even when preview audio is not available.</small>
          </label>

          <div className="glass-card import-table-card">
            {error && <p className="error-copy">{error}</p>}
            <div className="import-table">
              <header>
                <span>#</span>
                <span>Track</span>
                <span>Artist</span>
                <span>BPM</span>
                <span>Key</span>
                <span>Duration</span>
                <span>Load</span>
              </header>

              {library.map((track, index) => (
                <div className="import-row" key={`${track.trackName}-${index}`}>
                  <span>{index + 1}</span>
                  <input value={track.trackName} onChange={(event) => updateLibraryItem(index, 'trackName', event.target.value)} />
                  <input value={track.artist} onChange={(event) => updateLibraryItem(index, 'artist', event.target.value)} />
                  <input value={track.bpm} onChange={(event) => updateLibraryItem(index, 'bpm', event.target.value)} />
                  <input value={track.key} onChange={(event) => updateLibraryItem(index, 'key', event.target.value)} />
                  <input value={track.duration} onChange={(event) => updateLibraryItem(index, 'duration', event.target.value)} />
                  <div className="inline-actions">
                    <button onClick={() => onLoad(track, 'A')}>A</button>
                    <button onClick={() => onLoad(track, 'B')}>B</button>
                  </div>
                </div>
              ))}
            </div>
            {!!library.length && <button className="button-accent" onClick={runBrain}>Analyze with Track Brain</button>}
          </div>

          {analysis && (
            <div className="glass-card analysis-card">
              <h3>Track Brain</h3>
              <section>
                <h4>Top Picks</h4>
                <ul className="clean-list">{(analysis.topPicks || []).map((item) => <li key={item.track}>{item.track} - {item.reason}</li>)}</ul>
              </section>
              <section>
                <h4>Power Sequence</h4>
                <ul className="clean-list">{(analysis.powerSequence || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section>
                <h4>Library Gaps</h4>
                <ul className="clean-list">{(analysis.libraryGaps || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DecksTab({ deckA, setDeckA, deckB, setDeckB, library, energy, setEnergy, history, setHistory }) {
  const [crossfader, setCrossfader] = useState(50);
  const [effects, setEffects] = useState({ REVERB: false, DELAY: false, FILTER: false, FLANGER: false });
  const [searchDeckId, setSearchDeckId] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDeckId, setAiDeckId] = useState('A');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiMixer, setAiMixer] = useState({
    enabled: false,
    mode: 'smooth',
    trigger: 0.72,
    status: 'Waiting for two playable decks'
  });
  const [mixPlan, setMixPlan] = useState(null);
  const [mixPlanLoading, setMixPlanLoading] = useState(false);
  const [mixPlanError, setMixPlanError] = useState('');
  const [aiQueueLane, setAiQueueLane] = useState([]);
  const mixRef = useRef({ running: false, timer: null, timeout: null });
  const autoQueueRef = useRef({ loading: false, lastKey: '' });
  const audio = useAudioEngine(deckA, deckB, setDeckA, setDeckB, crossfader);

  const autoMixAdvice = useMemo(() => makeAutoMixAdvice(deckA, deckB), [deckA, deckB]);
  const mixSignature = `${deckA.trackName}|${deckA.artist}|${adjustedBpm(deckA)}|${deckA.key}::${deckB.trackName}|${deckB.artist}|${adjustedBpm(deckB)}|${deckB.key}`;

  function loadTrack(track, deckId) {
    const prepared = makeDeck(deckId, { ...BASE_TRACK, ...track });
    if (deckId === 'A') {
      setDeckA(prepared);
    } else {
      setDeckB(prepared);
    }
  }

  async function loadTrackSmart(candidate, deckId) {
    const resolved = await resolvePlayableTrack(candidate, candidate.genre || deckA.genre || deckB.genre || 'music');
    loadTrack(resolved, deckId);
    return resolved;
  }

  async function queueTrackSmart(candidate, deckId) {
    const resolved = await resolvePlayableTrack(candidate, candidate.genre || deckA.genre || deckB.genre || 'music');
    pushQueue(deckId, resolved);
    setAiQueueLane((prev) => ([
      {
        deck: deckId,
        trackName: resolved.trackName,
        artist: resolved.artist,
        bpm: resolved.bpm
      },
      ...prev
    ].slice(0, 6)));
    return resolved;
  }

  function pushQueue(deckId, track) {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter((prev) => ({
      ...prev,
      queue: [...prev.queue, { ...BASE_TRACK, ...track }].slice(0, 3)
    }));
  }

  function promoteQueuedTrack(deckId) {
    const sourceDeck = deckId === 'A' ? deckA : deckB;
    const nextTrack = sourceDeck.queue[0];
    if (!nextTrack) return null;

    const prepared = makeDeck(deckId, { ...BASE_TRACK, ...nextTrack });
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter((prev) => ({
      ...prepared,
      queue: prev.queue.slice(1)
    }));
    setAiQueueLane((prev) => ([
      {
        deck: deckId,
        trackName: prepared.trackName,
        artist: prepared.artist,
        bpm: prepared.bpm
      },
      ...prev.filter((item) => !(item.deck === deckId && item.trackName === prepared.trackName && item.artist === prepared.artist))
    ].slice(0, 6)));
    return prepared;
  }

  function pushHistory(deckId, deck) {
    setHistory((prev) => ([
      {
        deck: deckId,
        trackName: deck.trackName,
        durationLabel: formatSeconds(deck.duration),
        time: new Date().toLocaleTimeString()
      },
      ...prev
    ].slice(0, 20)));
  }

  useEffect(() => {
    return () => {
      if (mixRef.current.timer) {
        clearInterval(mixRef.current.timer);
      }
      if (mixRef.current.timeout) {
        clearTimeout(mixRef.current.timeout);
      }
    };
  }, []);

  const liveBeatHint = useMemo(() => {
    const activeDeck = deckA.isPlaying ? deckA : deckB.isPlaying ? deckB : null;
    if (!activeDeck || !mixPlan) {
      return {
        headline: 'Waiting for active deck',
        detail: 'Start playback and arm AI Mixer to see the next phrase and downbeat countdown.'
      };
    }

    const targetProgress = Number(mixPlan.outgoingStartProgress || aiMixer.trigger);
    const beatInfo = analyzeBeatGrid(activeDeck, targetProgress, Number(mixPlan.phraseBars || 16));
    const targetBar = mixPlan.mixOnBar ? `bar ${mixPlan.mixOnBar}` : 'target bar';
    const targetBeat = mixPlan.mixOnBeat ? `beat ${mixPlan.mixOnBeat}` : 'target beat';

    return {
      headline: `${activeDeck.id} is on bar ${beatInfo.barInPhrase}, beat ${beatInfo.beatInBar}`,
      detail: `Next planned handoff: ${targetBar}, ${targetBeat}. Trigger in ${formatSeconds(Math.max(0, beatInfo.secsUntilTrigger))}.`
    };
  }, [deckA, deckB, mixPlan, aiMixer.trigger]);

  async function autoLoadSimilarTrack(sourceDeck, targetDeckId) {
    setAiMixer((prev) => ({ ...prev, status: 'Finding similar track for Deck ' + targetDeckId + '...' }));
    try {
      const result = await api('/api/prompt', {
        method: 'POST',
        body: JSON.stringify({
          prompt: `Suggest ONE track that would mix perfectly after "${sourceDeck.trackName}" by ${sourceDeck.artist}. The track plays at ${sourceDeck.bpm} BPM in key ${sourceDeck.key}, genre: ${sourceDeck.genre}. Return a track that blends harmonically and energetically.`,
          deckA,
          deckB,
          contextDeckId: targetDeckId
        })
      });
      const suggestions = result.suggestedTracks || [];
      if (!suggestions.length) {
        setAiMixer((prev) => ({ ...prev, status: 'No similar track found. Try searching manually.' }));
        return;
      }
      const candidate = suggestions[0];
      const resolved = await resolvePlayableTrack({
        trackName: candidate.track,
        track: candidate.track,
        bpm: candidate.bpm || sourceDeck.bpm,
        genre: sourceDeck.genre
      }, sourceDeck.genre);
      loadTrack(resolved, targetDeckId);
      setAiMixer((prev) => ({ ...prev, status: `Auto-loaded "${resolved.trackName}" onto Deck ${targetDeckId}` }));
    } catch (err) {
      setAiMixer((prev) => ({ ...prev, status: `Auto-load failed: ${err.message}` }));
    }
  }

  async function requestMixPlan() {
    if (!deckA.trackName || !deckB.trackName) return;
    setMixPlanLoading(true);
    setMixPlanError('');
    try {
      const plan = await api('/api/mixplan', {
        method: 'POST',
        body: JSON.stringify({
          deckA: {
            trackName: deckA.trackName,
            artist: deckA.artist,
            bpm: adjustedBpm(deckA),
            key: deckA.key,
            genre: deckA.genre,
            progress: deckA.progress,
            duration: deckA.duration,
            beatGrid: analyzeBeatGrid(deckA, aiMixer.trigger, Number(mixPlan?.phraseBars || 16))
          },
          deckB: {
            trackName: deckB.trackName,
            artist: deckB.artist,
            bpm: adjustedBpm(deckB),
            key: deckB.key,
            genre: deckB.genre,
            progress: deckB.progress,
            duration: deckB.duration,
            beatGrid: analyzeBeatGrid(deckB, aiMixer.trigger, Number(mixPlan?.phraseBars || 16))
          },
          currentlyPlaying: deckA.isPlaying ? 'A' : deckB.isPlaying ? 'B' : 'none',
          energyLevel: energy,
          compatibility: getCompatibility(deckA.key, deckB.key).text
        })
      });
      setMixPlan(plan);
      setAiMixer((prev) => ({
        ...prev,
        mode: ['smooth', 'tight', 'hard'].includes(plan.mode) ? plan.mode : prev.mode,
        trigger: clamp(Number(plan.outgoingStartProgress || plan.triggerPoint || prev.trigger), 0.55, 0.92),
        status: plan.headline || prev.status
      }));
    } catch (requestError) {
      const fallbackPlan = buildFallbackMixPlan(deckA, deckB, energy);
      setMixPlan(fallbackPlan);
      setMixPlanError(`Remote mix planner unavailable, using fallback plan. ${requestError.message}`);
      setAiMixer((prev) => ({
        ...prev,
        mode: fallbackPlan.mode,
        trigger: fallbackPlan.outgoingStartProgress,
        status: fallbackPlan.headline
      }));
    } finally {
      setMixPlanLoading(false);
    }
  }

  useEffect(() => {
    if (!deckA.previewUrl || !deckB.previewUrl) return;
    requestMixPlan();
  }, [mixSignature]);

  useEffect(() => {
    if (!aiMixer.enabled || mixRef.current.running) return;

    async function startMix(fromId, toId) {
      mixRef.current.running = true;
      setAiMixer((prev) => ({ ...prev, status: `Starting auto mix ${fromId} -> ${toId}` }));

      const fromDeck = fromId === 'A' ? deckA : deckB;
      let toDeck = toId === 'A' ? deckA : deckB;
      const setToDeck = toId === 'A' ? setDeckA : setDeckB;
      const setFromDeck = fromId === 'A' ? setDeckA : setDeckB;

      try {
        if (!toDeck.previewUrl) {
          const promoted = promoteQueuedTrack(toId);
          if (promoted) {
            toDeck = promoted;
            setAiMixer((prev) => ({ ...prev, status: `Promoted queued track to Deck ${toId}` }));
          }
        }

        const cueProgress = clamp(Number(mixPlan?.incomingCueStart ?? mixPlan?.cueStart ?? 0), 0, 0.24);
        const started = await audio.play(toId, { ...toDeck, progress: cueProgress }, setToDeck);
        if (!started) {
          setAiMixer((prev) => ({ ...prev, status: 'Auto mix needs preview-ready tracks on both decks' }));
          mixRef.current.running = false;
          return;
        }

        pushHistory(toId, toDeck);
        const planTargetBpm = mixPlan && Number.isFinite(Number(mixPlan.targetBpm)) ? Number(mixPlan.targetBpm) : adjustedBpm(fromDeck);
        const outgoingEndProgress = clamp(Number(mixPlan?.outgoingEndProgress ?? 0.94), 0.72, 0.99);
        const durationMs = mixPlan && Number.isFinite(Number(mixPlan.crossfadeSeconds))
          ? Number(mixPlan.crossfadeSeconds) * 1000
          : aiMixer.mode === 'hard' ? 2600 : aiMixer.mode === 'tight' ? 5200 : 7600;
        const stepMs = 200;
        const steps = Math.max(1, Math.floor(durationMs / stepMs));
        let step = 0;
        const startCross = fromId === 'A' ? Math.min(crossfader, 18) : Math.max(crossfader, 82);
        const endCross = toId === 'A' ? 0 : 100;
        const targetSetter = toId === 'A' ? setDeckA : setDeckB;

        setCrossfader(startCross);
        targetSetter((prev) => ({
          ...prev,
          bpm: planTargetBpm,
          pitch: clamp(((planTargetBpm / Math.max(1, prev.bpm)) - 1) * 100, -8, 8),
          progress: cueProgress
        }));
        setAiMixer((prev) => ({ ...prev, status: `Blending ${fromDeck.trackName} into ${toDeck.trackName}` }));

        mixRef.current.timer = setInterval(() => {
          step += 1;
          const next = startCross + ((endCross - startCross) * step) / steps;
          setCrossfader(next);
          if (step >= steps) {
            clearInterval(mixRef.current.timer);
            mixRef.current.timer = null;
            if (mixRef.current.timeout) {
              clearTimeout(mixRef.current.timeout);
              mixRef.current.timeout = null;
            }
            audio.pause(fromId, fromDeck, setFromDeck);
            setFromDeck((prev) => ({ ...prev, isPlaying: false, progress: 0.02 }));
            setCrossfader(endCross);
            setAiMixer((prev) => ({ ...prev, status: `Auto mix complete -> Deck ${toId} live` }));
            mixRef.current.running = false;
          }
        }, stepMs);

        mixRef.current.timeout = setTimeout(() => {
          if (!mixRef.current.running) return;
          if (mixRef.current.timer) {
            clearInterval(mixRef.current.timer);
            mixRef.current.timer = null;
          }
          mixRef.current.timeout = null;
          audio.pause(fromId, fromDeck, setFromDeck);
          setFromDeck((prev) => ({ ...prev, isPlaying: false, progress: 0.02 }));
          setCrossfader(endCross);
          setAiMixer((prev) => ({ ...prev, status: `AI closed the transition at ${Math.round(outgoingEndProgress * 100)}%` }));
          mixRef.current.running = false;
        }, Math.max(600, Math.round((outgoingEndProgress - fromDeck.progress) * fromDeck.duration * 1000)));
      } catch (error) {
        setAiMixer((prev) => ({ ...prev, status: `Auto mix failed: ${error.message}` }));
        mixRef.current.running = false;
      }
    }

    // AUTO-QUEUE: at 62% progress, pre-load a similar track onto the idle deck if it's empty
    const PRELOAD_AT = 0.62;
    if (deckA.isPlaying && deckA.progress >= PRELOAD_AT && !deckB.previewUrl && !autoQueueRef.current.loading) {
      const key = `A:${deckA.trackName}`;
      if (autoQueueRef.current.lastKey !== key) {
        autoQueueRef.current.lastKey = key;
        autoQueueRef.current.loading = true;
        autoLoadSimilarTrack(deckA, 'B').finally(() => { autoQueueRef.current.loading = false; });
      }
    }
    if (deckB.isPlaying && deckB.progress >= PRELOAD_AT && !deckA.previewUrl && !autoQueueRef.current.loading) {
      const key = `B:${deckB.trackName}`;
      if (autoQueueRef.current.lastKey !== key) {
        autoQueueRef.current.lastKey = key;
        autoQueueRef.current.loading = true;
        autoLoadSimilarTrack(deckB, 'A').finally(() => { autoQueueRef.current.loading = false; });
      }
    }

    const phraseBars = Number(mixPlan?.phraseBars || 16);
    const outgoingStart = clamp(Number(mixPlan?.outgoingStartProgress || aiMixer.trigger), 0.55, 0.92);
    const outgoingEnd = clamp(Number(mixPlan?.outgoingEndProgress || 0.94), outgoingStart, 0.99);
    const emergencyStart = clamp(Math.max(outgoingStart + 0.03, outgoingEnd - 0.08), outgoingStart, 0.98);
    const targetBar = Number(mixPlan?.mixOnBar || 0);
    const targetBeat = Number(mixPlan?.mixOnBeat || 0);
    const beatInfoA = analyzeBeatGrid(deckA, outgoingStart, phraseBars);
    const beatInfoB = analyzeBeatGrid(deckB, outgoingStart, phraseBars);
    const nextBeat = (beat) => (beat % 4) + 1;
    const nextBar = (bar) => (bar % phraseBars) + 1;
    const isWindowOpen = (deck, beatInfo) => {
      if (deck.progress >= emergencyStart) return true;
      if (!targetBar || !targetBeat) return deck.progress >= outgoingStart;

      const sameBarExact = beatInfo.barInPhrase === targetBar && beatInfo.beatInBar === targetBeat;
      const sameBarGrace = beatInfo.barInPhrase === targetBar && beatInfo.beatInBar === nextBeat(targetBeat);
      const wrappedBeat = targetBeat === 4 && beatInfo.barInPhrase === nextBar(targetBar) && beatInfo.beatInBar === 1;
      return deck.progress >= outgoingStart && (sameBarExact || sameBarGrace || wrappedBeat);
    };

    const deckBReady = Boolean(deckB.previewUrl || deckB.queue.length);
    const deckAReady = Boolean(deckA.previewUrl || deckA.queue.length);

    if (deckA.isPlaying && !deckB.isPlaying && deckBReady && isWindowOpen(deckA, beatInfoA)) {
      startMix('A', 'B');
    } else if (deckB.isPlaying && !deckA.isPlaying && deckAReady && isWindowOpen(deckB, beatInfoB)) {
      startMix('B', 'A');
    } else if (!deckAReady || !deckBReady) {
      setAiMixer((prev) => ({ ...prev, status: 'Waiting for a loaded or queued incoming track' }));
    } else if (!deckA.isPlaying && !deckB.isPlaying) {
      setAiMixer((prev) => ({ ...prev, status: 'Waiting for playback to begin' }));
    } else {
      setAiMixer((prev) => ({ ...prev, status: 'Monitoring deck progress for transition window' }));
    }
  }, [aiMixer.enabled, aiMixer.mode, aiMixer.trigger, deckA, deckB, audio, crossfader, setDeckA, setDeckB, setHistory, mixPlan]);

  return (
    <div className="tab-shell decks-shell" onPointerDown={audio.ensure}>
      <div className="session-bar glass-card">
        <div className="session-bar-inner">
          <div className="session-deck-pill">
            <span className={deckA.isPlaying ? 'sdeck-label live' : 'sdeck-label'}>A</span>
            <div className="sdeck-info">
              <strong>{deckA.trackName === 'Load a track' ? '—' : deckA.trackName}</strong>
              <small>{deckA.artist || (deckA.trackName === 'Load a track' ? 'No track loaded' : '')}</small>
            </div>
          </div>
          <div className="session-center">
            <div className="bpm-delta-badge">
              <span>{adjustedBpm(deckA).toFixed(1)}</span>
              <i className={Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)) <= 1 ? 'bpm-sync' : 'bpm-gap'}>
                {Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)) <= 1 ? '⟷' : `Δ${Math.abs(adjustedBpm(deckA) - adjustedBpm(deckB)).toFixed(1)}`}
              </i>
              <span>{adjustedBpm(deckB).toFixed(1)}</span>
            </div>
            <div className={`ai-status-pill ${aiMixer.enabled ? 'armed' : ''}`}>
              <span>{aiMixer.enabled ? '● ARMED' : '○ AI MIXER OFF'}</span>
            </div>
          </div>
          <div className="session-deck-pill right">
            <div className="sdeck-info">
              <strong>{deckB.trackName === 'Load a track' ? '—' : deckB.trackName}</strong>
              <small>{deckB.artist || (deckB.trackName === 'Load a track' ? 'No track loaded' : '')}</small>
            </div>
            <span className={deckB.isPlaying ? 'sdeck-label live' : 'sdeck-label'}>B</span>
          </div>
        </div>
      </div>

      <div className="decks-layout">
        <DeckPanel deck={deckA} setDeck={setDeckA} audio={audio} openSearch={setSearchDeckId} openAi={(deckId) => { setAiDeckId(deckId); setAiOpen(true); }} pushHistory={pushHistory} active={deckA.isPlaying} mixTrigger={aiMixer.trigger} mixPlan={mixPlan} />
        <MixerPanel
          deckA={deckA}
          deckB={deckB}
          setDeckA={setDeckA}
          setDeckB={setDeckB}
          crossfader={crossfader}
          setCrossfader={setCrossfader}
          effects={effects}
          setEffects={setEffects}
          energy={energy}
          setEnergy={setEnergy}
          aiMixer={aiMixer}
          setAiMixer={setAiMixer}
          autoMixAdvice={autoMixAdvice}
          mixPlan={mixPlan}
          mixPlanLoading={mixPlanLoading}
          mixPlanError={mixPlanError}
          requestMixPlan={requestMixPlan}
          autoLoadSimilarTrack={autoLoadSimilarTrack}
          liveBeatHint={liveBeatHint}
          aiQueueLane={aiQueueLane}
        />
        <DeckPanel deck={deckB} setDeck={setDeckB} audio={audio} openSearch={setSearchDeckId} openAi={(deckId) => { setAiDeckId(deckId); setAiOpen(true); }} pushHistory={pushHistory} active={deckB.isPlaying} mixTrigger={aiMixer.trigger} mixPlan={mixPlan} />
      </div>

      {searchDeckId && <SearchModal deckId={searchDeckId} library={library} onClose={() => setSearchDeckId('')} onLoad={loadTrack} pushQueue={pushQueue} />}
      <AIDrawer open={aiOpen} setOpen={setAiOpen} deckA={deckA} deckB={deckB} contextDeckId={aiDeckId} onLoadSmart={loadTrackSmart} onQueueSmart={queueTrackSmart} />
      <HistorySidebar history={history} open={historyOpen} setOpen={setHistoryOpen} />
    </div>
  );
}

function DJApp() {
  const [activeTab, setActiveTab] = useState('DECKS');
  const [deckA, setDeckA] = useState(makeDeck('A', STARTER_TRACKS[0]));
  const [deckB, setDeckB] = useState(makeDeck('B', STARTER_TRACKS[1]));
  const [library, setLibrary] = useState([]);
  const [status, setStatus] = useState({ gemini: null, error: '' });
  const [dismissed, setDismissed] = useState(false);
  const [energy, setEnergy] = useState(7);
  const [history, setHistory] = useState([]);

  async function checkHealth() {
    try {
      const result = await api('/api/health');
      setStatus({ gemini: Boolean(result.gemini), error: result.error || '' });
    } catch (error) {
      setStatus({ gemini: false, error: error.message });
    }
  }

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  function loadTrack(track, deckId) {
    const prepared = makeDeck(deckId, { ...BASE_TRACK, ...track });
    if (deckId === 'A') {
      setDeckA(prepared);
    } else {
      setDeckB(prepared);
    }
  }

  async function loadTrackSmart(candidate, deckId) {
    const resolved = await resolvePlayableTrack(candidate, candidate.genre || deckA.genre || deckB.genre || 'music');
    loadTrack(resolved, deckId);
    return resolved;
  }

  return (
    <div className="app-shell">
      <div className="app-aurora" />
      <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} status={status} onRefreshHealth={() => { setDismissed(false); checkHealth(); }} />
      {status.gemini === false && !dismissed && (
        <div className="warning-banner">
          <span>
            Gemini AI not connected — {status.error ? status.error : 'add your API key using the button in the top right.'}
          </span>
          <button onClick={() => setDismissed(true)}>x</button>
        </div>
      )}

      <main className="app-main">
        {activeTab === 'DECKS' && <DecksTab deckA={deckA} setDeckA={setDeckA} deckB={deckB} setDeckB={setDeckB} library={library} energy={energy} setEnergy={setEnergy} history={history} setHistory={setHistory} />}
        {activeTab === 'CROWD AI' && <CrowdTab deckA={deckA} deckB={deckB} energy={energy} setEnergy={setEnergy} onLoadSmart={loadTrackSmart} />}
        {activeTab === 'SET PLAN' && <SetPlanTab onLoadSmart={loadTrackSmart} />}
        {activeTab === 'LIBRARY' && <LibraryTab library={library} setLibrary={setLibrary} onLoad={loadTrack} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<DJApp />} />
      </Routes>
    </BrowserRouter>
  );
}
