import React, { useEffect, useRef } from 'react';
import { CometCard } from '@/components/ui/comet-card';

interface LandingPageProps {
  onNavigate: (tab: 'desk' | 'risk') => void;
  theme?: 'light' | 'dark';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, theme = 'light' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const THREE = (window as any).THREE;
    if (!THREE) return;

    const reduce =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(theme === 'dark' ? 0x000000 : 0xffffff, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    camera.position.set(0, 7, 24);
    camera.lookAt(0, -1, 0);

    // ── Grid ──────────────────────────────────────────────────────────────
    const CELL = 2;
    const SPEED = 2.4; // world-units per second

    const group = new THREE.Group();
    scene.add(group);

    const gridCenterColor = theme === 'dark' ? 0xffffff : 0x000000;
    const gridLineColor = theme === 'dark' ? 0x808080 : 0xb8b8b8;
    const grid = new THREE.GridHelper(120, 60, gridCenterColor, gridLineColor);
    (grid.material as any).transparent = true;
    (grid.material as any).opacity = theme === 'dark' ? 0.85 : 0.7;
    grid.position.y = -2;
    group.add(grid);

    // ── Dots ──────────────────────────────────────────────────────────────
    const FAR_Z = -50;
    const DEPTH = 80;
    const FADE_IN_END = DEPTH * 0.15;
    const FADE_OUT_START = DEPTH * 0.90;

    const DOT_COUNT = 160;

    let seed = 11;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }

    const dotX = new Float32Array(DOT_COUNT);
    const dotPhase = new Float32Array(DOT_COUNT);
    for (let i = 0; i < DOT_COUNT; i++) {
      dotX[i] = Math.round((rnd() - 0.5) * 40) * CELL;
      dotPhase[i] = rnd() * DEPTH;
    }

    const dotColor = theme === 'dark' ? 0xffffff : 0x111111;

    // full-opacity dots
    const matFull = new THREE.PointsMaterial({ color: dotColor, size: 7, sizeAttenuation: false });
    const posFull = new Float32Array(DOT_COUNT * 3);
    const geoFull = new THREE.BufferGeometry();
    const attrFull = new THREE.BufferAttribute(posFull, 3);
    attrFull.setUsage(THREE.DynamicDrawUsage);
    geoFull.setAttribute('position', attrFull);
    const ptsFull = new THREE.Points(geoFull, matFull);
    ptsFull.position.y = -2 + 0.02;
    scene.add(ptsFull);

    // fading-in dots (bottom of field — low rawZ)
    const matFadeIn = new THREE.PointsMaterial({ color: dotColor, size: 7, sizeAttenuation: false, transparent: true, opacity: 0.5 });
    const posFadeIn = new Float32Array(DOT_COUNT * 3);
    const geoFadeIn = new THREE.BufferGeometry();
    const attrFadeIn = new THREE.BufferAttribute(posFadeIn, 3);
    attrFadeIn.setUsage(THREE.DynamicDrawUsage);
    geoFadeIn.setAttribute('position', attrFadeIn);
    const ptsFadeIn = new THREE.Points(geoFadeIn, matFadeIn);
    ptsFadeIn.position.y = -2 + 0.02;
    scene.add(ptsFadeIn);

    // fading-out dots (front of field — high rawZ)
    const matFadeOut = new THREE.PointsMaterial({ color: dotColor, size: 7, sizeAttenuation: false, transparent: true, opacity: 0.5 });
    const posFadeOut = new Float32Array(DOT_COUNT * 3);
    const geoFadeOut = new THREE.BufferGeometry();
    const attrFadeOut = new THREE.BufferAttribute(posFadeOut, 3);
    attrFadeOut.setUsage(THREE.DynamicDrawUsage);
    geoFadeOut.setAttribute('position', attrFadeOut);
    const ptsFadeOut = new THREE.Points(geoFadeOut, matFadeOut);
    ptsFadeOut.position.y = -2 + 0.02;
    scene.add(ptsFadeOut);

    // off-screen sentinel for "invisible" dots
    const OFFSCREEN_Y = -500;

    // ── Resize ─────────────────────────────────────────────────────────────
    function resize() {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Pointer parallax ────────────────────────────────────────────────────
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onPointerMove);

    // ── Animation loop ─────────────────────────────────────────────────────
    const start = performance.now();
    let animId: number;
    let running = true;

    // Counters for bucket sizes per frame
    let nFull = 0, nFadeIn = 0, nFadeOut = 0;

