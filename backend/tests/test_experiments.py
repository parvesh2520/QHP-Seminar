def test_create_and_run_experiment_lifecycle(client):
    payload = {
        "networkId": "synthetic-fly-v1",
        "targetNeuronId": "VFL-0001",
        "mode": "excite",
        "stimStartMs": 100.0,
        "stimDurationMs": 200.0,
        "intensity": 30.0,
        "durationMs": 400.0,
        "dt": 0.1,
        "outputPopulationId": "pop-descending",
        "seed": 5,
        "recordVoltage": True,
    }

    # 1. Create experiment
    res_create = client.post("/api/v1/experiments", json=payload)
    assert res_create.status_code == 201
    exp_data = res_create.json()
    exp_id = exp_data["id"]
    assert exp_data["status"] == "pending"

    # 2. Run experiment
    res_run = client.post(f"/api/v1/experiments/{exp_id}/run")
    assert res_run.status_code == 200
    run_data = res_run.json()
    assert run_data["status"] == "completed"
    assert "summary" in run_data
    assert "baseline" in run_data
    assert "intervention" in run_data

    # 3. Check mathematical consistency of comparison summary
    baseline = run_data["baseline"]
    intervention = run_data["intervention"]
    summary = run_data["summary"]

    total_baseline_spikes = len(baseline["spikeTimes"])
    total_intervention_spikes = len(intervention["spikeTimes"])
    assert summary["totalSpikes"]["baseline"] == total_baseline_spikes
    assert summary["totalSpikes"]["intervention"] == total_intervention_spikes
    assert summary["totalSpikes"]["delta"] == total_intervention_spikes - total_baseline_spikes

    # 4. Get results endpoint
    res_results = client.get(f"/api/v1/experiments/{exp_id}/results")
    assert res_results.status_code == 200
    res_data = res_results.json()
    assert res_data["id"] == exp_id
    assert res_data["intervention"]["voltageTraces"] is not None

    # 5. List experiments
    res_list = client.get("/api/v1/experiments")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] >= 1
    assert any(e["id"] == exp_id for e in list_data["items"])

    # 6. Delete experiment
    res_del = client.delete(f"/api/v1/experiments/{exp_id}")
    assert res_del.status_code == 204

    # Verify deleted
    res_get_del = client.get(f"/api/v1/experiments/{exp_id}")
    assert res_get_del.status_code == 404


def test_invalid_experiment_parameters(client):
    payload = {
        "networkId": "synthetic-fly-v1",
        "targetNeuronId": "VFL-9999",  # nonexistent
        "mode": "excite",
        "stimStartMs": 100.0,
        "stimDurationMs": 200.0,
        "intensity": 30.0,
        "durationMs": 400.0,
        "dt": 0.1,
        "outputPopulationId": "pop-descending",
        "seed": 1,
    }
    # Run now triggers immediate validation
    res = client.post("/api/v1/experiments?run_now=true", json=payload)
    assert res.status_code in (404, 422)


def test_experiment_window_exceeds_duration(client):
    payload = {
        "networkId": "synthetic-fly-v1",
        "targetNeuronId": "VFL-0001",
        "mode": "excite",
        "stimStartMs": 350.0,
        "stimDurationMs": 200.0,  # 350 + 200 = 550 > 400 ms
        "intensity": 30.0,
        "durationMs": 400.0,
        "dt": 0.1,
        "outputPopulationId": "pop-descending",
        "seed": 1,
    }
    res = client.post("/api/v1/experiments?run_now=true", json=payload)
    assert res.status_code == 422
