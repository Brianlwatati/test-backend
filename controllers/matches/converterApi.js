require("dotenv").config();
const mongoose = require("mongoose");
const createMatch = require("./createMatch");

async function fetchAndSave(apiUrl) {
  if (!apiUrl) throw new Error("API URL is required");

  await mongoose.connect(process.env.MONGO_URI);

  const resp = await fetch(apiUrl);
  if (!resp.ok) throw new Error(`Failed to fetch API: ${resp.status}`);
  const data = await resp.json();

  const simplified = data.map((fixture, index) => ({
    match: index + 1,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    H: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "1")?.oddValue,
    D: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "X")?.oddValue,
    A: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "2")?.oddValue
  }));

  const saved = await createMatch(simplified);
  return saved;
}

if (require.main === module) {
  const apiUrl = process.argv[2] || process.env.API_URL;
  if (!apiUrl) {
    console.error("Usage: node converterApi.js <API_URL>  or set API_URL in env");
    process.exit(1);
  }

  fetchAndSave(apiUrl)
    .then(result => {
      console.log("Saved matches:", Array.isArray(result) ? result.length : 1);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = fetchAndSave;
