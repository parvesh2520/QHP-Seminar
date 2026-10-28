def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


def test_root_index_endpoint(client):
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert "documentation" in data
    assert data["documentation"] == "/docs"
