import json
data = {
    "ticker": "SCAN",
    "config": {
        "fixedTakeProfitPct": 0.07,
        "breakEvenActivationPct": 0.07,
        "trailingActivationPct": 0.03,
        "trailingStopPct": 0.03,
        "stallExitDays": 2,
        "rankingCandidateLimit": 30,
        "maxConcurrentPositions": 10,
        "minVolume": 500000,
        "maxVolatility": 0.12,
    },
    "start_date": "2025-06-18",
    "end_date": "2026-06-09",
    "base_amt": 1000000,
}
with open("C:\\Users\\bnksys\\Desktop\\korea-stock-trading\\scan_test.json", "w") as f:
    json.dump(data, f)
print("done")
