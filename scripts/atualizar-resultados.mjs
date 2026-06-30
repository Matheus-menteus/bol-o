// Busca placares na API football-data.org, atualiza dados/resultados.json
// e, se entrou placar novo, gera mensagem.txt (pronta pro WhatsApp) p/ o e-mail.
// Local:  FD_TOKEN=seu_token node scripts/atualizar-resultados.mjs
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.FD_TOKEN;
const COMP = process.env.FD_COMP || "WC";
const JOGOS_PATH="dados/jogos.json", RES_PATH="dados/resultados.json", VOT_PATH="dados/votos.json", MSG_PATH="mensagem.txt";

const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const nomesDoTime = t => [t.nome, ...(t.api||[])].map(norm);

function casa(jogo, m){
  const home=norm(m.homeTeam?.name), away=norm(m.awayTeam?.name);
  const C=nomesDoTime(jogo.casa), F=nomesDoTime(jogo.fora);
  if (C.includes(home)&&F.includes(away)) return "normal";
  if (C.includes(away)&&F.includes(home)) return "invertido";
  return null;
}
const statusDe = s => ["FINISHED","AWARDED"].includes(s) ? "encerrado"
  : (["IN_PLAY","PAUSED","LIVE"].includes(s) ? "ao_vivo" : null);

export function casarTudo(jogos, apiMatches){
  const out={};
  for (const j of jogos){
    for (const m of apiMatches){
      const ori=casa(j,m); if(!ori) continue;
      const st=statusDe(m.status); if(!st) break;
      const sc=m.score||{};
      const foiPenaltis = sc.duration === "PENALTY_SHOOTOUT";
      let cg, fg;
      if (foiPenaltis){
        // placar = tempo normal + prorrogacao (penaltis vao em campos separados)
        cg = (sc.regularTime?.home||0) + (sc.extraTime?.home||0);
        fg = (sc.regularTime?.away||0) + (sc.extraTime?.away||0);
      } else {
        cg = sc.fullTime?.home; fg = sc.fullTime?.away;
      }
      if (cg==null||fg==null) break;
      let pCasa = sc.penalties?.home, pFora = sc.penalties?.away;
      let venApi = sc.winner; // HOME_TEAM / AWAY_TEAM / DRAW
      // a API usa home/away dela; mapeia pro casa/fora do bolao
      if (ori==="invertido"){
        let t=cg; cg=fg; fg=t;
        t=pCasa; pCasa=pFora; pFora=t;
        if (venApi==="HOME_TEAM") venApi="AWAY_TEAM";
        else if (venApi==="AWAY_TEAM") venApi="HOME_TEAM";
      }
      const vencedor = venApi==="HOME_TEAM" ? j.casa.nome
        : venApi==="AWAY_TEAM" ? j.fora.nome : null;
      const r={casa:cg,fora:fg,status:st,fonte:"api"};
      if (vencedor!=null) r.vencedor=vencedor;
      if (foiPenaltis){
        r.pen = (pCasa||0) > (pFora||0) ? "C" : "F";
        r.penCasa = pCasa||0;
        r.penFora = pFora||0;
      }
      out[j.id]=r; break;
    }
  }
  return out;
}
const desfecho = r => r.casa>r.fora ? "C" : (r.casa<r.fora ? "F" : "E");

export function ranking(jogos, votos, resultados){
  const nomes = votos.jogadores;
  const rods=[...new Set(jogos.map(j=>j.rodada))].sort((a,b)=>a-b);
  const tab=nomes.map(n=>{const o={nome:n,rod:{},total:0};rods.forEach(r=>o.rod[r]=0);return o;});
  for (const j of jogos){
    const r=resultados[j.id]; if(!r) continue;
    const d=desfecho(r); const v=votos.votos[j.id]||{};
    tab.forEach(p=>{ if(v[p.nome]===d){p.rod[j.rodada]++;p.total++;} });
  }
  tab.sort((a,b)=>b.total-a.total||(b.rod[rods.at(-1)]||0)-(a.rod[rods.at(-1)]||0));
  let pos=0,prev=null; tab.forEach((p,i)=>{ if(p.total!==prev){pos=i+1;prev=p.total;} p.pos=pos; });
  return {tab,rods};
}

