import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// ATENÇÃO: Agora usaremos a variável API_FOOTBALL_KEY
const TOKEN = process.env.API_FOOTBALL_KEY;
const VITRINE_PATH = "dados/vitrine.json";

// IDs oficiais das Ligas na API-Football
// 39: Premier, 61: Ligue 1, 140: La Liga, 78: Bundesliga, 135: Serie A
// 2: Champions, 3: Europa, 843: Conference, 71: Brasileirão, 13: Libertadores
const LIGAS = [39, 61, 140, 73, 78, 135, 2, 3, 843, 71, 13];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  if (!TOKEN) {
    console.error("ERRO: Defina a variável API_FOOTBALL_KEY.");
    process.exit(1);
  }

  // Define os dias: Ontem, Hoje, Amanhã e Depois de Amanhã
  const datas = [];
  for (let i = -1; i <= 2; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    datas.push(d.toISOString().split("T")[0]);
  }

  let todosOsJogos = [];

  for (const data of datas) {
    console.log(`Buscando jogos do dia ${data}...`);
    try {
      const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${data}`, {
        headers: { "x-apisports-key": TOKEN }
      });

      if (!resp.ok) continue;
      const json = await resp.json();
      const matches = json.response || [];

      // Filtra apenas os jogos das ligas que nós queremos
      const jogosFiltrados = matches.filter(m => LIGAS.includes(m.league.id));

// Dentro do seu arquivo gerar-vitrine.mjs, atualize a extração dos dados:
const jogoSimplificado = {
    id: f.fixture.id,
    dataHora: f.fixture.date,
    status: f.fixture.status.short, // Aqui ele pega se é FT (Encerrado) ou NS (A iniciar)
    competicao: f.league.name,
    competicaoLogo: f.league.logo,
    casa: {
        id: f.teams.home.id,
        nome: f.teams.home.name,
        escudo: f.teams.home.logo,
        // Puxa o gol se existir, senão deixa vazio
        placar: f.goals.home !== null ? f.goals.home : "" 
    },
    fora: {
        id: f.teams.away.id,
        nome: f.teams.away.name,
        escudo: f.teams.away.logo,
        placar: f.goals.away !== null ? f.goals.away : ""
    }
};
      }));

      todosOsJogos.push(...jogosLimpos);
      console.log(`✅ ${jogosLimpos.length} jogos salvos para ${data}.`);
    } catch (err) {
      console.error(`Erro:`, err.message);
    }
    await delay(1000); // Pausa para não estourar o limite da API
  }

  todosOsJogos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  if (!existsSync("dados")) await mkdir("dados");

  await writeFile(VITRINE_PATH, JSON.stringify({ atualizadoEm: new Date().toISOString(), jogos: todosOsJogos }, null, 2) + "\n");
  console.log(`\n🎉 vitrine.json gerada com ${todosOsJogos.length} jogos.`);
}

main();
