import React, { useState } from 'react';

const GENRES = ['techno','house','dnb','hip-hop','afrobeats','pop','ambient','other'];

const STATE_COLORS = {
  peaking:'#22c55e', building:'#3b82f6', fading:'#f97316', steady:'#6b7280', confused:'#fc3c44'
};
const DIRECTIVE_COLORS = {
  PUSH:'#22c55e', HOLD:'#eab308', 'PULL BACK':'#06b6d4', PIVOT:'#fc3c44'
};

function EnergyBar({ score }) {
  const bars = 10;
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[...Array(bars)].map((_, i) => (
        <div key={i} style={{
          width:16, height:8, borderRadius:2,
          background: i < score ? '#fc3c44' : 'rgba(255,255,255,0.08)'
        }} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#333' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="22" width="5" height="4" rx="1.5" fill="#2a2a2a"/>
        <rect x="12" y="16" width="5" height="16" rx="1.5" fill="#2a2a2a"/>
        <rect x="20" y="8" width="5" height="32" rx="1.5" fill="#2a2a2a"/>
        <rect x="28" y="14" width="5" height="20" rx="1.5" fill="#2a2a2a"/>
        <rect x="36" y="20" width="5" height="8" rx="1.5" fill="#2a2a2a"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, color:'#444', marginBottom:4 }}>Fill in the crowd details and run analysis</div>
        <div style={{ fontSize:12, color:'#2a2a2a' }}>Nemotron will read the room for you</div>
      </div>
    </div>
  );
}

