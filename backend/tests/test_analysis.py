def test_screen_candidates_ranking(client):
    payload = {
        "networkId": "synthetic-fly-v1",
        "candidateIds": ["VFL-0001", "VFL-0025", "VFL-0050", "VFL-0075"],
        "outputPopulationId": "pop-descending",
        "mode": "excite",
        "stimStartMs": 100.0,
        "stimDurationMs": 200.0,
        "intensity": 35.0,
        "durationMs": 400.0,
        "dt": 0.1,
        "seed": 10,
    }
    res = client.post("/api/v1/analysis/candidates", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["totalCandidates"] == 4
    assert len(data["results"]) == 4

    # Verify descending ordering by absDelta
    results = data["results"]
    for i in range(len(results) - 1):
        assert results[i]["absDelta"] >= results[i + 1]["absDelta"]

    # Verify metrics consistency
    for r in results:
        assert r["absDelta"] == abs(r["delta"])
        assert r["delta"] == r["interventionOutput"] - r["baselineOutput"]


def test_screen_candidates_invalid_population(client):
    payload = {
        "networkId": "synthetic-fly-v1",
        "candidateIds": ["VFL-0001"],
        "outputPopulationId": "nonexistent-pop",
        "mode": "excite",
        "stimStartMs": 100.0,
        "stimDurationMs": 200.0,
        "intensity": 30.0,
        "durationMs": 400.0,
        "dt": 0.1,
        "seed": 1,
    }
    res = client.post("/api/v1/analysis/candidates", json=payload)
    assert res.status_code == 422
