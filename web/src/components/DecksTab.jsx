import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Camelot wheel compatibility ───
const CAMELOT = {
  'Abm':'1A','G#m':'1A','B':'1B','Ebm':'2A','D#m':'2A','F#':'2B','Gb':'2B',
  'Bbm':'3A','A#m':'3A','Db':'3B','C#':'3B','Fm':'4A','Ab':'4B','G#':'4B',
  'Cm':'5A','Eb':'5B','D#':'5B','Gm':'6A','Bb':'6B','A#':'6B',
  'Dm':'7A','F':'7B','Am':'8A','C':'8B','Em':'9A','G':'9B',
  'Bm':'10A','D':'10B','F#m':'11A','A':'11B','C#m':'12A','Dbm':'12A','E':'12B',
};
function keyCompat(kA, kB) {
  const a = CAMELOT[kA], b = CAMELOT[kB];
  if (!a || !b) return 'neutral';
  if (a === b) return 'compatible';
  const na = parseInt(a), nb = parseInt(b);
  const la = a.slice(-1), lb = b.slice(-1);
  if (na === nb) return 'compatible';
  const d = Math.abs(na - nb);
  if (la === lb && Math.min(d, 12 - d) === 1) return 'compatible';
  return 'clash';
}

const KEYS = ['Cm','Gm','Dm','Am','Em','Bm','F#m','C#m','G#m','D#m','A#m','Fm',
              'C','G','D','A','E','B','F#','C#','Ab','Eb','Bb','F'];

// ─── Waveform canvas ───
function drawWaveform(canvas, progress, deckId) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  let seed = deckId === 'A' ? 0xDEADBEEF : 0xBEEFCAFE;
  const rand = () => { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed >>> 0) / 0xFFFFFFFF; };
  const bars = 80, barW = W / bars;
  for (let i = 0; i < bars; i++) {
    const h = Math.max(4, (0.15 + rand() * 0.85) * H);
    ctx.fillStyle = i / bars <= progress ? '#fc3c44' : '#252525';
    ctx.fillRect(i * barW + 1, (H - h) / 2, Math.max(barW - 2, 1), h);
  }
  if (progress > 0.005 && progress < 0.999) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(progress * W - 1, 0, 2, H);
  }
}

function WaveformCanvas({ progress, deckId, onClick }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawWaveform(ref.current, progress, deckId); }, [progress, deckId]);
  return (
    <canvas ref={ref} width={400} height={56}
      onClick={onClick}
      style={{ width:'100%', height:56, borderRadius:4, cursor:'pointer', display:'block',
               background:'#111' }} />
  );
}

