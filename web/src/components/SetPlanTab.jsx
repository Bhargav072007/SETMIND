import React, { useState } from 'react';

const VENUES = ['club','festival','warehouse','rooftop','bar','private'];
const GENRES = ['techno','house','dnb','hip-hop','afrobeats','pop','ambient','other'];

function EnergyBlocks({ level }) {
  return (
    <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{
          width:8, height:16, borderRadius:1,
          background: i < level ? '#fc3c44' : 'rgba(255,255,255,0.08)'
        }} />
      ))}
    </div>
  );
}

function ArcCard({ phase }) {
  return (
    <div className="arc-card">
      <div style={{ fontSize:10, fontWeight:700, color:'#fc3c44', letterSpacing:'1px', textTransform:'uppercase' }}>{phase.phase}</div>
      <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:'#fff', letterSpacing:'-1px' }}>{phase.bpmRange}</div>
      <EnergyBlocks level={phase.energy} />
      <div style={{ fontSize:10, color:'#555' }}>{phase.duration} min</div>
      <div style={{ fontSize:11, color:'#666', lineHeight:1.5 }}>{phase.description}</div>
      {phase.exampleTracks?.map((t, i) => (
        <div key={i} style={{ fontSize:10, color:'#444', lineHeight:1.4 }}>· {t}</div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#2a2a2a' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M8 38L24 10L40 38H8Z" stroke="#2a2a2a" strokeWidth="2" fill="none"/>
        <path d="M16 30L24 16L32 30H16Z" fill="#1a1a1a"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, color:'#333' }}>Describe your gig and Gemini AI</div>
        <div style={{ fontSize:14, color:'#333' }}>will architect your full set</div>
      </div>
    </div>
  );
}

export default function SetPlanTab() {
  const [venue, setVenue] = useState('club');
  const [crowd, setCrowd] = useState('300 people, aged 22-30');
  const [duration, setDuration] = useState(90);
  const [genre, setGenre] = useState('techno');
  const [peakTime, setPeakTime] = useState('2am');
  const [role, setRole] = useState('headliner');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ venue, crowd, duration, genre, peakTime, openerOrHeadliner:role })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const exportTxt = () => {
    if (!result) return;
    const lines = [
      result.setTitle, '─'.repeat(40), '',
      'ENERGY ARC',
      ...(result.energyArc||[]).map(p =>
        `${p.phase.padEnd(14)} ${p.bpmRange} BPM  E:${p.energy}/10\n${p.description}\n${(p.exampleTracks||[]).map(t=>'  · '+t).join('\n')}`
      ), '',
      'CROWD TIPS',
      ...(result.crowdReadingTips||[]).map(t => '· '+t), '',
      'EMERGENCY PIVOTS',
      ...(result.emergencyPivots||[]).map(p => `· ${p.signal} → ${p.action}`)
    ];
    const blob = new Blob([lines.join('\n')], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `setmind-${(result.setTitle||'set').replace(/\s+/g,'_')}.txt`;
    a.click();
  };


  return (
    <div style={{ height:'100%', display:'flex', gap:8, padding:8, overflow:'hidden' }}>

      {/* FORM PANEL */}
      <div style={{ flex:'0 0 30%', background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#888', letterSpacing:'1.5px', textTransform:'uppercase' }}>Set Architect</div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:5 }}>Venue</label>
          <select value={venue} onChange={e => setVenue(e.target.value)}>
            {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:5 }}>Crowd</label>
          <input type="text" value={crowd} onChange={e => setCrowd(e.target.value)} placeholder="300 people, aged 22-30" />
        </div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:5 }}>Duration (mins)</label>
          <input type="number" min={30} max={360} value={duration} onChange={e => setDuration(parseInt(e.target.value)||90)} style={{ width:'100%' }} />
        </div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:5 }}>Genre</label>
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:5 }}>Peak Time</label>
          <input type="text" value={peakTime} onChange={e => setPeakTime(e.target.value)} placeholder="2am" />
        </div>

        <div>
          <label style={{ fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:8 }}>Role</label>
          <div style={{ display:'flex', gap:8 }}>
            {['opener','headliner'].map(r => (
              <label key={r} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="radio" name="role" value={r} checked={role===r}
                  onChange={() => setRole(r)}
                  style={{ accentColor:'#fc3c44', width:14, height:14 }} />
                <span style={{ fontSize:13, color: role===r ? '#fff' : '#555', textTransform:'capitalize' }}>{r}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn-red" onClick={generate} disabled={loading}>
            {loading ? <><span className="spinner" />&nbsp;Gemini is building your set…</> : 'Generate Set Plan'}
          </button>
          {error && <div style={{ fontSize:11, color:'#fc3c44', padding:'6px 8px', background:'rgba(252,60,68,0.08)', borderRadius:4 }}>{error}</div>}
          {result && (
            <button onClick={exportTxt} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'8px 0', color:'#888', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              Export .txt
            </button>
          )}
        </div>
      </div>

      {/* RESULTS PANEL */}
      <div style={{ flex:1, background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:16, overflowY:'auto' }}>
        {!result && !loading && <EmptyState />}

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
            <span className="spinner" style={{ width:24, height:24 }} />
            <span style={{ fontSize:13, color:'#555' }}>Gemini is building your set…</span>
          </div>
        )}

        {result && <>
          {/* Set title */}
          <div>
            <div style={{ fontSize:10, color:'#fc3c44', letterSpacing:'2px', textTransform:'uppercase', marginBottom:6 }}>Set Plan</div>
            <h2 style={{ fontSize:24, fontWeight:700, color:'#fff', letterSpacing:'-0.5px' }}>{result.setTitle}</h2>
          </div>

          {/* Energy arc — horizontal scroll */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>Energy Arc</div>
            <div className="scroll-x" style={{ display:'flex', gap:10, paddingBottom:8 }}>
              {(result.energyArc||[]).map((phase, i) => <ArcCard key={i} phase={phase} />)}
            </div>
          </div>

          {/* Crowd tips */}
          {result.crowdReadingTips?.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Crowd Tips</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {result.crowdReadingTips.map((tip, i) => (
                  <div key={i} style={{ fontSize:13, color:'#888', lineHeight:1.5, display:'flex', gap:8 }}>
                    <span style={{ color:'#333' }}>·</span>{tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency pivots */}
          {result.emergencyPivots?.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Emergency Pivots</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {result.emergencyPivots.map((p, i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                    <span className="badge" style={{ background:'rgba(234,179,8,0.12)', color:'#eab308', border:'1px solid rgba(234,179,8,0.2)', whiteSpace:'nowrap' }}>{p.signal}</span>
                    <span style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{p.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>}
      </div>
    </div>
  );
}
