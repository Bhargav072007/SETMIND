import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const WAVE1 = "M0,45 C240,20 480,70 720,45 C960,20 1200,70 1440,45 C1680,20 1920,70 2160,45 C2400,20 2640,70 2880,45 L2880,80 L0,80 Z";
const WAVE2 = "M0,55 C300,30 600,70 900,50 C1200,30 1500,65 1800,50 C2100,35 2400,60 2700,50 C2800,45 2880,55 2880,55 L2880,80 L0,80 Z";
const WAVE3 = "M0,35 C200,55 400,20 600,35 C800,50 1000,20 1200,35 C1400,50 1600,20 1800,35 C2000,50 2200,20 2400,35 C2600,50 2800,25 2880,35 L2880,80 L0,80 Z";

function WaveLayers() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, width: '200%', animation: 'waveMove1 8s linear infinite' }}>
        <svg viewBox="0 0 2880 80" preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block', opacity: 0.06 }}>
          <path d={WAVE1} fill="#fc3c44" />
        </svg>
      </div>
      <div style={{ position: 'absolute', inset: 0, width: '200%', animation: 'waveMove2 5s linear infinite' }}>
        <svg viewBox="0 0 2880 80" preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block', opacity: 0.04 }}>
          <path d={WAVE2} fill="#fc3c44" />
        </svg>
      </div>
      <div style={{ position: 'absolute', inset: 0, width: '200%', animation: 'waveMove3 3s linear infinite' }}>
        <svg viewBox="0 0 2880 80" preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block', opacity: 0.03 }}>
          <path d={WAVE3} fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

function IconWaveform() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="14" width="3" height="4" rx="1" fill="#fc3c44"/>
      <rect x="7" y="10" width="3" height="12" rx="1" fill="#fc3c44"/>
      <rect x="12" y="6" width="3" height="20" rx="1" fill="#fc3c44"/>
      <rect x="17" y="9" width="3" height="14" rx="1" fill="#fc3c44"/>
      <rect x="22" y="12" width="3" height="8" rx="1" fill="#fc3c44"/>
      <rect x="27" y="14" width="3" height="4" rx="1" fill="#fc3c44"/>
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M4 22l12 6 12-6" stroke="#fc3c44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 16l12 6 12-6" stroke="#fc3c44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 10l12 6 12-6-12-6-12 6z" stroke="#fc3c44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="#fc3c44" strokeWidth="2" strokeLinecap="round"/>
      <path d="M7.5 7.5l4 4M20.5 20.5l4 4M20.5 7.5l-4 4M7.5 20.5l4-4" stroke="#fc3c44" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="3" fill="#fc3c44"/>
    </svg>
  );
}

