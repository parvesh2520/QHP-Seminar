import math
import pytest
from app.data.synthetic_network import generate_synthetic_network
from app.schemas.network import (
    ConnectionSchema,
    NetworkDefinitionSchema,
    NetworkMetadataSchema,
    PopulationSchema,
    SynapseParamsSchema,
)
from app.schemas.neuron import LIFParamsSchema, NeuronClassSchema, NeuronSchema
from app.schemas.simulation import SimulationConfigSchema, StimulusSchema
from app.simulation.lif import run_lif_simulation


@pytest.fixture
def single_neuron_network():
    return NetworkDefinitionSchema(
        metadata=NetworkMetadataSchema(
            id="single-test",
            name="Single neuron test",
            source="synthetic",
            version="1.0",
            is_synthetic=True,
            description="Unit test fixture",
        ),
        classes=[
            NeuronClassSchema(
                id="TEST",
                label="Test Class",
                description="",
                transmitter="excitatory",
                color="#fff",
            )
        ],
        neurons=[
            NeuronSchema(
                id="N-001",
                label="Neuron 1",
                class_id="TEST",
                hemisphere="L",
                position=[0, 0, 0],
                params=LIFParamsSchema(
                    v_rest=-65.0,
                    v_threshold=-50.0,
                    v_reset=-68.0,
                    tau_m=15.0,
                    refractory_ms=2.0,
                ),
                background_rate_hz=0.0,  # no stochastic noise
            )
        ],
        connections=[],
        populations=[
            PopulationSchema(
                id="pop-test",
                label="Test Population",
                role="output",
                description="",
                neuron_ids=["N-001"],
            )
        ],
        synapse=SynapseParamsSchema(),
    )


def test_simulation_reproducibility():
    net = generate_synthetic_network()
    cfg = SimulationConfigSchema(
        duration_ms=400.0,
        dt=0.1,
        seed=42,
        stimulus=None,
        record_voltage=False,
    )
    res1 = run_lif_simulation(cfg, net)
    res2 = run_lif_simulation(cfg, net)
    assert res1.spike_times == res2.spike_times
    assert res1.spike_neurons == res2.spike_neurons
    assert res1.spike_counts == res2.spike_counts


def test_simulation_different_seed_different_activity():
    net = generate_synthetic_network()
    cfg1 = SimulationConfigSchema(duration_ms=400.0, dt=0.1, seed=1, stimulus=None, record_voltage=False)
    cfg2 = SimulationConfigSchema(duration_ms=400.0, dt=0.1, seed=2, stimulus=None, record_voltage=False)
    res1 = run_lif_simulation(cfg1, net)
    res2 = run_lif_simulation(cfg2, net)
    assert res1.spike_times != res2.spike_times


def test_simulation_analytical_lif_firing_rate(single_neuron_network):
    # Constant depolarizing current above threshold
    intensity = 30.0  # mV
    stim = StimulusSchema(
        neuron_id="N-001",
        mode="excite",
        start_ms=0.0,
        duration_ms=1000.0,
        intensity=intensity,
    )
    cfg = SimulationConfigSchema(
        duration_ms=1000.0,
        dt=0.05,
        seed=1,
        stimulus=stim,
        record_voltage=True,
    )
    res = run_lif_simulation(cfg, single_neuron_network)
    p = single_neuron_network.neurons[0].params

    # Analytical period: T = tau_m * ln((I + V_rest - V_reset) / (I + V_rest - V_th)) + t_ref
    numerator = intensity + p.v_rest - p.v_reset
    denominator = intensity + p.v_rest - p.v_threshold
    analytical_period = p.tau_m * math.log(numerator / denominator) + p.refractory_ms

    spikes = res.spike_times
    assert len(spikes) > 10
    isis = [spikes[i + 1] - spikes[i] for i in range(len(spikes) - 1)]
    mean_isi = sum(isis) / len(isis)

    # Within 3% of analytical LIF equation
    assert abs(mean_isi - analytical_period) / analytical_period < 0.03


def test_refractory_period_respected():
    net = generate_synthetic_network()
    cfg = SimulationConfigSchema(duration_ms=500.0, dt=0.1, seed=7, stimulus=None, record_voltage=False)
    res = run_lif_simulation(cfg, net)

    last_spike = {}
    for t, n_idx in zip(res.spike_times, res.spike_neurons):
        ref_ms = net.neurons[n_idx].params.refractory_ms
        if n_idx in last_spike:
            assert t - last_spike[n_idx] >= ref_ms - 1e-4
        last_spike[n_idx] = t


def test_inhibitory_synapse_suppression():
    # Two neurons: N1 (inhibitory) -> N2 (target)
    net = NetworkDefinitionSchema(
        metadata=NetworkMetadataSchema(
            id="inh-test",
            name="Inhibition test",
            source="synthetic",
            version="1.0",
            is_synthetic=True,
            description="",
        ),
        classes=[
            NeuronClassSchema(id="INH", label="Inh", description="", transmitter="inhibitory", color="#f00"),
            NeuronClassSchema(id="EXC", label="Exc", description="", transmitter="excitatory", color="#0f0"),
        ],
        neurons=[
            NeuronSchema(id="N1", label="N1", class_id="INH", hemisphere="L", position=[0, 0, 0], params=LIFParamsSchema(), background_rate_hz=0),
            NeuronSchema(id="N2", label="N2", class_id="EXC", hemisphere="L", position=[1, 0, 0], params=LIFParamsSchema(), background_rate_hz=0),
        ],
        connections=[
            ConnectionSchema(source_id="N1", target_id="N2", weight=25.0, connection_type="inhibitory"),
        ],
        populations=[
            PopulationSchema(id="p-out", label="Out", role="output", description="", neuron_ids=["N2"]),
        ],
        synapse=SynapseParamsSchema(tau_syn_inh_ms=20.0, delay_ms=1.0),
    )

    # 1. Drive N2 alone
    cfg_alone = SimulationConfigSchema(
        duration_ms=400.0,
        dt=0.1,
        seed=1,
        stimulus=StimulusSchema(neuron_id="N2", mode="excite", start_ms=50.0, duration_ms=200.0, intensity=25.0),
        record_voltage=False,
    )
    res_alone = run_lif_simulation(cfg_alone, net)
    spikes_alone = res_alone.spike_counts[1]
    assert spikes_alone > 0

    # 2. Fire inhibitory N1 simultaneously
    # Stimulate N1 with strong excitation so it fires into N2
    cfg_with_inh = SimulationConfigSchema(
        duration_ms=400.0,
        dt=0.1,
        seed=1,
        stimulus=StimulusSchema(neuron_id="N2", mode="suppress", start_ms=50.0, duration_ms=200.0, intensity=20.0),
        record_voltage=False,
    )
    res_suppressed = run_lif_simulation(cfg_with_inh, net)
    # Suppression reduces activity
    assert res_suppressed.spike_counts[1] < spikes_alone