// ─── iTunes search modal ───
function LoadTrackModal({ deckId, onLoad, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState('search');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&media=music&limit=20`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setLoading(false);
  };

  const fmt = ms => `${Math.floor(ms/60000)}:${String(Math.floor((ms%60000)/1000)).padStart(2,'0')}`;

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      backdropFilter:'blur(8px)', zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:620, maxHeight:'80vh', background:'#0c0c0c',
        border:'1px solid rgba(255,255,255,0.1)', borderRadius:16,
        display:'flex', flexDirection:'column', overflow:'hidden'
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>Load to Deck {deckId}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div style={{ padding:'12px 20px 0', display:'flex', gap:6 }}>
          {[['search','Search iTunes'],['library','From Library']].map(([k,l]) => (
            <button key={k} onClick={() => setSubTab(k)} style={{
              background: subTab===k ? 'rgba(252,60,68,0.1)' : 'transparent',
              color: subTab===k ? '#fc3c44' : '#555',
              border: subTab===k ? '1px solid rgba(252,60,68,0.3)' : '1px solid transparent',
              borderRadius:6, padding:'5px 14px', fontSize:11, fontWeight:600,
              letterSpacing:'0.5px', textTransform:'uppercase', cursor:'pointer'
            }}>{l}</button>
          ))}
        </div>

        <div style={{ padding:20, flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
          {subTab === 'search' && <>
            <div style={{ display:'flex', gap:8 }}>
              <input ref={inputRef} type="text" value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key==='Enter' && search()}
                placeholder="Search tracks, artists, albums..."
                style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:6, padding:'9px 12px', color:'#fff', fontSize:13, outline:'none',
                  width:'auto' }} />
              <button onClick={search} disabled={loading} style={{
                background:'#fc3c44', color:'#fff', border:'none', borderRadius:6,
                padding:'0 18px', fontSize:13, fontWeight:700, cursor:'pointer',
                opacity: loading ? 0.6 : 1, flexShrink:0
              }}>
                {loading ? '…' : 'Search'}
              </button>
            </div>
            {results.length === 0 && !loading && (
              <div style={{ color:'#333', fontSize:13, textAlign:'center', padding:'32px 0' }}>
                Search iTunes to find tracks for your deck
              </div>
            )}
            {results.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'10px 12px', background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.06)', borderRadius:8 }}>
                {r.artworkUrl60
                  ? <img src={r.artworkUrl60} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:40, height:40, background:'#1a1a1a', borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>♪</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.trackName}</div>
                  <div style={{ fontSize:11, color:'#666' }}>{r.artistName} · {fmt(r.trackTimeMillis)}</div>
                </div>
                <button onClick={() => { onLoad({ trackName:r.trackName, artist:r.artistName, bpm:128, duration:Math.floor(r.trackTimeMillis/1000), artwork:r.artworkUrl100||r.artworkUrl60 }, deckId); onClose(); }}
                  style={{ background:'rgba(252,60,68,0.1)', color:'#fc3c44', border:'1px solid rgba(252,60,68,0.3)', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
                  → {deckId}
                </button>
              </div>
            ))}
          </>}
          {subTab === 'library' && (
            <div style={{ color:'#333', fontSize:13, textAlign:'center', padding:'32px 0' }}>
              Import tracks in the Library tab, then they'll appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Prompter panel ───
function AIPrompter({ deckA, deckB, onClose }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const CHIPS = ['make it darker','drop the energy','go 90s house','find 130 BPM','crowd is losing it','build to peak'];

  const send = async (msg) => {
    const q = msg || text.trim();
    if (!q) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/api/prompt', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:q, deckA, deckB })
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) { setResponse({ response:'Could not reach Gemini AI. Check server.', suggestedTracks:[], action:'HOLD' }); }
    setLoading(false);
    setText('');
  };

  const actionColors = { PUSH:'#22c55e', HOLD:'#eab308', 'PULL BACK':'#06b6d4', PIVOT:'#fc3c44', SEARCH:'#a855f7' };

  return (
    <div className="ai-panel">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#fc3c44', letterSpacing:'1px', textTransform:'uppercase' }}>✦ AI Prompter</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', fontSize:16, cursor:'pointer' }}>✕</button>
      </div>

      {/* Quick chips */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
        {CHIPS.map(c => (
          <button key={c} className="chip" onClick={() => send(c)}>{c}</button>
        ))}
      </div>

      {/* Response area */}
      {(loading || response) && (
        <div style={{ flex:1, overflowY:'auto', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
          {loading && <div style={{ display:'flex', alignItems:'center', gap:8 }}><span className="spinner" /><span style={{ fontSize:12, color:'#555' }}>Gemini is thinking…</span></div>}
          {response && <>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {response.action && <span style={{ background: actionColors[response.action]||'#555', color:'#000', borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{response.action}</span>}
              <span style={{ fontSize:13, color:'#ccc', lineHeight:1.5 }}>{response.response}</span>
            </div>
            {response.suggestedTracks?.map((t, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontSize:12, color:'#fff', fontWeight:600 }}>{t.track}</div>
                <div style={{ fontSize:11, color:'#555' }}>{t.bpm} BPM · {t.reason}</div>
              </div>
            ))}
          </>}
        </div>
      )}

      {/* Input row */}
      <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
        <input ref={inputRef} type="text" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key==='Enter' && send()}
          placeholder="Tell SETMIND what to do…"
          style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'9px 12px', color:'#fff', fontSize:13, outline:'none', width:'auto' }} />
        <button onClick={() => send()} disabled={loading || !text.trim()} style={{
          background:'#fc3c44', color:'#fff', border:'none', borderRadius:6,
          padding:'0 16px', fontSize:13, fontWeight:700, cursor:'pointer',
          opacity: (!text.trim()||loading)?0.5:1, flexShrink:0
        }}>Send</button>
      </div>
    </div>
  );
}

// ─── Single deck panel ───
function DeckPanel({ deck, deckId, onUpdate, onLoadModal, tapRef }) {
  const canvasRef = useRef(null);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  // Progress simulation
  useEffect(() => {
    if (!deck.isPlaying) return;
    const id = setInterval(() => {
      const d = deckRef.current;
      if (!d.isPlaying) return;
      onUpdate(deckId, { progress: Math.min(d.progress + 1 / d.duration, 1) });
    }, 1000);
    return () => clearInterval(id);
  }, [deck.isPlaying, deckId, onUpdate]);

  const effectiveBpm = deck.bpm * (1 + deck.pitch / 100);
  const progressPct = Math.round(deck.progress * 100);
  const elapsed = Math.floor(deck.progress * deck.duration);
  const remaining = deck.duration - elapsed;
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const handleTap = () => {
    const now = Date.now();
    tapRef.current.push(now);
    if (tapRef.current.length > 8) tapRef.current.shift();
    if (tapRef.current.length >= 2) {
      let sum = 0;
      for (let i = 1; i < tapRef.current.length; i++) sum += tapRef.current[i] - tapRef.current[i-1];
      const bpm = Math.round(60000 / (sum / (tapRef.current.length - 1)) * 10) / 10;
      if (bpm >= 60 && bpm <= 220) onUpdate(deckId, { bpm });
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onUpdate(deckId, { progress: Math.max(0, Math.min(1, pct)) });
  };

  const S = {
    panel: {
      background: deck.isPlaying
        ? 'repeating-linear-gradient(90deg,rgba(252,60,68,0.025) 0px,rgba(252,60,68,0.025) 2px,transparent 2px,transparent 10px),rgba(255,255,255,0.03)'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${deck.isPlaying ? 'rgba(252,60,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:10,
      backdropFilter:'blur(20px)', height:'100%', overflowY:'auto', transition:'border-color 0.3s'
    }
  };

  return (
    <div style={S.panel}>
      {/* Deck label */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span className="lbl">Deck {deckId}</span>
        {deck.isPlaying && <span style={{ fontSize:9, color:'#fc3c44', letterSpacing:'1px', textTransform:'uppercase' }}>● LIVE</span>}
      </div>

      {/* Track info */}
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:52, height:52, borderRadius:8, background:'#1a1a1a', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.06)' }}>
          {deck.artwork
            ? <img src={deck.artwork} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : '♪'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.3px' }}>
            {deck.trackName}
          </div>
          <div style={{ fontSize:11, color:'#666', marginTop:2 }}>{deck.artist || 'Unknown Artist'}</div>
        </div>
      </div>

      {/* BPM + Key row */}
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ flex:1 }}>
          <div className="lbl" style={{ marginBottom:4 }}>BPM</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={() => onUpdate(deckId, { bpm: Math.max(60, Math.round((effectiveBpm-0.5)*10)/10) })}
              style={{ width:22, height:22, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, color:'#888', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ fontFamily:'monospace', fontSize:22, fontWeight:700, color:'#fff', minWidth:58, textAlign:'center' }}>
              {effectiveBpm.toFixed(1)}
            </span>
            <button onClick={() => onUpdate(deckId, { bpm: Math.min(220, Math.round((effectiveBpm+0.5)*10)/10) })}
              style={{ width:22, height:22, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, color:'#888', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div className="lbl" style={{ marginBottom:4 }}>KEY</div>
          <select value={deck.key} onChange={e => onUpdate(deckId, { key:e.target.value })}
            style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'4px 8px', color:'#fff', fontSize:12, outline:'none', cursor:'pointer' }}>
            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      {/* Waveform */}
      <div>
        <WaveformCanvas progress={deck.progress} deckId={deckId} onClick={handleProgressClick} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="pbar" onClick={handleProgressClick}>
          <div className="pfill" style={{ width:`${progressPct}%`, transition:'width 0.9s linear' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ fontSize:10, color:'#555', fontFamily:'monospace' }}>{fmt(elapsed)}</span>
          <span style={{ fontSize:10, color:'#333', fontFamily:'monospace' }}>-{fmt(remaining)}</span>
        </div>
      </div>

      {/* Transport */}
      <div style={{ display:'flex', justifyContent:'center', gap:4, alignItems:'center' }}>
        <button className="transport-btn" onClick={() => onUpdate(deckId, { progress:0 })}>⏮</button>
        <button className="transport-btn" onClick={() => onUpdate(deckId, { progress:Math.max(0,deck.progress-0.05) })}>⏪</button>
        <button className={`transport-btn${deck.isPlaying?' playing':''}`}
          onClick={() => onUpdate(deckId, { isPlaying:!deck.isPlaying })}
          style={{ fontSize:24, width:36, height:36, background: deck.isPlaying ? 'rgba(252,60,68,0.12)' : 'rgba(255,255,255,0.05)', borderRadius:8 }}>
          {deck.isPlaying ? '⏸' : '▶'}
        </button>
        <button className="transport-btn" onClick={() => onUpdate(deckId, { progress:Math.min(1,deck.progress+0.05) })}>⏩</button>
        <button className="transport-btn" onClick={() => onUpdate(deckId, { progress:1, isPlaying:false })}>⏭</button>
      </div>

      {/* Loop / Cue / Sync + Tap */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {[['loop','LOOP'],['cue','CUE'],['sync','SYNC']].map(([k,l]) => (
          <button key={k} className={`pill${deck[k]?' active':''}`}
            onClick={() => onUpdate(deckId, { [k]:!deck[k] })}>{l}</button>
        ))}
        <button className="pill" onClick={handleTap}
          style={{ marginLeft:'auto' }}>TAP BPM</button>
      </div>

      {/* Hot cues */}
      <div style={{ display:'flex', gap:5 }}>
        {deck.hotCues.map((c, i) => (
          <button key={i} className={`hcue${c!==null?' set':''}`}
            onClick={() => {
              const hc = [...deck.hotCues];
              hc[i] = c !== null ? null : deck.progress;
              onUpdate(deckId, { hotCues:hc });
            }}>{i+1}</button>
        ))}
        <span style={{ fontSize:10, color:'#333', marginLeft:6, alignSelf:'center' }}>Hot Cues</span>
      </div>

      {/* EQ */}
      <div>
        <div className="lbl" style={{ marginBottom:6 }}>EQ</div>
        <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
          {[['eqLow','LOW'],['eqMid','MID'],['eqHigh','HIGH']].map(([k,l]) => (
            <div key={k} style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#333', marginBottom:4 }}>{l}</div>
              <input type="range" min={-12} max={12} step={0.5} value={deck[k]}
                onChange={e => onUpdate(deckId, { [k]:parseFloat(e.target.value) })}
                style={{ width:'100%' }} />
              <div style={{ fontSize:9, color: deck[k]===0?'#333':'#fc3c44', fontFamily:'monospace', marginTop:2 }}>
                {deck[k]>0?'+':''}{deck[k].toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pitch + Volume + KeyLock row */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div className="lbl">PITCH</div>
          <input type="range" className="vert" min={-8} max={8} step={0.1} value={deck.pitch}
            onChange={e => onUpdate(deckId, { pitch:parseFloat(e.target.value) })} />
          <div style={{ fontSize:9, color:deck.pitch===0?'#333':'#fc3c44', fontFamily:'monospace' }}>
            {deck.pitch>0?'+':''}{deck.pitch.toFixed(1)}%
          </div>
          <button onClick={() => onUpdate(deckId, { keyLock:!deck.keyLock })}
            className={`pill${deck.keyLock?' active':''}`}
            style={{ fontSize:9 }}>{deck.keyLock?'🔒 LOCKED':'KEY LOCK'}</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div className="lbl">VOL</div>
          <input type="range" className="vert white-thumb" min={0} max={100} value={deck.volume}
            onChange={e => onUpdate(deckId, { volume:parseInt(e.target.value) })} />
          <div style={{ fontSize:9, color:'#555', fontFamily:'monospace' }}>{deck.volume}</div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => onLoadModal(deckId)}
            style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'8px 0', color:'#888', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            ↑ Load Track
          </button>
          <button onClick={() => {}}
            style={{ width:'100%', background:'#fc3c44', border:'none', borderRadius:7, padding:'8px 0', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            ✦ AI Suggest
          </button>
        </div>
      </div>

      {/* Next Queue */}
      {deck.queue.length > 0 && (
        <div>
          <div className="lbl" style={{ marginBottom:4 }}>QUEUE</div>
          {deck.queue.map((t, i) => (
            <div key={i} style={{ padding:'6px 8px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, marginBottom:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'#ccc' }}>{t.trackName}</div>
                <div style={{ fontSize:10, color:'#555' }}>{t.bpm} BPM</div>
              </div>
              <button onClick={() => { onUpdate(deckId, { queue: deck.queue.filter((_,j) => j!==i) }); }}
                style={{ background:'none', border:'none', color:'#333', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Center mixer ───
function MixerPanel({ deckA, deckB, crossfader, setCrossfader, masterVolume, setMasterVolume, effects, setEffects, beatStep, onUpdate }) {
  const compat = keyCompat(deckA.key, deckB.key);
  const compatColors = { compatible:'#22c55e', clash:'#fc3c44', neutral:'#555' };
  const compatLabels = { compatible:'Keys compatible ✓', clash:'Keys clash ✗', neutral:'Keys neutral' };

  const effectiveBpmA = deckA.bpm * (1 + deckA.pitch / 100);
  const effectiveBpmB = deckB.bpm * (1 + deckB.pitch / 100);

  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:12, backdropFilter:'blur(20px)', height:'100%', overflowY:'auto' }}>
      <div className="lbl" style={{ textAlign:'center' }}>Mixer</div>

      {/* BPM sync */}
      <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
          <span style={{ color:'#ccc', fontFamily:'monospace' }}>{effectiveBpmA.toFixed(1)}</span>
          <span style={{ color:'#444', fontSize:10 }}>BPM</span>
          <span style={{ color:'#ccc', fontFamily:'monospace' }}>{effectiveBpmB.toFixed(1)}</span>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={() => onUpdate('A', { bpm: effectiveBpmB })}
            style={{ flex:1, background:'rgba(252,60,68,0.08)', border:'1px solid rgba(252,60,68,0.2)', borderRadius:5, color:'#fc3c44', fontSize:9, fontWeight:700, padding:'5px 0', cursor:'pointer', letterSpacing:'0.5px' }}>
            SYNC A→B
          </button>
          <button onClick={() => onUpdate('B', { bpm: effectiveBpmA })}
            style={{ flex:1, background:'rgba(252,60,68,0.08)', border:'1px solid rgba(252,60,68,0.2)', borderRadius:5, color:'#fc3c44', fontSize:9, fontWeight:700, padding:'5px 0', cursor:'pointer', letterSpacing:'0.5px' }}>
            SYNC B→A
          </button>
        </div>
      </div>

      {/* Beat grid */}
      <div>
        <div className="lbl" style={{ marginBottom:4 }}>Beat Grid</div>
        {[['A', deckA], ['B', deckB]].map(([id, deck]) => (
          <div key={id} style={{ marginBottom:4 }}>
            <div style={{ fontSize:9, color:'#333', marginBottom:2 }}>Deck {id}</div>
            <div style={{ display:'flex', gap:2, flexWrap:'nowrap' }}>
              {[...Array(16)].map((_, i) => {
                const isOn = deck.isPlaying && i === beatStep;
                const isBeat = i % 4 === 0;
                return (
                  <div key={i} style={{
                    flex:1, height:isBeat?10:7,
                    background: isOn ? '#fc3c44' : isBeat ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                    borderRadius:1, transition:'background 0.05s',
                    boxShadow: isOn ? '0 0 4px rgba(252,60,68,0.5)' : 'none'
                  }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Key compat */}
      <div style={{ background:`${compatColors[compat]}14`, border:`1px solid ${compatColors[compat]}30`, borderRadius:6, padding:'6px 10px', textAlign:'center' }}>
        <span style={{ fontSize:10, fontWeight:700, color:compatColors[compat] }}>{compatLabels[compat]}</span>
        <div style={{ fontSize:9, color:'#444', marginTop:2 }}>{deckA.key} · {deckB.key}</div>
      </div>

      {/* Effects */}
      <div>
        <div className="lbl" style={{ marginBottom:6 }}>Effects</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {['reverb','delay','filter','flanger'].map(fx => (
            <button key={fx} className={`fx-btn${effects[fx]?' active':''}`}
              onClick={() => setEffects(e => ({ ...e, [fx]:!e[fx] }))}>
              {fx.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Master volume */}
      <div style={{ textAlign:'center' }}>
        <div className="lbl" style={{ marginBottom:4 }}>Master Vol</div>
        <div style={{ display:'flex', justifyContent:'center' }}>
          <input type="range" className="vert white-thumb" min={0} max={100} value={masterVolume}
            onChange={e => setMasterVolume(parseInt(e.target.value))} />
        </div>
        <div style={{ fontSize:9, color:'#555', fontFamily:'monospace', marginTop:2 }}>{masterVolume}%</div>
      </div>

      {/* Crossfader */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:10, color:crossfader < 45 ? '#fc3c44' : '#444', fontWeight:700 }}>A</span>
          <div className="lbl">Crossfader</div>
          <span style={{ fontSize:10, color:crossfader > 55 ? '#fc3c44' : '#444', fontWeight:700 }}>B</span>
        </div>
        <input type="range" min={0} max={100} value={crossfader}
          onChange={e => setCrossfader(parseInt(e.target.value))}
          style={{ width:'100%' }} />
        <div style={{ textAlign:'center', fontSize:9, color:'#333', marginTop:2, fontFamily:'monospace' }}>
          {crossfader === 50 ? 'CENTER' : crossfader < 50 ? `← A ${100-crossfader*2}%` : `B ${(crossfader-50)*2}% →`}
        </div>
      </div>
    </div>
  );
}

// ─── Set History sidebar ───
function HistoryPanel({ history, onClose }) {
  const exportHistory = () => {
    const text = history.map(h => `[${h.timestamp}] Deck ${h.deck}: ${h.trackName}${h.artist?' - '+h.artist:''}`).join('\n');
    const blob = new Blob([text], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'setmind-history.txt';
    a.click();
  };
  return (
    <div style={{ position:'absolute', right:0, top:0, bottom:0, width:260, background:'rgba(0,0,0,0.95)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', zIndex:20, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#888', letterSpacing:'1px', textTransform:'uppercase' }}>Set History</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 14px', display:'flex', flexDirection:'column', gap:6 }}>
        {history.length === 0
          ? <div style={{ color:'#333', fontSize:12, textAlign:'center', marginTop:24 }}>No tracks played yet</div>
          : history.map((h, i) => (
            <div key={i} style={{ padding:'8px 10px', background:'rgba(255,255,255,0.03)', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:11, color:'#ccc' }}>{h.trackName}</div>
              <div style={{ fontSize:10, color:'#444', marginTop:2 }}>
                Deck {h.deck} · {h.timestamp}
              </div>
            </div>
          ))}
      </div>
      <div style={{ padding:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={exportHistory} className="btn-red" style={{ fontSize:11 }}>Export History .txt</button>
      </div>
    </div>
  );
}

// ─── Main DecksTab ───
export default function DecksTab({ deckA, deckB, updateDeck, loadTrack, setHistory }) {
  const [crossfader, setCrossfader] = useState(50);
  const [masterVolume, setMasterVolume] = useState(80);
  const [effects, setEffects] = useState({ reverb:false, delay:false, filter:false, flanger:false });
  const [beatStep, setBeatStep] = useState(0);
  const [loadModal, setLoadModal] = useState(null);
  const [prompterOpen, setPrompterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const tapRefA = useRef([]);
  const tapRefB = useRef([]);

  // Beat grid animation
  useEffect(() => {
    const playing = deckA.isPlaying || deckB.isPlaying;
    if (!playing) return;
    const bpm = deckA.isPlaying ? deckA.bpm : deckB.bpm;
    const msPerBeat = (60 / Math.max(bpm, 60)) * 1000;
    const id = setInterval(() => setBeatStep(s => (s + 1) % 16), msPerBeat / 4);
    return () => clearInterval(id);
  }, [deckA.isPlaying, deckB.isPlaying, deckA.bpm, deckB.bpm]);

  return (
    <div style={{ height:'100%', position:'relative', display:'flex', flexDirection:'column' }}>
      {/* History toggle button */}
      <div style={{ position:'absolute', top:8, right:8, zIndex:10 }}>
        <button onClick={() => setHistoryOpen(o => !o)}
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'4px 10px', color:'#555', fontSize:10, fontWeight:600, cursor:'pointer', letterSpacing:'1px', textTransform:'uppercase' }}>
          {historyOpen ? 'Close' : '⏱ History'}
        </button>
      </div>

      {/* 3-column layout */}
      <div style={{ flex:1, display:'flex', gap:8, padding:'8px 8px 8px 8px', overflow:'hidden', minHeight:0 }}>
        {/* Deck A */}
        <div style={{ flex:'0 0 38%', minWidth:0, overflow:'hidden' }}>
          <DeckPanel deck={deckA} deckId="A" onUpdate={updateDeck} onLoadModal={setLoadModal} tapRef={tapRefA} />
        </div>

        {/* Mixer */}
        <div style={{ flex:'0 0 24%', minWidth:0, overflow:'hidden' }}>
          <MixerPanel
            deckA={deckA} deckB={deckB}
            crossfader={crossfader} setCrossfader={setCrossfader}
            masterVolume={masterVolume} setMasterVolume={setMasterVolume}
            effects={effects} setEffects={setEffects}
            beatStep={beatStep} onUpdate={updateDeck}
          />
        </div>

        {/* Deck B */}
        <div style={{ flex:'0 0 38%', minWidth:0, overflow:'hidden' }}>
          <DeckPanel deck={deckB} deckId="B" onUpdate={updateDeck} onLoadModal={setLoadModal} tapRef={tapRefB} />
        </div>
      </div>

      {/* History sidebar */}
      {historyOpen && <HistoryPanel history={setHistory} onClose={() => setHistoryOpen(false)} />}

      {/* Load modal */}
      {loadModal && (
        <LoadTrackModal deckId={loadModal} onLoad={loadTrack} onClose={() => setLoadModal(null)} />
      )}

      {/* AI Prompter */}
      {prompterOpen && <AIPrompter deckA={deckA} deckB={deckB} onClose={() => setPrompterOpen(false)} />}

      {/* Floating AI button — only shows when prompter is closed */}
      {!prompterOpen && (
        <button className="ai-fab" onClick={() => setPrompterOpen(true)}>✦ AI</button>
      )}
    </div>
  );
}
