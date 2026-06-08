import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const GEMINI_KEY_STORAGE = 'setmind_gemini_api_key';
function getStoredApiKey() {
  try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ''; } catch { return ''; }
}

function ApiKeyPanel({ onClose, onSave }) {
  const [val, setVal] = React.useState(() => getStoredApiKey());
  const [visible, setVisible] = React.useState(false);

  function save() {
    try { localStorage.setItem(GEMINI_KEY_STORAGE, val.trim()); } catch {}
    onSave();
    onClose();
  }

  function clear() {
    setVal('');
    try { localStorage.removeItem(GEMINI_KEY_STORAGE); } catch {}
    onSave();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
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
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Stored locally in your browser only</div>
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
              color: '#fff', fontSize: 13, fontFamily: 'monospace', outline: 'none'
            }}
          />
          <button onClick={() => setVisible(v => !v)} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13
          }}>{visible ? 'hide' : 'show'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={save} style={{
            flex: 1, background: '#fc3c44', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>Save Key</button>
          {val && (
            <button onClick={clear} style={{
              background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer'
            }}>Clear</button>
          )}
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 0', color: '#888', fontSize: 12,
            fontWeight: 600, textDecoration: 'none'
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
import DecksTab from '../components/DecksTab.jsx';
import CrowdAITab from '../components/CrowdAITab.jsx';
import SetPlanTab from '../components/SetPlanTab.jsx';
import LibraryTab from '../components/LibraryTab.jsx';

const TABS = ['DECKS', 'CROWD AI', 'SET PLAN', 'LIBRARY'];

const initialDeck = (id) => ({
  id,
  trackName: 'No Track Loaded',
  artist: '',
  bpm: id === 'A' ? 128.0 : 132.0,
  key: id === 'A' ? 'Cm' : 'Am',
  progress: 0,
  isPlaying: false,
  volume: 80,
  pitch: 0,
  keyLock: false,
  loop: false,
  cue: false,
  sync: false,
  hotCues: [null, null, null, null],
  eqLow: 0, eqMid: 0, eqHigh: 0,
  duration: 225,
  artwork: null,
  queue: []
});

export default function DJApp() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [deckA, setDeckA] = useState(() => initialDeck('A'));
  const [deckB, setDeckB] = useState(() => initialDeck('B'));
  const [health, setHealth] = useState({ gemini: null });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [setHistory, setSetHistory] = useState([]);

  // Poll health on mount and every 30s
  const checkHealth = useCallback(async () => {
    try {
      const apiKey = getStoredApiKey();
      const res = await fetch('/api/health', {
        headers: apiKey ? { 'X-Gemini-Api-Key': apiKey } : {}
      });
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ gemini: false, error: 'Server unreachable' });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, [checkHealth]);

  const addToHistory = useCallback((track, deck) => {
    setSetHistory(h => [{
      timestamp: new Date().toLocaleTimeString(),
      trackName: track.trackName,
      artist: track.artist || '',
      deck,
      loadedAt: Date.now()
    }, ...h].slice(0, 20));
  }, []);

  const updateDeck = useCallback((id, updates) => {
    if (id === 'A') setDeckA(d => ({ ...d, ...updates }));
    else setDeckB(d => ({ ...d, ...updates }));
  }, []);

  const loadTrack = useCallback((track, deckId) => {
    updateDeck(deckId, {
      trackName: track.trackName,
      artist: track.artist || '',
      bpm: track.bpm || 128,
      duration: track.duration || 225,
      artwork: track.artwork || null,
      progress: 0,
      isPlaying: false,
      key: track.key || (deckId === 'A' ? 'Cm' : 'Am')
    });
    addToHistory(track, deckId);
  }, [updateDeck, addToHistory]);

  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredApiKey()));

  function onKeySaved() {
    setHasKey(Boolean(getStoredApiKey()));
    checkHealth();
  }

  const geminiOk = health.gemini === true;
  const geminiUnknown = health.gemini === null;
  const showBanner = !geminiUnknown && !geminiOk && !bannerDismissed;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          height: 44,
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          background: 'rgba(0,0,0,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', zIndex: 10,
          gap: 0
        }}>
          {/* Logo */}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fc3c44', letterSpacing: '-0.3px', marginRight: 20 }}>
            SETMIND
          </span>

          {/* Tab buttons — center */}
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                style={{
                  background: activeTab === i ? 'rgba(252,60,68,0.1)' : 'transparent',
                  color: activeTab === i ? '#fc3c44' : '#555',
                  border: activeTab === i ? '1px solid rgba(252,60,68,0.3)' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '5px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Right: status + key + back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusDot label="Gemini" ok={geminiOk} unknown={geminiUnknown} />
            <button
              onClick={() => setShowKeyPanel(true)}
              style={{
                background: hasKey ? 'rgba(255,255,255,0.05)' : 'rgba(252,60,68,0.12)',
                border: hasKey ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(252,60,68,0.3)',
                borderRadius: 7, padding: '4px 10px',
                color: hasKey ? '#666' : '#fc3c44',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.4px',
                display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {hasKey ? 'API Key' : 'Add Key'}
            </button>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: '#444', fontSize: 11, cursor: 'pointer', letterSpacing: '0.5px' }}
            >
              ← Home
            </button>
          </div>
        </div>

        {/* Animated wave under header */}
        <div style={{ position: 'relative', height: 12, overflow: 'hidden', background: '#000' }}>
          <div style={{ position: 'absolute', width: '200%', top: 0, animation: 'hdrWave 20s linear infinite' }}>
            <svg viewBox="0 0 2880 12" preserveAspectRatio="none" style={{ width: '100%', height: 12, display: 'block' }}>
              <path d="M0,6 C360,0 720,12 1080,6 C1440,0 1800,12 2160,6 C2520,0 2880,12 2880,6 L2880,12 L0,12 Z"
                fill="rgba(252,60,68,0.15)" />
            </svg>
          </div>
        </div>
      </header>

      {/* Gemini warning banner */}
      {showBanner && (
        <div style={{
          background: 'rgba(255,180,0,0.08)', borderBottom: '1px solid rgba(255,180,0,0.2)',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: '#ffb400', flexShrink: 0
        }}>
          <span>⚠ Gemini AI not connected — check your GEMINI_API_KEY in environment variables.</span>
          <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', color: '#ffb400', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* TAB CONTENT */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div key={activeTab} className="tab-anim" style={{ height: '100%' }}>
          {activeTab === 0 && (
            <DecksTab
              deckA={deckA} deckB={deckB}
              updateDeck={updateDeck} loadTrack={loadTrack}
              setHistory={setHistory}
            />
          )}
          {activeTab === 1 && (
            <CrowdAITab deckA={deckA} deckB={deckB} />
          )}
          {activeTab === 2 && (
            <SetPlanTab />
          )}
          {activeTab === 3 && (
            <LibraryTab deckA={deckA} deckB={deckB} loadTrack={loadTrack} />
          )}
        </div>
      </div>
      {showKeyPanel && <ApiKeyPanel onClose={() => setShowKeyPanel(false)} onSave={onKeySaved} />}
    </div>
  );
}

function StatusDot({ label, ok, unknown }) {
  const color = unknown ? '#444' : ok ? '#22c55e' : '#fc3c44';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        boxShadow: ok ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
        transition: 'background 0.3s'
      }} />
      <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.5px' }}>{label}</span>
    </div>
  );
}
