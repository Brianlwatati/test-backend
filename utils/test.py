import json

# Load original JSON
with open("input.json", "r", encoding="utf-8") as f:
    data = json.load(f)

simplified = []

for index, match in enumerate(data, start=1):
    odds = {"H": None, "D": None, "A": None}

    # Find the 1X2 market
    for market in match.get("markets", []):
        if market.get("oddType") == "1X2":
            for outcome in market.get("outcomes", []):
                key = outcome.get("outcomeKey")
                value = outcome.get("oddValue")

                if key == "1":
                    odds["H"] = value
                elif key == "X":
                    odds["D"] = value
                elif key == "2":
                    odds["A"] = value

            break

    simplified.append({
        "match": index,
        **odds
    })

# Save simplified JSON
with open("simplified.json", "w", encoding="utf-8") as f:
    json.dump(simplified, f, indent=2)

print(json.dumps(simplified, indent=2))