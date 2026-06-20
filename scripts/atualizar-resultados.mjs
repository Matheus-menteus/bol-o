// Busca os placares da Copa na API football-data.org e atualiza dados/resultados.json
// Uso local:  FD_TOKEN=seu_token node scripts/atualizar-resultados.mjs
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.FD_TOKEN;
const COMP = process.env.FD_COMP || "WC";            // World Cup
const JOGOS_PATH = "dados/jogos.json";
const RES_PATH = "dados/resultados.json";

const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function nomesDoTime(t){ return [t.nome, ...(t.api||[])].map(norm); }

// casa um jogo (jogos.json) com um match da API (em qualquer orientação)
function casa(jogo, apiMatch){
  const home = norm(apiMatch.homeTeam?.name), away = norm(apiMatch.awayTeam?.name);
  const C = nomesDoTime(jogo.casa), F = nomesDoTime(jogo.fora);
  if (C.includes(home) && F.includes(away)) return "normal";
  if (C.includes(away) && F.includes(home)) return "invertido";
  return null;
}

function statusDe(s){
  if (["FINISHED","AWARDED"].includes(s)) return "encerrado";
  if (["IN_PLAY","PAUSED","LIVE"].includes(s)) return "ao_vivo";
  return null; // SCHEDULED/TIMED/etc -> ainda não tem placar
}

export function casarTudo(jogos, apiMatches){
  const out = {};
  for (const j of jogos){
    for (const m of apiMatches){
      const ori = casa(j, m);
      if (!ori) continue;
      const st = statusDe(m.status);
      if (!st) break; // achou o jogo mas ainda não começou
      let casaG = m.score?.fullTime?.home, foraG = m.score?.fullTime?.away;
      if (casaG==null || foraG==null) break;
      if (ori==="invertido"){ const t=casaG; casaG=foraG; foraG=t; }
      out[j.id] = { casa: casaG, fora: foraG, status: st, fonte: "api" };
      break;
    }
  }
  return out;
}

async function main(){
  if (!TOKEN){ console.error("Defina FD_TOKEN (token da football-data.org)."); process.exit(1); }
  const jogos = JSON.parse(await readFile(JOGOS_PATH,"utf8")).jogos;
  const resp = await fetch(`https://api.football-data.org/v4/competitions/${COMP}/matches`,
    { headers: { "X-Auth-Token": TOKEN } });
  if (!resp.ok){ console.error("API falhou:", resp.status, await resp.text()); process.exit(1); }
  const data = await resp.json();
  const apiMatches = data.matches || [];
  console.log(`API retornou ${apiMatches.length} jogos.`);

  const apiRes = casarTudo(jogos, apiMatches);

  // mescla: mantém entradas manuais de jogos que a API ainda não cobriu
  let atual = { resultados: {} };
  try { atual = JSON.parse(await readFile(RES_PATH,"utf8")); } catch {}
  const merged = { ...(atual.resultados||{}) };
  for (const [id,v] of Object.entries(apiRes)) merged[id] = v; // API tem prioridade nos que ela cobre

  const novo = { atualizado: new Date().toISOString(), resultados: merged };
  const antigo = JSON.stringify(atual.resultados||{});
  if (JSON.stringify(merged) === antigo){ console.log("Sem mudanças."); return; }
  await writeFile(RES_PATH, JSON.stringify(novo,null,2)+"\n");
  console.log(`Atualizado: ${Object.keys(apiRes).length} jogos casados na API; total ${Object.keys(merged).length}.`);
}

if (process.argv[1] && process.argv[1].endsWith("atualizar-resultados.mjs")) main();
