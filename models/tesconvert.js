const fs = require("fs");

// Read the file
const data = JSON.parse(fs.readFileSync("jui.json", "utf8"));

// Transform it
const simplified = data.map((fixture, index) => ({
    match: index + 1,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    H: fixture.markets[0].outcomes.find(o => o.outcomeKey === "1").oddValue,
    D: fixture.markets[0].outcomes.find(o => o.outcomeKey === "X").oddValue,
    A: fixture.markets[0].outcomes.find(o => o.outcomeKey === "2").oddValue
}));

// Save output
fs.writeFileSync(
    "output.json",
    JSON.stringify(simplified, null, 2)
);

console.log(JSON.stringify(simplified, null, 2));