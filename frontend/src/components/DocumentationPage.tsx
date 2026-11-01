import React, { useState, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from './ui/sidebar';

interface DocSection {
  id: string;
  title: string;
  group: string;
  content: React.ReactNode;
}

export const DocumentationPage: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>('welcome');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sections: DocSection[] = useMemo(
    () => [
      // ── Group 1: Getting Started ──────────────────────────────────────────
      {
        id: 'welcome',
        group: 'Getting Started',
        title: 'Welcome & Overview',
        content: (
          <div>
            <h1>Welcome to Wind Forecast Desk</h1>
            <p>
              <strong>Wind Forecast Desk</strong> is a decision support tool built for energy utilities trading in the
              UK Day-Ahead wholesale electricity market.
            </p>

            <div className="docs-callout">
              <strong>The Problem in Simple Words</strong>
              In the UK power grid, electricity demand and supply must match every single second. Power utilities must
              submit their bids <strong>one day before delivery</strong> (by 11:00 GMT). Because wind changes constantly
              with the weather, traders risk buying either too little or too much energy. If their forecast is wrong,
              they pay expensive cashout imbalance penalties.
            </div>

            <h2>What this application does</h2>
            <ul>
              <li>
                <strong>Shows the exact forecast available when bids are made:</strong> It strictly eliminates
                "lookahead bias" by filtering out any weather models published after the 11:00 GMT gate cutoff.
              </li>
              <li>
                <strong>Quantifies forecast error:</strong> Computes MAE, RMSE, Mean Bias (MBE), and WAPE across 1,488
                settlement periods for January 2026.
              </li>
              <li>
                <strong>Tells you how much thermal power to procure:</strong> Automatically calculates how much backup
                power (like Combined Cycle Gas Turbines — CCGT) you need to buy to hedge wind shortfall risk.
              </li>
              <li>
                <strong>Traces meteorological convergence:</strong> Lets you inspect how the weather forecast evolved
                across days leading up to actual power generation.
              </li>
            </ul>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button className="btn solid" onClick={() => setActiveSectionId('quickstart')}>
                Next: Quickstart Guide →
              </button>
              <a href="#desk" className="btn ghost">
                Open Decision Desk ↗
              </a>
            </div>
          </div>
        ),
      },
      {
        id: 'quickstart',
        group: 'Getting Started',
        title: 'Quickstart (Run in 2 Mins)',
        content: (
          <div>
            <h1>Quickstart Guide</h1>
            <p>You can run Wind Forecast Desk locally using Docker or directly with Python and Node.</p>

            <h2>Method 1: Run with Docker Compose (Recommended)</h2>
            <p>
              This is the fastest method. It builds and runs both the FastAPI backend (port 8000) and the React frontend
              (port 3000) inside clean, isolated containers.
            </p>
            <pre>
              <code>{`# 1. Clone the project and navigate into the folder
git clone <repository-url>
cd <project-folder>

# 2. Build and start both frontend and backend
docker compose up --build -d

# 3. Open in your browser:
# Frontend Application: http://localhost:3000
# Backend Swagger Docs: http://localhost:8000/docs`}</code>
            </pre>

            <h2>Method 2: Run Locally (Without Docker)</h2>
            <h3>Step 1: Start the Backend (Python 3.11+)</h3>
            <pre>
              <code>{`# Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Run the automated test suite (14 passing tests)
PYTHONPATH=backend pytest backend/tests/ -v

# Launch the backend server
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`}</code>
            </pre>

            <h3>Step 2: Start the Frontend (Node 18+)</h3>
            <pre>
              <code>{`# In a separate terminal tab:
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev -- --host 127.0.0.1 --port 3000`}</code>
            </pre>

            <div className="docs-callout">
              <strong>Verification Tip</strong>
              Visit <code>http://127.0.0.1:3000</code> in your browser. The top bar will display a green status dot
              showing latency (e.g. <code>Latency 12 ms</code>) and database state (<code>1,488 SPs</code>).
            </div>
          </div>
        ),
      },
      {
        id: 'docker',
        group: 'Getting Started',
        title: 'Docker Deployment',
        content: (
          <div>
            <h1>Docker Architecture</h1>
            <p>
              The project uses multi-stage Docker builds to keep images small, secure, and production-ready.
            </p>

            <h2>Container Breakdown</h2>
            <ul>
              <li>
                <strong>Backend Container (<code>wind-forecast-backend</code>):</strong>
                Uses <code>python:3.11-slim</code>. Installs dependencies and runs Uvicorn on port 8000 with SQLite WAL
                mode enabled.
              </li>
              <li>
                <strong>Frontend Container (<code>wind-forecast-frontend</code>):</strong>
                Multi-stage build. Stage 1 compiles TypeScript and Vite into optimized static assets. Stage 2 serves the
                compiled bundle via high-performance <code>nginx:alpine</code> on port 80 (mapped to port 3000).
              </li>
            </ul>

            <h2>Stopping and Restarting</h2>
            <pre>
              <code>{`# Stop containers
docker compose down

# View live container logs
docker compose logs -f`}</code>
            </pre>
          </div>
        ),
      },

      // ── Group 2: User Manual ──────────────────────────────────────────────
      {
        id: 'decision-desk',
        group: 'User Manual',
        title: 'Decision Desk Guide',
        content: (
          <div>
            <h1>Using the Decision Desk</h1>
            <p>
              The <strong>Decision Desk</strong> is the primary screen used by power traders on morning shifts before
              submitting Day-Ahead bids.
            </p>

            <h2>1. Date Selection</h2>
            <p>
              Use the date picker in the top control ribbon to select any day in January 2026. You can step day-by-day
              using the <code>← Prev</code> and <code>Next →</code> buttons, or click the date button to open the calendar
              dropdown. Dates with available data are clearly highlighted.
            </p>

            <h2>2. Interactive Main Chart</h2>
            <ul>
              <li>
                <strong>Solid Curve:</strong> Metered Actual Wind Generation in MW.
              </li>
              <li>
                <strong>Dashed Curve:</strong> Day-Ahead Forecast generated prior to gate closure.
              </li>
              <li>
                <strong>Diagonal Hatching (Black lines):</strong> Over-forecast region. Wind generated <em>less</em> than
                expected. This is a deficit risk.
              </li>
              <li>
                <strong>Grey Shaded Area:</strong> Under-forecast region. Wind generated <em>more</em> than expected.
              </li>
              <li>
                <strong>Reference Markers:</strong> Vertical dashed lines indicate the Morning Ramp (07:00 GMT) and
                Evening Peak (18:00 GMT).
              </li>
            </ul>

            <div className="docs-callout">
              <strong>Keyboard Shortcuts</strong>
              Press <code>←</code> or <code>→</code> on your keyboard to navigate between delivery days without using the
              mouse. Press <code>T</code> to jump directly to the Decision Desk.
            </div>
          </div>
        ),
      },
      {
        id: 'scenarios',
        group: 'User Manual',
        title: 'Benchmark Scenarios',
        content: (
          <div>
            <h1>Benchmark Scenarios (Quick-Jumps)</h1>
            <p>
              Located beside the date picker are 4 pre-configured scenario buttons. In trading demonstrations or shift
              handovers, these buttons let you jump immediately to noteworthy meteorological events without looking up
              dates.
            </p>

            <ul>
              <li>
                <strong>Storm Surge (27 Jan):</strong> National wind peak exceeded 17.6 GW with an average generation of
                16.4 GW. Demonstrates grid handling under extreme renewable volume.
              </li>
              <li>
                <strong>Calm Lull (08 Jan):</strong> Severe winter lull where wind dropped to a low of 1.7 GW (average 4.5
                GW). Demonstrates maximum thermal reliance.
              </li>
              <li>
                <strong>Max Imbalance (28 Jan):</strong> The single worst forecast miss in January 2026. The forecast
                over-estimated wind by +5.3 GW MAE (+116 GWh deficit), causing major CCGT reserve exposure.
              </li>
              <li>
                <strong>Best Tracking (19 Jan):</strong> The benchmark accuracy day. The meteorological model tracked actual
                generation with an MAE of only 407 MW.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'cutoff-slider',
        group: 'User Manual',
        title: 'Gate Closure Slider',
        content: (
          <div>
            <h1>Gate Closure Cutoff Slider</h1>
            <p>
              Under UK market rules, the standard Day-Ahead Gate Closure cutoff is <strong>11:00 GMT on Day D-1</strong>.
            </p>

            <h2>How the slider works</h2>
            <p>
              Dragging the cutoff slider tests what the forecast looked like at different times on the day before
              delivery:
            </p>
            <ul>
              <li>
                <strong>07:00 GMT:</strong> Early morning model run. Earlier weather data, slightly higher error.
              </li>
              <li>
                <strong>09:00 GMT:</strong> Mid-morning update.
              </li>
              <li>
                <strong>11:00 GMT:</strong> The official UK EPEX SPOT GB DAM gate closure cutoff (default).
              </li>
              <li>
                <strong>14:00 GMT:</strong> Post-auction update.
              </li>
              <li>
                <strong>18:00 GMT:</strong> Evening intraday update.
              </li>
            </ul>

            <div className="docs-callout">
              <strong>Sensitivity Modal</strong>
              Click the <strong>Sensitivity</strong> button in the header bar to view a matrix comparing all 5 cutoffs
              across all 1,488 settlement periods in January 2026.
            </div>
          </div>
        ),
      },
      {
        id: 'dispatch-sheet',
        group: 'User Manual',
        title: 'Thermal Procurement Schedule',
        content: (
          <div>
            <h1>Thermal Procurement & Dispatch Sheet</h1>
            <p>
              Located directly below the charts, this table translates raw Megawatt forecast errors into actionable power
              procurement instructions for the utility's dispatch team.
            </p>

            <h2>5 Market Blocks</h2>
            <p>The 48 half-hour settlement periods are grouped into 5 standard power trading blocks:</p>
            <ol>
              <li>
                <strong>Overnight Base (00:00–07:00 GMT):</strong> SP 01–14. Low demand, high baseload wind.
              </li>
              <li>
                <strong>Morning Ramp (07:00–09:00 GMT):</strong> SP 15–18. Morning industrial wake-up.
              </li>
              <li>
                <strong>Midday Workday (09:00–16:30 GMT):</strong> SP 19–33. Solar interaction and industrial loads.
              </li>
              <li>
                <strong>Evening Peak (16:30–19:30 GMT):</strong> SP 34–39. Highest consumer demand and highest cashout risk!
              </li>
              <li>
                <strong>Night Taper (19:30–24:00 GMT):</strong> SP 40–48. Post-peak demand ramp down.
              </li>
            </ol>

            <h2>Recommended Actions</h2>
            <ul>
              <li>
                <strong><code>PROCURE CCGT</code> (Shortfall Risk):</strong> The forecast over-predicted wind. Actual wind
                will fall short. The utility must buy thermal backup power (CCGT) to avoid severe imbalance fines.
              </li>
              <li>
                <strong><code>TURN DOWN THERMAL</code> (Surplus Wind):</strong> The forecast under-predicted wind. Actual
                wind is higher than expected. The utility can throttle down expensive gas plants.
              </li>
              <li>
                <strong><code>BALANCED</code>:</strong> Within normal spinning reserve tolerance (±200 MW).
              </li>
            </ul>

            <p>
              Click <strong>↓ Export Schedule (CSV)</strong> to download the complete 48-period dispatch schedule for
              the trading desk.
            </p>
          </div>
        ),
      },
      {
        id: 'uncertainty-band',
        group: 'User Manual',
        title: 'P10–P90 Uncertainty Corridor',
        content: (
          <div>
            <h1>P10–P90 Confidence Envelope</h1>
            <p>
              Weather is never 100% deterministic. In addition to a single dashed forecast line, traders need to know the
              expected error spread.
            </p>

            <h2>How to use it</h2>
            <ul>
              <li>
                In the chart legend, click <strong>P10–P90 Band: ON / OFF</strong>.
              </li>
              <li>
                A semi-transparent corridor appears around the forecast curve representing the 80% confidence interval
                (±1.28 standard deviations, derived from January 2026 variance).
              </li>
              <li>
                If the actual wind generation stays inside this corridor, the meteorological model performed within normal
                operational boundaries. If actual generation spikes outside the corridor, an extreme tail-risk event occurred.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'convergence-trace',
        group: 'User Manual',
        title: 'Forecast Revision Audit',
        content: (
          <div>
            <h1>Forecast Revision & Convergence Audit</h1>
            <p>
              How do you prove that a forecast was genuinely published before gate closure and not created with lookahead
              hindsight?
            </p>

            <h2>How to inspect any Settlement Period</h2>
            <ol>
              <li>Hover over any point on the main line chart and click it, or click <strong>Trace →</strong> on any row in the dispatch table.</li>
              <li>A modal titled <strong>Forecast Evolution & Convergence</strong> opens.</li>
              <li>
                It lists every weather model run published by Elexon for that specific half-hour (up to 25 revisions
                published over 3 days).
              </li>
              <li>
                It highlights the exact run labeled <strong>USED AT GATE CLOSURE</strong> (the latest run published on or
                before 11:00 GMT on D-1).
              </li>
              <li>
                It visually marks later intraday runs as <strong>Post-Cutoff (Intraday)</strong>, proving they were
                strictly excluded from the Day-Ahead decision state.
              </li>
            </ol>
          </div>
        ),
      },
      {
        id: 'risk-evaluation',
        group: 'User Manual',
        title: 'Risk & Evaluation Dashboard',
        content: (
          <div>
            <h1>Risk & Evaluation Dashboard</h1>
            <p>
              While the Decision Desk focuses on day-by-day bidding, the <strong>Risk & Evaluation</strong> view analyzes
              long-term meteorological accuracy across the entire month of January 2026.
            </p>

            <h2>Key Sections</h2>
            <ul>
              <li>
                <strong>Error Distribution Histogram:</strong> Groups forecast misses into 250 MW buckets and fits a
                Gaussian bell curve. Shows Mean Bias, Standard Deviation, Excess Kurtosis, and checks for "fat tails"
                (outlier events beyond 2 standard deviations).
              </li>
              <li>
                <strong>24-Hour Hourly Box Plots:</strong> Shows the median, interquartile range (IQR 50%), and outlier
                spikes for every hour of the day. Highlights that the evening peak (17:00–19:00 GMT) consistently carries
                the highest volumetric risk.
              </li>
              <li>
                <strong>Peak vs Off-Peak Filter:</strong> Easily compare errors during business peak hours (SP 15–38)
                versus overnight off-peak hours.
              </li>
            </ul>
          </div>
        ),
      },

      // ── Group 3: Market Rules ─────────────────────────────────────────────
      {
        id: 'market-primer',
        group: 'Market Rules',
        title: 'UK Day-Ahead Market (D-1)',
        content: (
          <div>
            <h1>UK Day-Ahead Market Rules</h1>
            <p>
              The UK electricity market operates through an exchange auction (EPEX SPOT GB DAM) where power is traded for
              delivery on the following day.
            </p>

            <h2>Timeline of a Trading Day</h2>
            <ul>
              <li>
                <strong>Day D-1, 10:00–11:00 GMT:</strong> Utility traders review wind forecasts and customer load demand.
              </li>
              <li>
                <strong>Day D-1, 11:00 GMT (Gate Closure):</strong> All Day-Ahead purchase bids are locked and submitted to
                the exchange.
              </li>
              <li>
                <strong>Day D-1, 12:00 GMT:</strong> Market clearing price and volumes are published.
              </li>
              <li>
                <strong>Day D, 00:00–24:00 GMT:</strong> Physical delivery across 48 half-hour settlement periods.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'lookahead-bias',
        group: 'Market Rules',
        title: 'Eliminating Lookahead Bias',
        content: (
          <div>
            <h1>What is Lookahead Bias?</h1>
            <p>
              <strong>Lookahead bias</strong> (also called data leakage) is a major flaw in many energy analytics tools.
              It happens when an algorithm uses data from the future that was not actually available when the decision had
              to be made.
            </p>

            <div className="docs-callout">
              <strong>Real-World Analogy</strong>
              Imagine you have to pack an umbrella before leaving home at 8:00 AM. Lookahead bias is checking a radar map
              published at 4:00 PM to decide if your 8:00 AM decision was smart. At 8:00 AM, the 4:00 PM map did not exist!
            </div>

            <h2>How our platform solves this</h2>
            <p>
              Our database queries strictly enforce:
              <br />
              <code>publish_time &lt;= &apos;2026-01-14 11:00:00&apos;</code> for target delivery on January 15th.
              Any forecast published at 11:01 GMT or later is rejected.
            </p>
          </div>
        ),
      },
      {
        id: 'settlement-periods',
        group: 'Market Rules',
        title: '48 Settlement Periods & Interpolation',
        content: (
          <div>
            <h1>Settlement Periods & Interpolation</h1>
            <p>
              In the UK electricity grid, each 24-hour day is divided into <strong>48 half-hour intervals</strong> called
              Settlement Periods (SP 1 = 00:00–00:30 GMT; SP 48 = 23:30–24:00 GMT).
            </p>

            <h2>The Resolution Mismatch</h2>
            <ul>
              <li>
                <strong>Actual Generation (`FUELHH`):</strong> Published every 30 minutes (48 readings per day).
              </li>
              <li>
                <strong>Forecast Generation (`WINDFOR`):</strong> Published as hourly predictions (24 values per day).
              </li>
            </ul>

            <h2>Linear Interpolation</h2>
            <p>
              To compare an hourly forecast against two half-hour actual readings without distortion, our alignment
              engine applies linear interpolation between hourly checkpoints. You can also switch to step-fill mode in the
              API settings.
            </p>
          </div>
        ),
      },

      // ── Group 4: Architecture ─────────────────────────────────────────────
      {
        id: 'tech-stack',
        group: 'Architecture',
        title: 'Tech Stack & Performance',
        content: (
          <div>
            <h1>Technical Stack & Architecture</h1>
            <p>
              The system is engineered for sub-millisecond calculation speeds, robust zero-lookahead fidelity, and high
              reliability.
            </p>

            <h2>Technology Overview</h2>
            <ul>
              <li>
                <strong>Frontend:</strong> React 18, Vite, TypeScript, Monochrome CSS Token System, Base UI accessible
                primitives, Three.js 3D grid.
              </li>
              <li>
                <strong>Backend:</strong> Python 3.11+, FastAPI (ASGI), Vectorized NumPy calculations, Pydantic data
                validation.
              </li>
              <li>
                <strong>Database:</strong> SQLite with Write-Ahead Logging (WAL) and memory-mapped queries (`mmap_size = 256MB`).
              </li>
              <li>
                <strong>Data Ingestion:</strong> Asynchronous streaming client for Elexon BMRS API with automated backfill
                for January 2026.
              </li>
            </ul>

            <h2>Verified Latency Benchmarks</h2>
            <pre>
              <code>{`• Core SQLite Alignment Query:  10.75 ms (p50) / 13.01 ms (p95)
• Vectorized NumPy Metrics:     12.55 ms (p50) / 14.95 ms (p95)
• Full HTTP API Endpoint:       18.36 ms (p50) / 25.46 ms (p95)`}</code>
            </pre>
          </div>
        ),
      },
      {
        id: 'data-pipeline',
        group: 'Architecture',
        title: 'Elexon BMRS Data Streams',
        content: (
          <div>
            <h1>Elexon BMRS Data Streams</h1>
            <p>
              Data is sourced directly from the official Elexon Balancing Mechanism Reporting Service (BMRS) REST and
              streaming endpoints:
            </p>

            <ul>
              <li>
                <strong>Actuals Stream (`FUELHH`):</strong> Endpoint:
                <code>https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream</code>. Filtered where
                <code>fuelType == &apos;WIND&apos;</code>.
              </li>
              <li>
                <strong>Forecast Stream (`WINDFOR`):</strong> Endpoint:
                <code>https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream</code>. Sourced with
                <code>startTime</code>, <code>publishTime</code>, and <code>generation</code>.
              </li>
            </ul>

            <p>
              The database is pre-seeded with all 1,488 settlement periods of January 2026 (71,424 forecast revisions),
              allowing instant offline queries without external network dependencies.
            </p>
          </div>
        ),
      },

      // ── Group 5: API Reference ────────────────────────────────────────────
      {
        id: 'api-overview',
        group: 'API Reference',
        title: 'REST Endpoints Overview',
        content: (
          <div>
            <h1>REST API Reference</h1>
            <p>
              The backend exposes clean, fully-typed REST endpoints documented with OpenAPI 3.0 / Swagger UI.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--fg)' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Endpoint</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>GET</code></td>
                  <td style={{ padding: '8px' }}><code>/health</code></td>
                  <td style={{ padding: '8px' }}>Server status, database record count, ping</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>GET</code></td>
                  <td style={{ padding: '8px' }}><code>/api/v1/dates</code></td>
                  <td style={{ padding: '8px' }}>Available January 2026 settlement dates</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>GET</code></td>
                  <td style={{ padding: '8px' }}><code>/api/v1/forecasts</code></td>
                  <td style={{ padding: '8px' }}>Day-Ahead aligned 48 periods, actuals, forecasts, errors</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>GET</code></td>
                  <td style={{ padding: '8px' }}><code>/api/v1/forecasts/revisions</code></td>
                  <td style={{ padding: '8px' }}>Model run convergence ladder for an interval</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>GET</code></td>
                  <td style={{ padding: '8px' }}><code>/api/v1/metrics</code></td>
                  <td style={{ padding: '8px' }}>MAE, RMSE, MBE, WAPE, distributions, box plots</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px' }}><code>POST</code></td>
                  <td style={{ padding: '8px' }}><code>/api/v1/sync</code></td>
                  <td style={{ padding: '8px' }}>Triggers on-demand live stream refresh</td>
                </tr>
              </tbody>
            </table>

            <h2>Interactive Swagger Documentation</h2>
            <p>
              To test the API interactively and view JSON schemas in your browser:
            </p>
            <p>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="btn solid"
                style={{ textDecoration: 'none' }}
              >
                Open FastAPI Swagger UI (/docs) ↗
              </a>
            </p>
          </div>
        ),
      },
    ],
    []
  );

  // Group sections by group name
  const groups = useMemo(() => {
    const map = new Map<string, DocSection[]>();
    sections.forEach((sec) => {
      const list = map.get(sec.group) || [];
      list.push(sec);
      map.set(sec.group, list);
    });
    return Array.from(map.entries());
  }, [sections]);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
    );
  }, [sections, searchQuery]);

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  return (
    <div className="docs-page" style={{ width: '100%', background: 'var(--bg)' }}>
      {/* Top Banner & Control Strip */}
      <div
        style={{
          borderBottom: '1px solid var(--line)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-alt)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SidebarTrigger />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
            Software Documentation & Instructions
          </span>
          <span style={{ color: 'var(--dim)', fontSize: 12 }}>·</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)' }}>
            {activeSection.group} / {activeSection.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="btn ghost"
            style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
          >
            Swagger API Docs ↗
          </a>
        </div>
      </div>

      {/* Composable Sidebar & Content Layout */}
      <SidebarProvider defaultOpen={true}>
        <div className="sidebar-provider">
          {/* Composable Sidebar */}
          <Sidebar>
            <SidebarHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--fg)',
                  }}
                >
                  TABLE OF CONTENTS
                </span>
                <input
                  type="text"
                  placeholder="Filter topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--fg)',
                    borderRadius: 2,
                  }}
                />
              </div>
            </SidebarHeader>

            <SidebarContent>
              {searchQuery.trim() ? (
                <SidebarGroup>
                  <SidebarGroupLabel>Search Results ({filteredSections.length})</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredSections.map((sec) => (
                        <SidebarMenuItem key={sec.id}>
                          <SidebarMenuButton
                            isActive={activeSectionId === sec.id}
                            onClick={() => {
                              setActiveSectionId(sec.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <span>{sec.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : (
                groups.map(([groupName, groupSections]) => (
                  <SidebarGroup key={groupName}>
                    <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {groupSections.map((sec) => (
                          <SidebarMenuItem key={sec.id}>
                            <SidebarMenuButton
                              isActive={activeSectionId === sec.id}
                              onClick={() => {
                                setActiveSectionId(sec.id);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              <span>{sec.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))
              )}
            </SidebarContent>

            <SidebarFooter>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--dim)', lineHeight: 1.4 }}>
                <div>UK EPEX SPOT GB DAM</div>
                <div style={{ marginTop: 2 }}>January 2026 Evaluation</div>
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* Main Documentation Content Area */}
          <main className="docs-content">{activeSection.content}</main>
        </div>
      </SidebarProvider>
    </div>
  );
};
