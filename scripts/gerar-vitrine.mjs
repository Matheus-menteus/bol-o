import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const TOKEN = process.env.FD_TOKEN;
const VITRINE_PATH = "dados/vitrine.json";

// Códigos oficiais da football-data.org para as ligas solicitadas
// PL: Premier League, FL1: Ligue 1, PD: La Liga, BL1: Bundesliga, SA: Serie A
// CL: Champions, EL: Europa League, ECL: Conference League
// BSA: Brasileirão, CLI: Libertadores
const COMPETICOES = ["PL", "FL1", "PD", "BL1", "SA", "CL", "EL", "ECL", "BSA", "CLI"];

// Função para dar uma pequena pausa e não estourar o limite da API (rate limit)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  if (!TOKEN) {
    console.error("ERRO: Defina a variável FD_TOKEN.");
    process.exit(1);
  }

  // Define a janela de tempo: Ontem, Hoje e os próximos 3 dias
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const diasFrente = new Date(hoje);
  diasFrente.setDate(diasFrente.getDate() + 3);

  const fmtData = (d) => d.toISOString().split("T")[0];
  const dateFrom = fmtData(ontem);
  const dateTo = fmtData(diasFrente);

  console.log(`Buscando jogos de ${dateFrom} até ${dateTo}...`);

  let todosOsJogos = [];

  for (const comp of COMPETICOES) {
    console.log(`Buscando: ${comp}...`);
    try {
      const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const resp = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });

      if (resp.status === 403) {
        console.warn(`⚠️ Sem permissão no plano gratuito para a liga: ${comp}`);
      } else if (!resp.ok) {
        console.error(`❌ Erro na liga ${comp}: ${resp.status}`);
      } else {
        const data = await resp.json();
        const matches = data.matches || [];
        
        // Limpando o JSON para guardar só o que o front-end vai precisar
        const jogosLimpos = matches.map((m) => ({
          id: m.id,
          competicao: data.competition.name,
          competicaoLogo: data.competition.emblem,
          dataHora: m.utcDate,
          status: m.status, // TIMED, IN_PLAY, FINISHED...
          casa: {
            nome: m.homeTeam.shortName || m.homeTeam.name,
            escudo: m.homeTeam.crest,
            placar: m.score.fullTime.home,
          },
          fora: {
            nome: m.awayTeam.shortName || m.awayTeam.name,
            escudo: m.awayTeam.crest,
            placar: m.score.fullTime.away,
          },
        }));

        todosOsJogos.push(...jogosLimpos);
        console.log(`✅ ${comp}: ${jogosLimpos.length} jogos encontrados.`);
      }
    } catch (err) {
      console.error(`Erro ao processar ${comp}:`, err.message);
    }

    // Pausa de 1.5 segundos para respeitar o limite de 10 requests/minuto
    await delay(1500);
  }

  // Ordenar todos os jogos por data e hora
  todosOsJogos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

  // Garante que a pasta "dados" existe
  if (!existsSync("dados")) {
    await mkdir("dados");
  }

  // Salva o JSON enxuto no repositório
  const dadosFinais = {
    atualizadoEm: new Date().toISOString(),
    totalJogos: todosOsJogos.length,
    jogos: todosOsJogos,
  };

  await writeFile(VITRINE_PATH, JSON.stringify(dadosFinais, null, 2) + "\n");
  console.log(`\n🎉 Sucesso! vitrine.json gerada com ${todosOsJogos.length} jogos.`);
}

main();
