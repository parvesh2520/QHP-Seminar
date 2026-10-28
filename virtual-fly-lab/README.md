# Virtual Fly Lab — Computational Neuroscience Workbench

**Virtual Fly Lab** is an interactive, browser-based computational neuroscience application designed for exploring neural connectivity and experimenting with simulated neural activity inspired by the adult *Drosophila melanogaster* (fruit fly) brain circuitry.

Built as a desktop-first research workstation with real-time 3D network visualization, a discrete-time leaky integrate-and-fire (LIF) simulation engine, interactive Plotly scientific charts, and high-throughput candidate perturbation screening.

---

## 1. Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **npm**: `v9.0.0` or higher
- A modern web browser supporting WebGL (Chrome, Edge, Firefox, or Safari)

---

## 2. Installation & Quick Start

All project code is located in the `virtual-fly-lab` directory.

### Step 1: Navigate to the project directory
```bash
cd virtual-fly-lab
```

### Step 2: Install dependencies
```bash
npm install
```

*(Note: Dependencies are already pre-installed if you cloned or pulled this directory with `node_modules`.)*

### Step 3: Start the local development server
```bash
npm run dev
```
Open your browser at the displayed local URL (typically `http://localhost:5173`).

---

## 3. Available NPM Scripts

From inside the `virtual-fly-lab` folder:

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server with hot module replacement (HMR). |
| `npm run build` | Runs TypeScript type checking (`tsc -b`) and bundles production assets. |
| `npm run preview` | Serves the production build locally for testing. |
| `npm run typecheck`| Validates TypeScript types across the entire project. |
| `npm test` | Runs the automated test suite with Vitest. |

---

## 4. Key Capabilities & Workflow

### A. 3D Neural Network Explorer (`Explore` tab)
- **3D Spatial Topology**: 106 neurons organized into 8 functional classes across left and right hemispheres (SEN, PN, LN, INT, FBI, CON, DN, PMN) with deterministic 3D coordinates.
- **Interactive Inspection**: Click any neuron node to inspect its incoming and outgoing synaptic connections, net synaptic weights, and population memberships.
- **Camera Controls**: Orbit, pan, zoom, center selected neuron, or reset camera.
- **Edge Highlighting**: Directed edges show gradient highlighting toward postsynaptic targets; unrelated neurons are dynamically dimmed.
- **Activity Playback**: After running an experiment, re-play network firing slowed down 10× in real-time 3D with glowing activation flashes.

### B. In Silico Interventions & Comparisons (`Experiments` tab)
- **Configurable Interventions**:
  - Target neuron selection
  - Mode: **Excite** (depolarizing current injection) or **Suppress** (hyperpolarizing current injection)
  - Timing: Start time (ms), duration (ms), intensity (mV-equivalent)
  - Time step (`dt`): Safe predefined steps ($0.02$, $0.05$, $0.1$, $0.2$ ms)
  - Target output population & seed
- **Strict Controls**: Automatically simulates a matched baseline (identical seed, initial potentials, and Poisson background drive) alongside the intervention.
- **Scientific Visualizations**:
  - **Spike Raster Plot**: WebGL-accelerated spike raster grouped by neuron class, with the stimulated neuron highlighted in white and stimulus duration shaded.
  - **Population Activity**: Spikes per 10 ms bin over time comparing baseline and intervention.
  - **Single-Neuron Membrane Potential**: Voltage time series ($V_m$) with dashed firing threshold line and discrete spike markers.
  - **What Changed**: Deterministic mathematical summary of net spike changes, active neuron counts, and output population responses.
- **Experiment History & Run Comparison**:
  - In-memory session history of up to 30 runs.
  - Side-by-side run comparison (Run A vs. Run B) with differential metrics.

### C. Candidate Screening (`Candidate Analysis` tab)
- Screen candidate interneurons to rank which perturbations produce the greatest absolute change ($|\Delta|$) in spike output of a chosen motor or descending population.
- Transparent computational screening displayed via interactive Plotly horizontal bar charts and sortable data tables.
- One-click loading of any candidate into the experiment workspace.

---

## 5. Scientific Model & Computational Architecture

### Leaky Integrate-and-Fire (LIF) Dynamics
Discrete forward-Euler integration over time step $dt$:
$$\tau_m \frac{dV}{dt} = -(V - V_{\text{rest}}) + I_{\text{exc}} - I_{\text{inh}} + I_{\text{ext}}$$

- **Synaptic Drives**:
  $$\frac{dI_{\text{exc}}}{dt} = -\frac{I_{\text{exc}}}{\tau_{\text{exc}}}, \quad \frac{dI_{\text{inh}}}{dt} = -\frac{I_{\text{inh}}}{\tau_{\text{inh}}}$$
- **Spike Event**: When $V(t) \ge V_{\text{th}}$, a spike is logged, $V \leftarrow V_{\text{reset}}$, and the neuron remains in absolute refractory state for $t_{\text{ref}}$.
- **Synaptic Delay**: Synaptic events deposit connection weights into a ring buffer delivered after transmission delay $\Delta t_{\text{delay}}$.
- **Web Worker Execution**: Numerical simulations execute in a background Web Worker, ensuring a 60 FPS UI without main-thread blocking.

> **Scientific Transparency**: The demo dataset is a synthetic, biologically inspired toy network ($N=106$), not the reconstructed whole-brain FlyWire connectome. All results are deterministic computational model predictions and should not be interpreted as validated biological findings.

---

## 6. Project Code Organization

```
virtual-fly-lab/
├── src/
│   ├── components/
│   │   ├── candidates/      # Candidate screening panel & ranking charts
│   │   ├── common/          # Reusable UI primitives (Section, PlotlyChart, ErrorBoundary)
│   │   ├── experiments/     # Experiment config sidebar & history table
│   │   ├── layout/          # App header, wordmark, Model info dialog
│   │   ├── network/         # 3D R3F viewer, instanced shaders, labels & geometry
│   │   └── results/         # Spike raster, binned population charts, membrane traces
│   ├── data/
│   │   ├── networkLoader.ts # Graph validation and CSR index builder
│   │   └── sampleNetwork.ts # Deterministic synthetic network generator (106 nodes)
│   ├── pages/               # ExplorePage, ExperimentsPage, CandidatesPage
│   ├── simulation/
│   │   ├── lifModel.ts      # LIF differential equations and parameters
│   │   ├── runSimulation.ts # Forward-Euler integration loop with CSR adjacency
│   │   ├── experiment.ts    # Matched baseline + intervention runner & validation
│   │   ├── metrics.ts       # Spike binning, voltage sampling, rate calculations
│   │   ├── comparison.ts    # Mathematical delta calculations & scientific statements
│   │   ├── screening.ts     # Multi-candidate perturbation ranking engine
│   │   └── worker/          # Web Worker thread client and protocol
│   ├── store/
│   │   └── labStore.ts      # Zustand state store for UI, experiments, and screening
│   ├── tests/               # Vitest simulation and metrics verification suite
│   ├── types/               # TypeScript type definitions for graph & simulation
│   ├── utils/               # Formatting, lookups, and seeded PRNG
│   ├── App.tsx              # Root 3-pane workbench layout
│   └── main.tsx             # Entry point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```
