import React, { useEffect, useRef } from 'react';

interface LandingPageProps {
  onNavigate: (tab: 'desk' | 'risk') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Three.js animated background from the prototype
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if Three.js is loaded from window
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    camera.position.set(0, 7, 24);
    camera.lookAt(0, -1, 0);

    const CELL = 2;
    const group = new THREE.Group();
    scene.add(group);

    // Floor grid: black centre line, light grey cells
    const grid = new THREE.GridHelper(120, 60, 0x000000, 0xb8b8b8);
    grid.material.transparent = true;
    grid.material.opacity = 0.7;
    grid.position.y = -2;
    group.add(grid);

    // Scattered "bricks": small black squares on random grid intersections
    const pts: number[] = [];
    let seed = 11;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    for (let i = 0; i < 160; i++) {
      const gx = Math.round((rnd() - 0.5) * 40) * CELL;
      const gz = Math.round((rnd() - 0.5) * 40) * CELL;
      pts.push(gx, -2 + 0.02, gz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.PointsMaterial({ color: 0x000000, size: 7, sizeAttenuation: false });
    const dots = new THREE.Points(geo, mat);
    group.add(dots);

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

    // Pointer parallax, eased
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onPointerMove);

    const start = performance.now();
    let animId: number;
    let running = true;

    function frame(now: number) {
      if (!running) return;
      const t = (now - start) / 1000;
      group.position.z = -((t * 2.4) % CELL);
      eased.x += (target.x - eased.x) * 0.04;
      eased.y += (target.y - eased.y) * 0.04;
      camera.position.x = Math.sin(t * 0.25) * 1.2 + eased.x * 3;
      camera.position.y = 7 + eased.y * -2;
      camera.lookAt(0, -1, 0);

      mat.opacity = 0.75 + 0.25 * Math.sin(t * 1.6);
      mat.transparent = true;
      renderer.render(scene, camera);

      if (!reduce) animId = requestAnimationFrame(frame);
    }

    if (reduce) {
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
  }, []);

  return (
    <div className="landing-page" style={{ width: '100%' }}>
      {/* Hero Section with Three.js Moving Grid Background */}
      <section className="hero" aria-label="Introduction">
        <canvas ref={canvasRef} id="bg" aria-hidden="true" />
        <div className="wrap">
          <div className="hero-panel">
            <p className="eyebrow">UK EPEX SPOT GB DAM · Day-Ahead</p>
            <h1>Know your wind forecast error before gate closure.</h1>
            <p className="lede">
              GridBricks compares the wind forecast with metered generation for every settlement period, so traders and dispatch teams see their exposure before bids close.
            </p>
            <div className="cta-row">
              <button className="btn solid" onClick={() => onNavigate('desk')}>
                Open Decision Desk →
              </button>
              <button className="btn" onClick={() => onNavigate('risk')}>
                See Risk & Evaluation
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

      {/* Two Views Section */}
      <section className="block" id="views">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Two Dedicated Views</p>
            <h2>One for the desk, one for the review.</h2>
            <p>Use the Decision Desk to bid a single day, and Risk & Evaluation to check accuracy and bias across a month.</p>
          </div>
          <div className="views">
            <article className="view-card">
              <p className="tagline">Operational · Daily Trading</p>
              <h3>Decision Desk</h3>
              <ul>
                <li>Pick any delivery day in January 2026 and gate-closure cutoff.</li>
                <li>Actual vs forecast overlay, with hatched over-forecast areas.</li>
                <li>Hedging suggestions and cash-out cost risk estimators.</li>
                <li>Export the day to clipboard or download as CSV / JSON.</li>
              </ul>
              <button className="btn solid" onClick={() => onNavigate('desk')} style={{ marginTop: 10 }}>
                Launch Decision Desk →
              </button>
            </article>

            <article className="view-card">
              <p className="tagline">Analytical · Multi-Day Risk</p>
              <h3>Risk &amp; Evaluation</h3>
              <ul>
                <li>Scorecard: WAPE (%), correlation R², bias ratio, and net GWh.</li>
                <li>250 MW error distribution histogram with Gaussian fit and tail risk check.</li>
                <li>24-hour error box plot to identify weak hours.</li>
                <li>Filter by custom week, peak (07–19 GMT), or off-peak hours.</li>
              </ul>
              <button className="btn" onClick={() => onNavigate('risk')} style={{ marginTop: 10 }}>
                Launch Risk View →
              </button>
            </article>
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
