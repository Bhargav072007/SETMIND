import React, { useState, useRef, useCallback } from 'react';

const GENRES = ['all','techno','house','dnb','hip-hop','afrobeats','pop','ambient'];
const fmt = ms => `${Math.floor(ms/60000)}:${String(Math.floor((ms%60000)/1000)).padStart(2,'0')}`;

// ─── Search sub-tab ───
function SearchTab({ loadTrack }) {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const term = genre !== 'all' ? `${query} ${genre}` : query;
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&media=music&limit=30`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setLoading(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, height:'100%' }}>
      {/* Search bar */}
      <div style={{ display:'flex', gap:8 }}>
        <input type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key==='Enter' && search()}
          placeholder="Search tracks, artists, albums…"
          style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'9px 12px', color:'#fff', fontSize:13, outline:'none', width:'auto' }} />
        <select value={genre} onChange={e => setGenre(e.target.value)}
          style={{ width:120, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'0 8px', color:'#fff', fontSize:12, outline:'none', cursor:'pointer' }}>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={search} disabled={loading}
          style={{ background:'#fc3c44', color:'#fff', border:'none', borderRadius:6, padding:'0 18px', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, opacity:loading?0.6:1 }}>
          {loading ? '…' : 'Search iTunes'}
        </button>
      </div>

      {/* Results grid */}
      <div className="scroll-y" style={{ flex:1 }}>
        {results.length === 0 && !loading && (
          <div style={{ color:'#2a2a2a', fontSize:13, textAlign:'center', marginTop:48 }}>
            Search for tracks to add to your decks
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {results.map((r, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'10px 12px', display:'flex', gap:10, alignItems:'center', transition:'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}>
              {r.artworkUrl60
                ? <img src={r.artworkUrl60} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:40, height:40, background:'#1a1a1a', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>♪</div>
              }
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.trackName}</div>
                <div style={{ fontSize:11, color:'#555', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.artistName}</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ background:'rgba(252,60,68,0.12)', color:'#fc3c44', border:'1px solid rgba(252,60,68,0.2)', borderRadius:3, padding:'1px 6px', fontSize:9, fontWeight:700 }}>128 BPM</span>
                  <span style={{ fontSize:10, color:'#444', fontFamily:'monospace' }}>{fmt(r.trackTimeMillis)}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:4, flexDirection:'column', flexShrink:0 }}>
                {['A','B'].map(d => (
                  <button key={d} onClick={() => loadTrack({ trackName:r.trackName, artist:r.artistName, bpm:128, duration:Math.floor(r.trackTimeMillis/1000), artwork:r.artworkUrl100||r.artworkUrl60 }, d)}
                    style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:4, padding:'3px 8px', color:'#888', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    →{d}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Import sub-tab ───
function ImportTab({ loadTrack }) {
  const [tracks, setTracks] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainResult, setBrainResult] = useState(null);
  const fileRef = useRef(null);

  const parseFile = (text, filename) => {
    const lines = text.split('\n').filter(Boolean);
    const isM3U = filename.endsWith('.m3u') || filename.endsWith('.m3u8');
    const filtered = isM3U ? lines.filter(l => !l.startsWith('#')) : lines;
    return filtered.map((line, i) => {
      const parts = line.split(/[,\t]/);
      return { id:i, trackName: parts[0]?.trim() || line.trim(), artist: parts[1]?.trim() || '', bpm: parseFloat(parts[2]) || 128, key: parts[3]?.trim() || '—', duration: parseInt(parts[4]) || 0 };
    }).filter(t => t.trackName);
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = e => setTracks(parseFile(e.target.result, file.name));
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const runBrain = async () => {
    if (!tracks.length) return;
    setBrainLoading(true);
    setBrainResult(null);
    try {
      const res = await fetch('/api/brain', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tracks: tracks.map(t => `${t.trackName}${t.artist?' - '+t.artist:''}`), targetBpm:'120-140', targetEnergy:7, currentKey:'Cm' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBrainResult(data);
    } catch (e) { setBrainResult({ error:e.message }); }
    setBrainLoading(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, height:'100%' }}>
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragActive ? '#fc3c44' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:12, padding:'28px 24px', textAlign:'center', cursor:'pointer',
          background: dragActive ? 'rgba(252,60,68,0.05)' : 'rgba(255,255,255,0.02)',
          transition:'all 0.15s', flexShrink:0
        }}>
        <div style={{ fontSize:28, marginBottom:8 }}>↑</div>
        <div style={{ fontSize:14, color:'#555' }}>Drop <span style={{ color:'#fff' }}>.txt, .csv, or .m3u</span> file here</div>
        <div style={{ fontSize:12, color:'#333', marginTop:4 }}>or click to browse</div>
        <div style={{ fontSize:10, color:'#222', marginTop:8 }}>CSV: trackName, artist, bpm, key, duration · TXT: one track per line</div>
        <input ref={fileRef} type="file" accept=".txt,.csv,.m3u,.m3u8" style={{ display:'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </div>

      {tracks.length > 0 && (
        <div className="scroll-y" style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          {/* Table */}
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 140px 70px 60px 60px 80px', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#333', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', gap:8 }}>
              <span>#</span><span>Track</span><span>Artist</span><span>BPM</span><span>Key</span><span>Dur</span><span>Load</span>
            </div>
            {tracks.map((t, i) => (
              <div key={t.id} style={{ display:'grid', gridTemplateColumns:'28px 1fr 140px 70px 60px 60px 80px', padding:'7px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center', gap:8 }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ fontSize:10, color:'#333', fontFamily:'monospace' }}>{i+1}</span>
                <span style={{ fontSize:12, color:'#ddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.trackName}</span>
                <span style={{ fontSize:11, color:'#666', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}</span>
                <input type="number" value={t.bpm} min={60} max={220} step={0.1}
                  onChange={e => setTracks(ts => ts.map((x,j) => j===i ? {...x,bpm:parseFloat(e.target.value)||128} : x))}
                  style={{ width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,0.06)', borderRadius:3, padding:'2px 6px', color:'#888', fontSize:11, outline:'none', textAlign:'center' }} />
                <input type="text" value={t.key}
                  onChange={e => setTracks(ts => ts.map((x,j) => j===i ? {...x,key:e.target.value} : x))}
                  style={{ width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,0.06)', borderRadius:3, padding:'2px 6px', color:'#888', fontSize:11, outline:'none', textAlign:'center' }} />
                <span style={{ fontSize:11, color:'#444', fontFamily:'monospace' }}>{t.duration ? `${Math.floor(t.duration/60)}:${String(t.duration%60).padStart(2,'0')}` : '—'}</span>
                <div style={{ display:'flex', gap:3 }}>
                  {['A','B'].map(d => (
                    <button key={d} onClick={() => loadTrack(t, d)}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:3, padding:'2px 7px', color:'#666', fontSize:10, fontWeight:600, cursor:'pointer' }}>
                      →{d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Brain analyze button */}
          <button className="btn-red" onClick={runBrain} disabled={brainLoading}>
            {brainLoading ? <><span className="spinner" />&nbsp;Analyzing…</> : `✦ Analyze with Track Brain (${tracks.length} tracks)`}
          </button>

          {/* Brain results */}
          {brainResult && !brainResult.error && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {brainResult.topPicks?.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Top Picks</div>
                  {brainResult.topPicks.map((p, i) => (
                    <div key={i} style={{ padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:6, marginBottom:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:12, color:'#ddd' }}>{p.track}</div>
                        <div style={{ fontSize:11, color:'#555', fontStyle:'italic' }}>{p.reason}</div>
                      </div>
                      <span style={{ fontSize:11, color:'#fc3c44', fontFamily:'monospace', flexShrink:0, marginLeft:10 }}>★{p.compatibilityScore}</span>
                    </div>
                  ))}
                </div>
              )}
              {brainResult.libraryGaps?.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Library Gaps</div>
                  {brainResult.libraryGaps.map((g, i) => (
                    <div key={i} style={{ fontSize:12, color:'#555', padding:'4px 0' }}>· {g}</div>
                  ))}
                </div>
              )}
              {brainResult.powerSequence?.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Power Sequence</div>
                  {brainResult.powerSequence.map((t, i) => (
                    <div key={i} style={{ fontSize:12, color:'#777', padding:'3px 0' }}>{i+1}. {t}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {brainResult?.error && (
            <div style={{ fontSize:12, color:'#fc3c44', padding:'8px 12px', background:'rgba(252,60,68,0.08)', borderRadius:6 }}>{brainResult.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main LibraryTab ───
export default function LibraryTab({ deckA, deckB, loadTrack }) {
  const [subTab, setSubTab] = useState('search');

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', padding:8, gap:8, overflow:'hidden' }}>
      {/* Sub-tab selector */}
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {[['search','Search'],['import','Import']].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{
            background: subTab===k ? 'rgba(252,60,68,0.1)' : 'transparent',
            color: subTab===k ? '#fc3c44' : '#555',
            border: subTab===k ? '1px solid rgba(252,60,68,0.3)' : '1px solid transparent',
            borderRadius:6, padding:'5px 14px', fontSize:11, fontWeight:600,
            letterSpacing:'0.5px', textTransform:'uppercase', cursor:'pointer'
          }}>{l}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div key={subTab} className="tab-anim" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {subTab === 'search' && <SearchTab loadTrack={loadTrack} />}
          {subTab === 'import' && <ImportTab loadTrack={loadTrack} />}
        </div>
      </div>
    </div>
  );
}
