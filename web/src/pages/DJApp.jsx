import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [health, setHealth] = useState({ nemotron: null, lark: false });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [setHistory, setSetHistory] = useState([]);

  // Poll health on mount and every 30s
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ nemotron: false, error: 'Server unreachable' });
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

  const nemotronOk = health.nemotron === true;
  const nemotronUnknown = health.nemotron === null;
  const showBanner = !nemotronUnknown && !nemotronOk && !bannerDismissed;

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

          {/* Right: status + back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusDot label="Nemotron" ok={nemotronOk} unknown={nemotronUnknown} />
              <StatusDot label="Lark" ok={health.lark} unknown={false} />
            </div>
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

      {/* Nemotron warning banner */}
      {showBanner && (
        <div style={{
          background: 'rgba(255,180,0,0.08)', borderBottom: '1px solid rgba(255,180,0,0.2)',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: '#ffb400', flexShrink: 0
        }}>
          <span>⚠ Nemotron not connected — check your Crusoe API key. Model: hack-crusoe/Nemotron-3-Nano-30B-A3B-FP8</span>
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