export default function CrowdAITab({ deckA, deckB }) {
  const [energy, setEnergy] = useState(5);
  const [reaction, setReaction] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [genre, setGenre] = useState('techno');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Auto-fill from active deck
  const activeDeck = deckA.isPlaying ? deckA : deckB.isPlaying ? deckB : null;
  const currentTrackStr = activeDeck ? `${activeDeck.trackName} - ${activeDeck.artist || 'Unknown'}` : '';
  const currentBpm = activeDeck ? activeDeck.bpm : 128;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pulse', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          currentTrack: currentTrackStr || 'Unknown Track',
          currentBpm,
          energyLevel: energy,
          crowdReaction: reaction || 'moderate energy',
          minutesIntoSet: minutes,
          totalDuration: 90,
          genre,
          lastFiveTracks: ['Track A','Track B','Track C','Track D', currentTrackStr || 'Unknown']
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const S = (key) => ({
    crowdState: STATE_COLORS[result?.crowdState?.toLowerCase()] || '#555',
    directive: DIRECTIVE_COLORS[result?.energyDirective] || '#555'
  }[key]);

  return (
    <div style={{ height:'100%', display:'flex', gap:8, padding:8, overflow:'hidden' }}>

      {/* INPUT PANEL */}
      <div style={{ flex:'0 0 35%', background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#888', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:14 }}>Crowd Analysis</div>

          {activeDeck && (
            <div style={{ background:'rgba(252,60,68,0.06)', border:'1px solid rgba(252,60,68,0.15)', borderRadius:6, padding:'8px 10px', marginBottom:14 }}>
              <div style={{ fontSize:10, color:'#fc3c44', letterSpacing:'1px', textTransform:'uppercase', marginBottom:2 }}>● Auto-filled from Deck {activeDeck.id}</div>
              <div style={{ fontSize:12, color:'#ccc' }}>{activeDeck.trackName} · {currentBpm} BPM</div>
            </div>
          )}
        </div>

        {/* Energy slider */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
            <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px' }}>Energy Level</label>
            <span style={{ fontSize:28, fontWeight:700, color:'#fc3c44', fontFamily:'monospace' }}>{energy}<span style={{ fontSize:14, color:'#444' }}>/10</span></span>
          </div>
          <input type="range" min={1} max={10} value={energy}
            onChange={e => setEnergy(parseInt(e.target.value))}
            style={{ width:'100%' }} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
            <span style={{ fontSize:9, color:'#333' }}>Quiet</span>
            <span style={{ fontSize:9, color:'#333' }}>Peak</span>
          </div>
        </div>

        {/* Crowd reaction */}
        <div>
          <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:6 }}>Crowd Reaction</label>
          <textarea value={reaction} onChange={e => setReaction(e.target.value)}
            placeholder="describe what you're seeing..."
            rows={2}
            style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 12px', color:'#fff', fontSize:13, outline:'none', resize:'none', fontFamily:'var(--font)' }} />
        </div>

        {/* Minutes into set */}
        <div>
          <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:6 }}>Minutes Into Set</label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="number" min={0} max={360} value={minutes}
              onChange={e => setMinutes(parseInt(e.target.value)||0)}
              style={{ width:80, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'7px 10px', color:'#fff', fontSize:13, outline:'none', textAlign:'center' }} />
            <span style={{ fontSize:12, color:'#444' }}>/ 90 min total</span>
          </div>
        </div>

        {/* Genre */}
        <div>
          <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:6 }}>Genre</label>
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Current track info (read-only from deck) */}
        <div>
          <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:6 }}>Current Track</label>
          <input type="text" value={currentTrackStr} readOnly placeholder="No track playing"
            style={{ background:'rgba(255,255,255,0.03)', color: currentTrackStr ? '#888' : '#2a2a2a' }} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:6 }}>Current BPM</label>
          <input type="number" value={currentBpm} readOnly
            style={{ background:'rgba(255,255,255,0.03)', color:'#888', width:'100%' }} />
        </div>

        <div style={{ marginTop:'auto' }}>
          <button className="btn-red" onClick={run} disabled={loading}>
            {loading ? <><span className="spinner" />&nbsp;Reading the room…</> : 'Run Crowd Pulse'}
          </button>
          {error && <div style={{ marginTop:8, fontSize:11, color:'#fc3c44', padding:'6px 8px', background:'rgba(252,60,68,0.08)', borderRadius:4 }}>{error}</div>}
          <div style={{ fontSize:10, color:'#2a2a2a', textAlign:'center', marginTop:8 }}>Powered by Nemotron on Crusoe Cloud</div>
        </div>
      </div>

      {/* RESULTS PANEL */}
      <div style={{ flex:1, background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
        {!result && !loading && <EmptyState />}

        {result && <>
          {/* Top badges */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <span className="badge" style={{ background:`${S('crowdState')}20`, color:S('crowdState'), border:`1px solid ${S('crowdState')}30`, fontSize:12, padding:'4px 12px' }}>
              {(result.crowdState||'STEADY').toUpperCase()}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'#555' }}>Momentum</span>
              <div style={{ display:'flex', gap:2 }}>
                {[...Array(10)].map((_,i) => (
                  <div key={i} style={{ width:14, height:6, borderRadius:1, background: i<(result.momentumScore||5) ? '#fc3c44' : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <span style={{ fontSize:11, color:'#888', fontFamily:'monospace' }}>{result.momentumScore||5}/10</span>
            </div>
            <span className="badge" style={{ background:`${S('directive')}20`, color:S('directive'), border:`1px solid ${S('directive')}30`, marginLeft:'auto' }}>
              {result.energyDirective || 'HOLD'}
            </span>
          </div>

          {/* Analysis text */}
          {result.analysis && (
            <div style={{ fontSize:14, color:'#bbb', lineHeight:1.65, padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
              {result.analysis}
            </div>
          )}

          {/* Next tracks */}
          {result.nextThreeTracks?.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Next Tracks</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {result.nextThreeTracks.map((t, i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:32, height:32, background:'#1a1a1a', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>♪</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{t.track}</div>
                      <div style={{ fontSize:11, color:'#555', fontStyle:'italic', marginTop:2 }}>{t.reason}</div>
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      <span style={{ background:'rgba(252,60,68,0.12)', color:'#fc3c44', border:'1px solid rgba(252,60,68,0.2)', borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>{t.bpm}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transition tip */}
          {result.transitionTip && (
            <div style={{ borderLeft:'2px solid #fc3c44', paddingLeft:12, fontSize:13, color:'#888', fontStyle:'italic', lineHeight:1.5 }}>
              {result.transitionTip}
            </div>
          )}

          {/* Urgent alert */}
          {result.urgentAlert && (
            <div style={{ background:'rgba(252,60,68,0.1)', border:'1px solid rgba(252,60,68,0.3)', borderRadius:8, padding:'10px 14px', display:'flex', gap:8, alignItems:'flex-start' }}>
              <span style={{ fontSize:16 }}>⚠</span>
              <span style={{ fontSize:13, color:'#fc3c44', lineHeight:1.5 }}>{result.urgentAlert}</span>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}