export function montarMensagem(jogos, votos, resultados, novos){
  const byId=Object.fromEntries(jogos.map(j=>[j.id,j]));
  const {tab,rods}=ranking(jogos,votos,resultados);
  let L=[];
  L.push("🏆 BOLÃO COPA 2026 — Atualização");
  L.push("");
  L.push("🆕 Últimos resultados:");
  for (const id of novos){
    const j=byId[id], r=resultados[id]; if(!j||!r) continue;
    const d=desfecho(r);
    const vencedor = d==="C"?`${j.casa.flag} ${j.casa.nome}`:d==="F"?`${j.fora.flag} ${j.fora.nome}`:"🤝 Empate";
    const v=votos.votos[id]||{};
    const acertaram=votos.jogadores.filter(n=>v[n]===d);
    L.push(`• ${j.casa.nome} ${r.casa}x${r.fora} ${j.fora.nome} → ${vencedor}`);
    L.push(`   ✅ ${acertaram.length?acertaram.join(", "):"ninguém"}`);
  }
  L.push("");
  L.push("📊 Classificação geral:");
  const medal=p=>p.pos===1?"🥇":p.pos===2?"🥈":p.pos===3?"🥉":`${p.pos}º`;
  tab.forEach(p=>{ L.push(`${medal(p)} ${p.nome} — ${p.total} ${p.total===1?"acerto":"acertos"}`); });
  L.push("");
  L.push(`(R${rods.join(" / R")} já contam no total)`);
  return L.join("\n");
}

async function main(){
  if(!TOKEN){ console.error("Defina FD_TOKEN."); process.exit(1); }
  const jogos=JSON.parse(await readFile(JOGOS_PATH,"utf8")).jogos;
  const votos=JSON.parse(await readFile(VOT_PATH,"utf8"));
  let atual={resultados:{}}; try{ atual=JSON.parse(await readFile(RES_PATH,"utf8")); }catch{}
  const antes=atual.resultados||{};

  const resp=await fetch(`https://api.football-data.org/v4/competitions/${COMP}/matches`,{headers:{"X-Auth-Token":TOKEN}});
  if(!resp.ok){ console.error("API falhou:",resp.status,await resp.text()); process.exit(1); }
  const apiMatches=(await resp.json()).matches||[];
  console.log(`API retornou ${apiMatches.length} jogos.`);

  const apiRes=casarTudo(jogos,apiMatches);
  const merged={...antes};
  for(const [id,v] of Object.entries(apiRes)) merged[id]=v;

  // detecta jogos NOVOS/alterados (com placar)
  // "novo" = mudou placar/status (ignora o campo 'fonte' pra não disparar e-mail à toa)
  const sig = r => r ? `${r.casa}|${r.fora}|${r.status}` : "";
  const novos=Object.keys(merged).filter(id => sig(antes[id]) !== sig(merged[id]));

  const mudou = novos.length>0;
  if(mudou){
    await writeFile(RES_PATH, JSON.stringify({atualizado:new Date().toISOString(),resultados:merged},null,2)+"\n");
    const msg=montarMensagem(jogos,votos,merged,novos);
    const waLink="https://wa.me/?text="+encodeURIComponent(msg);
    const corpo=msg+"\n\n———\n📲 Abrir direto no WhatsApp (mensagem já pronta):\n"+waLink+"\n";
    await writeFile(MSG_PATH, corpo);
    console.log(`Atualizado: ${novos.length} jogo(s) novo(s). Mensagem gerada.`);
  } else {
    console.log("Sem placar novo.");
  }
  // sinaliza pro workflow (quantidade de novos)
  if(process.env.GITHUB_OUTPUT){
    await writeFile(process.env.GITHUB_OUTPUT, `novos=${novos.length}\n`, {flag:"a"});
  }
}
if (process.argv[1] && process.argv[1].endsWith("atualizar-resultados.mjs")) main();
