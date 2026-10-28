def test_list_neurons_pagination_and_filter(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/neurons?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert 80 <= data["total"] <= 150
    assert len(data["items"]) == 10

    # Filter by class
    res_sen = client.get("/api/v1/networks/synthetic-fly-v1/neurons?class_id=SEN")
    assert res_sen.status_code == 200
    data_sen = res_sen.json()
    assert data_sen["total"] == 24
    assert all(n["classId"] == "SEN" or n.get("class_id") == "SEN" for n in data_sen["items"])

    # Search query
    res_search = client.get("/api/v1/networks/synthetic-fly-v1/neurons?query=SEN-L01")
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert data_search["total"] == 1
    assert data_search["items"][0]["label"] == "SEN-L01"


def test_get_neuron_detail(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/neurons/VFL-0001")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "VFL-0001"
    assert "incoming_count" in data or "incomingCount" in data
    assert "outgoing_count" in data or "outgoingCount" in data
    assert "params" in data
    v_th = data["params"].get("vThreshold", data["params"].get("v_threshold"))
    assert v_th == -50.0


def test_get_neuron_detail_not_found(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/neurons/VFL-9999")
    assert res.status_code == 404


def test_get_neuron_connections(client):
    res = client.get("/api/v1/networks/synthetic-fly-v1/neurons/VFL-0001/connections?direction=outgoing")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert all(c.get("pre", c.get("source_id")) == "VFL-0001" for c in data["items"])