    function frame(now: number) {
      if (!running) return;
      const t = (now - start) / 1000;

      // Grid scrolls by sub-CELL offset — seamless because grid is periodic
      group.position.z = -((t * SPEED) % CELL);

      // Camera sway + parallax
      eased.x += (target.x - eased.x) * 0.04;
      eased.y += (target.y - eased.y) * 0.04;
      camera.position.x = Math.sin(t * 0.25) * 1.2 + eased.x * 3;
      camera.position.y = 7 + eased.y * -2;
      camera.lookAt(0, -1, 0);

      // Accumulate dots into buckets
      nFull = 0; nFadeIn = 0; nFadeOut = 0;
      let avgFadeIn = 0, avgFadeOut = 0;

      const travelled = t * SPEED;

      for (let i = 0; i < DOT_COUNT; i++) {
        // rawZ in [0, DEPTH) — advances continuously, no snapping
        const rawZ = (dotPhase[i] + travelled) % DEPTH;
        const worldZ = FAR_Z + rawZ;

        if (rawZ < FADE_IN_END) {
          // Fading in
          const alpha = rawZ / FADE_IN_END; // 0→1
          avgFadeIn += alpha;
          const off = nFadeIn * 3;
          posFadeIn[off]     = dotX[i];
          posFadeIn[off + 1] = 0;
          posFadeIn[off + 2] = worldZ;
          nFadeIn++;
        } else if (rawZ > FADE_OUT_START) {
          // Fading out
          const alpha = 1 - (rawZ - FADE_OUT_START) / (DEPTH - FADE_OUT_START); // 1→0
          avgFadeOut += alpha;
          const off = nFadeOut * 3;
          posFadeOut[off]     = dotX[i];
          posFadeOut[off + 1] = 0;
          posFadeOut[off + 2] = worldZ;
          nFadeOut++;
        } else {
          // Fully visible
          const off = nFull * 3;
          posFull[off]     = dotX[i];
          posFull[off + 1] = 0;
          posFull[off + 2] = worldZ;
          nFull++;
        }
      }

      // Set materials to average alpha of their bucket
      matFadeIn.opacity  = nFadeIn  > 0 ? avgFadeIn  / nFadeIn  : 0;
      matFadeOut.opacity = nFadeOut > 0 ? avgFadeOut / nFadeOut : 0;

      // Pad remaining slots off-screen so the buffers don't show stale data
      for (let i = nFull * 3; i < DOT_COUNT * 3; i++) {
        posFull[i] = (i % 3 === 1) ? OFFSCREEN_Y : 0;
      }
      for (let i = nFadeIn * 3; i < DOT_COUNT * 3; i++) {
        posFadeIn[i] = (i % 3 === 1) ? OFFSCREEN_Y : 0;
      }
      for (let i = nFadeOut * 3; i < DOT_COUNT * 3; i++) {
        posFadeOut[i] = (i % 3 === 1) ? OFFSCREEN_Y : 0;
      }

      attrFull.needsUpdate = true;
      attrFadeIn.needsUpdate = true;
      attrFadeOut.needsUpdate = true;

      renderer.render(scene, camera);
      if (!reduce) animId = requestAnimationFrame(frame);
    }

    if (reduce) {
      // static single frame
      group.position.z = 0;
      for (let i = 0; i < DOT_COUNT; i++) {
        posFull[i * 3]     = dotX[i];
        posFull[i * 3 + 1] = 0;
        posFull[i * 3 + 2] = FAR_Z + dotPhase[i];
      }
      attrFull.needsUpdate = true;
      renderer.render(scene, camera);
    } else {
      animId = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [theme]);

