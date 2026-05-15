// Node bench: import the WASM module and run the same workload as native bench.
//   node bench_wasm.mjs [N]
import { performance } from "node:perf_hooks";
import * as wasm from "../src-tauri/wasm-pkg-node/engine_wasm.js";

const N = Number(process.argv[2] ?? 10000);

function makePlayer(id, position, skill) {
  return {
    id,
    name: id,
    position,
    ovr: skill,
    condition: 90,
    fitness: 75,
    pace: skill,
    stamina: skill,
    strength: skill,
    agility: skill,
    passing: skill,
    shooting: skill,
    tackling: skill,
    dribbling: skill,
    defending: skill,
    positioning: skill,
    vision: skill,
    decisions: skill,
    composure: skill,
    aggression: skill,
    teamwork: skill,
    leadership: skill,
    handling: skill,
    reflexes: skill,
    aerial: skill,
    traits: [],
  };
}

function makeTeam(id, skill) {
  const players = [makePlayer(`${id}_gk`, "Goalkeeper", skill)];
  for (let i = 0; i < 4; i++) players.push(makePlayer(`${id}_def${i}`, "Defender", skill));
  for (let i = 0; i < 4; i++) players.push(makePlayer(`${id}_mid${i}`, "Midfielder", skill));
  for (let i = 0; i < 2; i++) players.push(makePlayer(`${id}_fwd${i}`, "Forward", skill));
  return { id, name: id, formation: "4-4-2", play_style: "Balanced", players };
}

const home = makeTeam("HOM", 75);
const away = makeTeam("AWY", 70);

// Warmup (mirror native: 100 matches, seed 1)
wasm.bench_simulate(home, away, 100, 1n);

// === Run A: in-WASM loop (no JS↔WASM crossing per match) ===
const t0 = performance.now();
const result = wasm.bench_simulate(home, away, N, 42n);
const t1 = performance.now();
const ms = t1 - t0;

console.log("=== WASM engine benchmark (Node) ===");
console.log(`-- A) in-WASM loop --`);
console.log(`matches:        ${N}`);
console.log(`total elapsed:  ${ms.toFixed(2)} ms`);
console.log(`per match:      ${((ms * 1000) / N).toFixed(2)} µs`);
console.log(`throughput:     ${Math.round(N / (ms / 1000))} matches/sec`);
const homeGoals = result instanceof Map ? result.get("total_home_goals") : result.total_home_goals;
const awayGoals = result instanceof Map ? result.get("total_away_goals") : result.total_away_goals;
console.log(`home_goals_sum: ${homeGoals}`);
console.log(`away_goals_sum: ${awayGoals}`);

// === Run B: per-match JS↔WASM call (real frontend pattern) ===
//   Measures boundary cost: each call serializes inputs + deserializes report.
const Nb = Math.min(N, 2000);
const tb0 = performance.now();
let lastEvents = 0;
for (let i = 0; i < Nb; i++) {
  const r = wasm.simulate_match(home, away, null, BigInt(i + 1));
  // Touch result so optimizer can't drop it
  if (r instanceof Map) lastEvents = r.get("events")?.length ?? 0;
  else lastEvents = r.events?.length ?? 0;
}
const tb1 = performance.now();
const msB = tb1 - tb0;
console.log(`\n-- B) per-match JS↔WASM call --`);
console.log(`matches:        ${Nb}`);
console.log(`total elapsed:  ${msB.toFixed(2)} ms`);
console.log(`per match:      ${((msB * 1000) / Nb).toFixed(2)} µs`);
console.log(`throughput:     ${Math.round(Nb / (msB / 1000))} matches/sec`);
console.log(`last events:    ${lastEvents}`);