function DeckMockup() {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20, display: 'flex', gap: 12, minHeight: 120 }}>
      {['A', 'B'].map(d => (
        <div key={d} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 9, color: '#333', letterSpacing: 2, marginBottom: 8 }}>DECK {d}</div>
          <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, marginBottom: 6, position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: d === 'A' ? '60%' : '35%', background: '#fc3c44', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ height: 20, width: 4, background: i < 7 ? (d === 'A' ? '#fc3c44' : '#333') : '#1a1a1a', borderRadius: 1, opacity: 0.5 + Math.random() * 0.5 }} />
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 4, justifyContent: 'center' }}>
            {['◀◀','▶','▶▶'].map(c => (
              <div key={c} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '3px 8px', fontSize: 9, color: c === '▶' && d === 'A' ? '#fc3c44' : '#444' }}>{c}</div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ width: 60, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 9, color: '#333', letterSpacing: 1 }}>MIX</div>
        <div style={{ width: 3, height: 40, background: '#1a1a1a', borderRadius: 2, position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: '40%', left: -3, width: 9, height: 3, background: '#fc3c44', borderRadius: 1 }} />
        </div>
        <div style={{ width: '100%', height: 3, background: '#1a1a1a', borderRadius: 2, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: -3, width: 3, height: 9, background: '#fff', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  const handleScroll = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: "var(--font)" }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 56,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>SETMIND</span>
        <button
          onClick={() => navigate('/app')}
          style={{
            background: '#fc3c44', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 20px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          Launch App
        </button>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', padding: '100px 40px 120px', textAlign: 'center', overflow: 'hidden' }}>
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(252,60,68,0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, color: '#fc3c44', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 24 }}>
            Powered by NVIDIA Nemotron · Crusoe Cloud
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 24 }}>
            The AI brain<br />professional DJs actually use
          </h1>

          <p style={{ fontSize: 18, color: '#888', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.6 }}>
            Real-time crowd analysis. Intelligent set planning.
            Track suggestions that match the room. Powered by Nemotron.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/app')}
              style={{
                background: '#fc3c44', color: '#fff', border: 'none',
                borderRadius: 9999, height: 48, padding: '0 28px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(252,60,68,0.35)'
              }}
            >
              Launch SETMIND →
            </button>
            <button
              onClick={handleScroll}
              style={{
                background: 'transparent', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 9999, height: 48, padding: '0 28px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              See Features
            </button>
          </div>
        </div>

        {/* Wave layers at bottom of hero */}
        <WaveLayers />
      </section>

      {/* STATS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 60, padding: '32px 40px', borderTop: '1px solid #0f0f0f', borderBottom: '1px solid #0f0f0f' }}>
        {[
          { num: '3', label: 'AI Capabilities' },
          { num: 'Real-time', label: 'Crowd Analysis' },
          { num: 'Pro DJ', label: 'Ready' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-1px' }}>{s.num}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: '#fc3c44', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>
              Three AI Capabilities
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px' }}>Built for the booth</h2>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              {
                icon: <IconWaveform />,
                title: 'Crowd Pulse',
                desc: 'Real-time crowd analysis. Nemotron reads the room and tells you exactly what to play next and why.'
              },
              {
                icon: <IconLayers />,
                title: 'Set Architect',
                desc: 'Describe your gig. Nemotron builds the full energy arc — warm-up to close — with BPM mapping and example tracks.'
              },
              {
                icon: <IconSparkle />,
                title: 'AI Prompter',
                desc: 'Type anything. "The crowd is losing it." "Go darker." "Find me 130 BPM house." Nemotron responds instantly.'
              }
            ].map(f => (
              <div key={f.title} className="feat-card">
                <div style={{ marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.3px' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#777', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM PREVIEW */}
      <section style={{ padding: '0 40px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: '#444', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            Professional DJ Platform
          </div>
          <div style={{ background: '#050505', border: '1px solid #1a1a1a', borderRadius: 20, padding: 24 }}>
            {/* Tab mockup */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {['DECKS','CROWD AI','SET PLAN','LIBRARY'].map((t, i) => (
                <div key={t} style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  letterSpacing: '1px', cursor: 'default',
                  background: i === 0 ? 'rgba(252,60,68,0.1)' : 'transparent',
                  color: i === 0 ? '#fc3c44' : '#333',
                  border: i === 0 ? '1px solid rgba(252,60,68,0.3)' : '1px solid transparent'
                }}>{t}</div>
              ))}
            </div>
            <DeckMockup />
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: '80px 40px', textAlign: 'center', borderTop: '1px solid #0f0f0f' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', marginBottom: 24 }}>
          Ready to elevate your sets?
        </h2>
        <button
          onClick={() => navigate('/app')}
          style={{
            background: '#fc3c44', color: '#fff', border: 'none',
            borderRadius: 9999, height: 52, padding: '0 36px',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(252,60,68,0.35)',
            marginBottom: 16
          }}
        >
          Launch SETMIND →
        </button>
        <div style={{ fontSize: 12, color: '#444', marginTop: 8 }}>
          Free during hackathon · Powered by Crusoe Cloud
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid #111',
        padding: '20px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: 12, color: '#444' }}>SETMIND © 2026</span>
        <span style={{ fontSize: 12, color: '#444' }}>Built for the Crusoe + Lark Hackathon</span>
      </footer>
    </div>
  );
}
