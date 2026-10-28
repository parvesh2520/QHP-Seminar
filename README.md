# Virtual Fly Lab — Full-Stack Computational Neuroscience Workbench

An interactive computational neuroscience workbench for exploring neural connectivity, simulating neural activity, running in silico virtual neuron perturbations, and screening candidate neurons.

---

## Workspace Architecture

```
Seminat/
├── virtual-fly-lab/   # React, TypeScript, Vite, React Three Fiber & Plotly frontend
├── backend/            # FastAPI, Pydantic, NumPy, SciPy & SQLAlchemy backend
└── README.md           # Workspace documentation & quick-start guide
```

---

## 1. Backend Quick Start (FastAPI + Python)

### Step 1: Navigate to backend directory
```bash
cd backend
```

### Step 2: Install dependencies (if not already installed)
```bash
pip install -r requirements.txt
```

### Step 3: Start the backend server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### Step 4: Run backend unit tests
```bash
pytest -v
```
*(All 25 unit tests pass, testing LIF numerical integration, interventions, candidate screening, persistence, and connectome importers).*

---

## 2. Frontend Quick Start (React + Three.js + Plotly)

### Step 1: Open a second terminal and navigate to frontend directory
```bash
cd virtual-fly-lab
```

### Step 2: Install dependencies (if not already installed)
```bash
npm install
```

### Step 3: Start Vite development server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Step 4: Run frontend tests
```bash
npm test
```

---

## 3. Integration

The frontend includes a typed client at [`virtual-fly-lab/src/services/backendApi.ts`](./virtual-fly-lab/src/services/backendApi.ts) configured to connect to `http://127.0.0.1:8000/api/v1` with CORS preconfigured for `http://localhost:5173`.
