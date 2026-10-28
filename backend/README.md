# Virtual Fly Lab — Backend Platform

Computational neuroscience backend for **Virtual Fly Lab**, providing REST APIs for neural connectivity exploration, in silico leaky integrate-and-fire (LIF) network simulations, virtual neuron perturbations (excitation and suppression), and candidate screening against downstream output populations.

---

## 1. Architecture & Technology Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11 / 3.12 compatible)
- **Validation & Serialization**: [Pydantic v2](https://docs.pydantic.dev/) with camelCase & snake_case alias support
- **Numerical Computation**: [NumPy](https://numpy.org/) for CSR adjacency matrices, forward Euler integration, and ring buffers
- **Database & Persistence**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) with SQLite (local deployment) and PostgreSQL compatibility
- **Testing & Quality**: [pytest](https://pytest.org/) and [Ruff](https://astral.sh/ruff)
- **Server**: [Uvicorn](https://www.uvicorn.org/)

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI application entry point, CORS & lifespan
│   ├── api/                     # REST API route handlers
│   │   ├── health.py            # Health check endpoint (/api/v1/health)
│   │   ├── datasets.py          # Dataset listing and connectome import
│   │   ├── network.py           # Network summary, definition & subgraphs
│   │   ├── neurons.py           # Neuron search, details & synaptic connections
│   │   ├── experiments.py       # In silico experiment execution & history
│   │   └── analysis.py          # Candidate screening & ranking
│   ├── core/
│   │   └── config.py            # Pydantic BaseSettings & resource bounds
│   ├── schemas/                 # Pydantic request/response models
│   │   ├── neuron.py            # Neuron & LIF parameters schemas
│   │   ├── network.py           # Connections, populations & subgraph schemas
│   │   ├── simulation.py        # Simulation config, results & metrics schemas
│   │   ├── experiment.py        # Experiment records & comparison schemas
│   │   └── analysis.py          # Candidate perturbation screening schemas
│   ├── models/                  # SQLAlchemy 2.0 ORM tables
│   │   ├── network.py           # Network metadata & serialized definitions
│   │   ├── neuron.py            # Spatial coordinates & biophysical parameters
│   │   ├── connection.py        # Directed weighted synaptic connections
│   │   └── experiment.py        # Experiment records & status tracking
│   ├── db/
│   │   ├── database.py          # Database engine, session maker & init_db()
│   │   └── repository.py        # Clean database query & persistence layer
│   ├── simulation/              # Numerical computation engine
│   │   ├── lif.py               # Vectorized discrete forward-Euler LIF solver
│   │   ├── interventions.py     # Excitation & suppression current validation
│   │   ├── metrics.py           # Spike histograms, population sums & rates
│   │   └── comparison.py        # Baseline vs. intervention delta calculator
│   ├── data/
│   │   ├── synthetic_network.py # 106-neuron synthetic insect circuit generator
│   │   └── importers/           # Connectome subset data ingestion
│   │       ├── base.py          # Importer interface & validation protocols
│   │       ├── csv_importer.py  # Standard CSV connectome subset parser
│   │       └── flywire_importer.py # FlyWire connectome subset parser
│   └── services/                # Business & scientific orchestration
│       ├── network_service.py   # Subgraph extraction & degree calculations
│       ├── simulation_service.py# Matched baseline & intervention runs
│       ├── experiment_service.py# Experiment persistence & result serialization
│       └── analysis_service.py  # High-throughput candidate screening
├── tests/                       # 25 automated pytest unit tests
├── requirements.txt
├── pyproject.toml
├── .env.example
└── README.md
```

---

## 3. Installation & Quick Start

### Step 1: Create and activate virtual environment (optional but recommended)
```bash
python -m venv .venv
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate
```

### Step 2: Install dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Run the API Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger API docs: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**
- ReDoc alternative docs: **[http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)**
- Health check: **[http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)**

---

## 4. Running Tests & Quality Checks

Run the automated test suite with pytest:
```bash
pytest -v
```

Run code formatting and linting with Ruff:
```bash
ruff check app tests
```

---

## 5. REST API Documentation & Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health status and version. |
| `GET` | `/api/v1/datasets` | List all available datasets with synthetic/real provenance. |
| `POST` | `/api/v1/datasets/import` | Validate and import a generic CSV connectome subset. |
| `POST` | `/api/v1/datasets/import-flywire` | Validate and import a FlyWire connectome subset with 64-bit root IDs. |
| `GET` | `/api/v1/networks/{network_id}/summary` | Network neuron/connection count and class breakdown. |
| `GET` | `/api/v1/networks/{network_id}/definition` | Full network definition (classes, neurons, edges, populations). |
| `GET` | `/api/v1/networks/{network_id}/subgraph` | Neighborhood subgraph centered on target neurons for 3D viewer. |
| `GET` | `/api/v1/networks/{network_id}/neurons` | Search and filter neurons by class or population with pagination. |
| `GET` | `/api/v1/networks/{network_id}/neurons/{neuron_id}` | Detailed neuron properties, degree counts, and parameters. |
| `GET` | `/api/v1/networks/{network_id}/neurons/{neuron_id}/connections` | Synaptic connections (incoming, outgoing, or both). |
| `POST` | `/api/v1/experiments` | Create an in silico experiment record. |
| `POST` | `/api/v1/experiments/{experiment_id}/run` | Execute matched baseline and intervention simulation. |
| `GET` | `/api/v1/experiments/{experiment_id}` | Retrieve experiment status and configuration. |
| `GET` | `/api/v1/experiments/{experiment_id}/results` | Retrieve calculated spike rasters, voltage traces, and comparison summaries. |
| `GET` | `/api/v1/experiments` | List experiment history with pagination. |
| `DELETE`| `/api/v1/experiments/{experiment_id}` | Delete an experiment and its stored data. |
| `POST` | `/api/v1/analysis/candidates` | Screen candidate neurons against an output population and rank by $\| \Delta \|$. |

---

## 6. Example cURL Requests

### A. Health Check
```bash
curl -X GET "http://127.0.0.1:8000/api/v1/health"
```

### B. Retrieve Subgraph for 3D Viewer
```bash
curl -X GET "http://127.0.0.1:8000/api/v1/networks/synthetic-fly-v1/subgraph?neuron_ids=VFL-0001&depth=2&limit_nodes=50"
```

### C. Create & Run an In Silico Perturbation Experiment
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/experiments?run_now=true" \
  -H "Content-Type: application/json" \
  -d '{
    "networkId": "synthetic-fly-v1",
    "targetNeuronId": "VFL-0001",
    "mode": "excite",
    "stimStartMs": 100.0,
    "stimDurationMs": 200.0,
    "intensity": 30.0,
    "durationMs": 500.0,
    "dt": 0.1,
    "outputPopulationId": "pop-descending",
    "seed": 42,
    "recordVoltage": true
  }'
```

### D. Screen Candidates on Downstream Output
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/analysis/candidates" \
  -H "Content-Type: application/json" \
  -d '{
    "networkId": "synthetic-fly-v1",
    "candidateIds": ["VFL-0001", "VFL-0025", "VFL-0050", "VFL-0075"],
    "outputPopulationId": "pop-descending",
    "mode": "excite",
    "stimStartMs": 100.0,
    "stimDurationMs": 200.0,
    "intensity": 35.0,
    "durationMs": 400.0,
    "dt": 0.1,
    "seed": 10
  }'
```

---

## 7. Scientific Simulation Model & Dynamics

### Leaky Integrate-and-Fire (LIF) Equations
Membrane potential $V_i(t)$ updates via forward-Euler integration:
$$\tau_m \frac{dV_i}{dt} = -(V_i(t) - V_{\text{rest}}) + I_{\text{exc}, i}(t) - I_{\text{inh}, i}(t) + I_{\text{ext}, i}(t)$$

- **Decaying Synaptic Drives**:
  $$\frac{dI_{\text{exc}}}{dt} = -\frac{I_{\text{exc}}}{\tau_{\text{exc}}}, \quad \frac{dI_{\text{inh}}}{dt} = -\frac{I_{\text{inh}}}{\tau_{\text{inh}}}$$
- **Threshold & Reset**: When $V_i(t) \ge V_{\text{th}}$, a spike timestamp is logged, $V_i(t) \leftarrow V_{\text{reset}}$, and the neuron remains in absolute refractory state for $t_{\text{ref}}$.
- **Synaptic Delay Ring Buffer**: Presynaptic spikes queue weights to postsynaptic targets after transmission delay $\Delta t_{\text{delay}}$.
- **Intervention Modes**:
  - `excite`: Injects constant depolarizing current $I_{\text{ext}} = +\text{intensity}$ during $[t_{\text{start}}, t_{\text{start}} + t_{\text{duration}})$.
  - `suppress`: Injects hyperpolarizing current $I_{\text{ext}} = -\text{intensity}$ during the window.
- **Reproducibility**: Baseline and intervention conditions consume identical pseudo-random Poisson background streams derived from the configured integer seed.

---

## 8. Importing Real FlyWire Connectome Subsets

The platform provides a modular ingestion pipeline via `FlyWireConnectomeImporter`:
1. **Neuron metadata table**: Must contain `root_id` (64-bit integer string), `cell_type`, `neuropil` (e.g., AL, MB, CX, OL), and coordinates $(x, y, z)$.
2. **Synapse connectivity table**: Must contain `pre_root_id`, `post_root_id`, and `syn_count`.
3. **Physical vs. Physiological Distinction**: Physical synapse count is stored in `synapse_count` without assuming automatic translation into calibrated biophysical conductances.

---

## 9. Limitations & Scope

- **Synthetic Network**: The default dataset (`synthetic-fly-v1`) is an illustrative toy circuit ($N=118$), not an anatomical fruit-fly brain reconstruction.
- **LIF Toy Model**: Conductances and currents are simplified voltage-equivalent representations, not conductance-based Hodgkin-Huxley or multi-compartmental biophysics.
- **Statistical Significance**: Comparative results report exact model differences between deterministic simulation runs; no biological causality or empirical statistical significance is claimed.