  return (
    <div className="landing-page" style={{ width: '100%' }}>
      {/* Hero Section with Three.js Moving Grid Background */}
      <section className="hero" aria-label="Introduction">
        <canvas ref={canvasRef} id="bg" aria-hidden="true" />
        <div className="wrap">
          <div className="hero-panel">
            {/* Platform logo in hero */}
            <img
              src="/platform-logo.svg"
              alt="Wind Forecast Desk"
              className="hero-logo"
              style={{ width: 200, marginBottom: 24, display: 'block' }}
            />
            <p className="eyebrow">UK EPEX SPOT GB DAM · Day-Ahead</p>
            <h1>Know your wind forecast error before gate closure.</h1>
            <p className="lede">
              Wind Forecast Desk compares the wind forecast with metered generation for every settlement period, so traders and dispatch teams see their exposure before bids close.
            </p>
            <div className="cta-row">
              <button className="btn solid" onClick={() => onNavigate('desk')}>
                Open Decision Desk →
              </button>
              <button className="btn" onClick={() => onNavigate('risk')}>
                See Risk &amp; Evaluation
              </button>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>Periods</dt>
                <dd>48 × 30 min</dd>
              </div>
              <div>
                <dt>Default Cutoff</dt>
                <dd>11:00 GMT</dd>
              </div>
              <div>
                <dt>Metrics</dt>
                <dd>MAE · RMSE · WAPE</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="block" id="features">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">What It Does</p>
            <h2>Built for decisions made in minutes.</h2>
            <p>Every figure is chosen to be read in a glance, and every time frame is labelled, so nobody has to guess which forecast they are looking at.</p>
          </div>
          <div className="features">
            <article className="feature">
              <p className="num">01</p>
              <h3>Sub-second scannability</h3>
              <p>The imbalance figures, MW swings, and gate-closure countdown are the largest items on the page.</p>
            </article>
            <article className="feature">
              <p className="num">02</p>
              <h3>Temporal anchoring</h3>
              <p>Every view explicitly names its time frame: delivery day, decision day, and the gate-closure cutoff.</p>
            </article>
            <article className="feature">
              <p className="num">03</p>
              <h3>Gate-closure playback</h3>
              <p>Step the cutoff from 06:00 to 15:00 and watch the forecast dynamically evolve as newer weather runs arrive.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Two Dedicated Views (Comet Card 3D Perspective Experience) */}
      <section className="block" id="views">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Two Dedicated Views</p>
            <h2>One for the desk, one for the review.</h2>
            <p>Use the Decision Desk to bid a single day, and Risk &amp; Evaluation to check accuracy and bias across a month.</p>
          </div>
          <div className="comet-views-container">
            {/* Operational Decision Desk Comet Card */}
            <CometCard rotateDepth={14} translateDepth={18}>
              <article className="comet-card-inner">
                <div>
                  <p className="tagline">Operational · Daily Trading</p>
                  <h3>Decision Desk</h3>
                  <ul>
                    <li>Pick any delivery day in January 2026 and gate-closure cutoff.</li>
                    <li>Actual vs forecast overlay, with hatched over-forecast areas.</li>
                    <li>Hedging suggestions and cash-out cost risk estimators.</li>
                    <li>Export the day to clipboard or download as CSV / JSON.</li>
                  </ul>
                </div>
                <button
                  className="btn solid"
                  onClick={() => onNavigate('desk')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Launch Decision Desk →
                </button>
              </article>
            </CometCard>

            {/* Analytical Risk & Evaluation Comet Card */}
            <CometCard rotateDepth={14} translateDepth={18}>
              <article className="comet-card-inner">
                <div>
                  <p className="tagline">Analytical · Multi-Day Risk</p>
                  <h3>Risk &amp; Evaluation</h3>
                  <ul>
                    <li>Scorecard: WAPE (%), correlation R², bias ratio, and net GWh.</li>
                    <li>250 MW error distribution histogram with Gaussian fit and tail risk check.</li>
                    <li>24-hour error box plot to identify weak hours.</li>
                    <li>Filter by custom week, peak (07–19 GMT), or off-peak hours.</li>
                  </ul>
                </div>
                <button
                  className="btn"
                  onClick={() => onNavigate('risk')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Launch Risk View →
                </button>
              </article>
            </CometCard>
          </div>
        </div>
      </section>

      {/* Methodology Section */}
      <section className="block" id="method">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Methodology</p>
            <h2>The measures behind the numbers.</h2>
            <p>Each metric says something different about the forecast. Read them together, not in isolation.</p>
          </div>
          <div className="metrics">
            <div className="metric">
              <p className="k">MAE · RMSE</p>
              <h4>Size of the miss</h4>
              <p>Average volumetric discrepancy in MW, with a heavier penalty on steep ramp swings.</p>
            </div>
            <div className="metric">
              <p className="k">Mean Bias</p>
              <h4>Direction of the miss</h4>
              <p>Indicates whether forecasts systematically over- or under-predict actual renewable delivery.</p>
            </div>
            <div className="metric">
              <p className="k">WAPE · R²</p>
              <h4>Share and fit</h4>
              <p>Percentage miss relative to total power generated, and how well forecast tracks actual trajectory.</p>
            </div>
            <div className="metric">
              <p className="k">Net GWh</p>
              <h4>Energy at stake</h4>
              <p>Total volumetric energy imbalance across the evaluation window converted to Gigawatt-hours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Band */}
      <section className="band" id="start">
        <div className="wrap">
          <div>
            <h2>Open the desk before the next gate closes.</h2>
            <p>Every figure you need to price renewable imbalance risk into your Day-Ahead wholesale bids.</p>
          </div>
          <div>
            <button className="btn inverse" onClick={() => onNavigate('desk')} style={{ padding: '14px 28px', fontSize: 15, fontWeight: 700 }}>
              Open Decision Desk →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
