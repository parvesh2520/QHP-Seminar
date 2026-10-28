def test_list_datasets(client):
    res = client.get("/api/v1/datasets")
    assert res.status_code == 200
    datasets = res.json()
    assert len(datasets) >= 1
    synth = next((d for d in datasets if d["id"] == "synthetic-fly-v1"), None)
    assert synth is not None
    assert synth["is_synthetic"] is True
    assert 80 <= synth["neuron_count"] <= 150
    assert synth["connection_count"] > 100


def test_get_network_summary(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "synthetic-fly-v1"
    assert 80 <= data["neuron_count"] <= 150
    assert "class_counts" in data
    assert "SEN" in data["class_counts"]
    assert data["class_counts"]["SEN"] == 24  # 12 left + 12 right


def test_get_network_summary_not_found(client):
    res = client.get("/api/v1/networks/nonexistent-network/summary")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_network_definition(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/definition")
    assert res.status_code == 200
    data = res.json()
    assert 80 <= len(data["neurons"]) <= 150
    assert len(data["classes"]) == 8
    assert len(data["populations"]) >= 6
    assert "synapse" in data


def test_get_network_subgraph(client):
    # Test GET subgraph
    res = client.get("/api/v1/networks/synthetic-fly-v1/subgraph?neuron_ids=VFL-0001&depth=2&limit_nodes=30")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 1
    assert data["depth"] == 2
    assert any(n["id"] == "VFL-0001" for n in data["nodes"])


def test_post_network_subgraph(client):
    payload = {
        "neuron_ids": ["VFL-0001", "VFL-0002"],
        "depth": 1,
        "limit_nodes": 50,
        "limit_edges": 100,
        "direction": "both",
    }
    res = client.post("/api/v1/networks/synthetic-fly-v1/subgraph", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 2
