import math
import time
from typing import Dict, List, Set, Tuple
import numpy as np
from app.schemas.network import NetworkDefinitionSchema
from app.schemas.simulation import SimulationConfigSchema, SimulationResultSchema

MAX_STEPS = 100_000
MAX_DURATION_MS = 5000.0
MAX_VOLTAGE_SAMPLES = 2000


def run_lif_simulation(
    config: SimulationConfigSchema,
    network: NetworkDefinitionSchema,
) -> SimulationResultSchema:
    """Simulate the network as a current-based Leaky Integrate-and-Fire (LIF) network.

    Forward Euler integration:
      tau_m * dV/dt = -(V - V_rest) + I_exc - I_inh + I_ext
      dI_exc/dt = -I_exc / tau_syn_exc
      dI_inh/dt = -I_inh / tau_syn_inh
    """
    wall_start = time.perf_counter()

    # Basic validations
    if config.duration_ms <= 0 or config.duration_ms > MAX_DURATION_MS:
        raise ValueError(f"Simulation duration must be in (0, {MAX_DURATION_MS}] ms")
    if config.dt <= 0:
        raise ValueError("Time step dt must be > 0")

    steps = int(round(config.duration_ms / config.dt))
    if steps > MAX_STEPS:
        raise ValueError(f"Run exceeds {MAX_STEPS} integration steps; increase dt or shorten duration")

    N = len(network.neurons)
    neuron_ids = [n.id for n in network.neurons]
    index_by_id = {nid: i for i, nid in enumerate(neuron_ids)}

    dt = float(config.dt)
    syn = network.synapse
    decay_exc = math.exp(-dt / syn.tau_syn_exc_ms)
    decay_inh = math.exp(-dt / syn.tau_syn_inh_ms)
    delay_steps = max(1, int(round(syn.delay_ms / dt)))
    ring_size = delay_steps + 1

    # Fast contiguous parameter arrays
    v_rest = np.empty(N, dtype=np.float64)
    v_th = np.empty(N, dtype=np.float64)
    v_reset = np.empty(N, dtype=np.float64)
    dt_over_tau = np.empty(N, dtype=np.float64)
    ref_steps = np.empty(N, dtype=np.int32)
    bg_prob = np.empty(N, dtype=np.float64)

    for i, n in enumerate(network.neurons):
        v_rest[i] = n.params.v_rest
        v_th[i] = n.params.v_threshold
        v_reset[i] = n.params.v_reset
        dt_over_tau[i] = dt / n.params.tau_m
        ref_steps[i] = int(round(n.params.refractory_ms / dt))
        bg_prob[i] = min(1.0, (n.background_rate_hz * dt) / 1000.0)

    # Build adjacency in CSR layout for cache-friendly propagation
    outgoing_lists: List[List[Tuple[int, float, int]]] = [[] for _ in range(N)]
    for c in network.connections:
        pre_idx = index_by_id.get(c.source_id)
        post_idx = index_by_id.get(c.target_id)
        if pre_idx is not None and post_idx is not None:
            is_inh = 1 if c.connection_type == "inhibitory" else 0
            outgoing_lists[pre_idx].append((post_idx, float(c.weight), is_inh))

    out_offset = np.zeros(N + 1, dtype=np.int32)
    for i in range(N):
        out_offset[i + 1] = out_offset[i] + len(outgoing_lists[i])

    total_synapses = out_offset[N]
    out_target = np.zeros(total_synapses, dtype=np.int32)
    out_weight = np.zeros(total_synapses, dtype=np.float64)
    out_inhibitory = np.zeros(total_synapses, dtype=np.uint8)

    for i in range(N):
        for k, (t_idx, w, is_inh) in enumerate(outgoing_lists[i]):
            idx = out_offset[i] + k
            out_target[idx] = t_idx
            out_weight[idx] = w
            out_inhibitory[idx] = is_inh

    # Parse external intervention
    stim = config.stimulus
    stim_idx = -1
    stim_start_step = 0
    stim_end_step = 0
    stim_current = 0.0

    if stim:
        if stim.neuron_id not in index_by_id:
            raise ValueError(f"Stimulus target neuron '{stim.neuron_id}' not found in network")
        stim_idx = index_by_id[stim.neuron_id]
        stim_start_step = int(round(stim.start_ms / dt))
        stim_end_step = int(round((stim.start_ms + stim.duration_ms) / dt))
        stim_current = float(stim.intensity if stim.mode == "excite" else -stim.intensity)

    # Setup recording of membrane potentials
    # We record selected neurons (e.g. stimulus target + specified neurons) to prevent huge memory spikes
    recorded_indices: Set[int] = set()
    if config.record_voltage:
        if config.voltage_neuron_ids:
            for vid in config.voltage_neuron_ids:
                if vid in index_by_id:
                    recorded_indices.add(index_by_id[vid])
        elif stim_idx >= 0:
            recorded_indices.add(stim_idx)
            # Add up to 4 other random sample neurons across classes
            step_stride = max(1, N // 5)
            for idx in range(0, N, step_stride):
                recorded_indices.add(idx)
        else:
            # Default to first 5 neurons
            for idx in range(min(5, N)):
                recorded_indices.add(idx)

    record_every = max(1, int(math.ceil(steps / MAX_VOLTAGE_SAMPLES)))
    sample_count = int(math.ceil(steps / record_every))
    sample_interval_ms = record_every * dt

    voltage_traces: Dict[str, List[float]] = {neuron_ids[i]: [] for i in recorded_indices}
    voltage_time_points: List[float] = []

    # PRNG for deterministic reproducible run
    rng = np.random.default_rng(config.seed)

    # State variables
    V = v_reset + rng.random(N) * (v_th - v_reset) * 0.8
    I_exc = np.zeros(N, dtype=np.float64)
    I_inh = np.zeros(N, dtype=np.float64)
    ref_until = np.zeros(N, dtype=np.int32)

    exc_buf = np.zeros(ring_size * N, dtype=np.float64)
    inh_buf = np.zeros(ring_size * N, dtype=np.float64)
    bg_weight = float(syn.background_weight)

    spike_times: List[float] = []
    spike_neurons: List[int] = []
    spike_counts = np.zeros(N, dtype=np.int32)

    # Main forward simulation loop
    for t in range(steps):
        slot = (t % ring_size) * N
        deliver_slot = ((t + delay_steps) % ring_size) * N
        stim_on = (t >= stim_start_step) and (t < stim_end_step)
        record = config.record_voltage and (t % record_every == 0)

        if record:
            voltage_time_points.append(round(t * dt, 3))

        # Vectorized background draws for this time step
        bg_draws = rng.random(N) < bg_prob
        bg_drive = np.where(bg_draws, bg_weight, 0.0)

        # Decay synaptic inputs & pull from ring buffer
        I_exc = I_exc * decay_exc + exc_buf[slot : slot + N] + bg_drive
        I_inh = I_inh * decay_inh + inh_buf[slot : slot + N]
        exc_buf[slot : slot + N] = 0.0
        inh_buf[slot : slot + N] = 0.0

        for i in range(N):
            if t < ref_until[i]:
                V[i] = v_reset[i]
            else:
                iext = stim_current if (stim_on and i == stim_idx) else 0.0
                V[i] += dt_over_tau[i] * (v_rest[i] - V[i] + I_exc[i] - I_inh[i] + iext)

                if V[i] >= v_th[i]:
                    spike_time = round(t * dt, 3)
                    spike_times.append(spike_time)
                    spike_neurons.append(i)
                    spike_counts[i] += 1
                    V[i] = v_reset[i]
                    ref_until[i] = t + 1 + ref_steps[i]

                    # Propagate spikes to postsynaptic targets in the delay ring buffer
                    start_j = out_offset[i]
                    end_j = out_offset[i + 1]
                    for j in range(start_j, end_j):
                        target = out_target[j]
                        w = out_weight[j]
                        if out_inhibitory[j]:
                            inh_buf[deliver_slot + target] += w
                        else:
                            exc_buf[deliver_slot + target] += w

            if record and i in recorded_indices:
                voltage_traces[neuron_ids[i]].append(round(float(V[i]), 2))

    wall_time_ms = round((time.perf_counter() - wall_start) * 1000.0, 2)

    return SimulationResultSchema(
        config=config,
        neuron_ids=neuron_ids,
        spike_times=spike_times,
        spike_neurons=spike_neurons,
        spike_counts=spike_counts.tolist(),
        sample_count=sample_count,
        sample_interval_ms=sample_interval_ms,
        wall_time_ms=wall_time_ms,
        voltage_traces=voltage_traces if config.record_voltage else None,
        voltage_time_points=voltage_time_points if config.record_voltage else None,
    )
