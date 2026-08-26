export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { jogoId, acao } = req.query;
  if (!jogoId) return res.status(400).json({ error: 'ID obrigatório.' });

  try {
    // 1. Busca os dados reais e estatísticas na API-Football
    const fdReq = await fetch(`https://v3.football.api-sports.io/fixtures?id=${jogoId}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const dataApi = await fdReq.json();
    const matchData = dataApi.response[0];
    if (!matchData) throw new Error('Jogo não encontrado');

    // Se for só aba de estatísticas, não consome tokens da IA
    if (acao === 'stats') {
       return res.status(200).json({ liveStats: matchData });
    }

    // 2. Extrai dados do confronto
    const casa = matchData.teams.home.name;
    const fora = matchData.teams.away.name;
    const competicao = matchData.league.name;
    const placar = `${matchData.goals.home ?? 0} x ${matchData.goals.away ?? 0}`;
    const status = matchData.fixture.status.long;
    const tempoJogo = matchData.fixture.status.elapsed ? `${matchData.fixture.status.elapsed}'` : 'Pré-jogo';

    // Extrai métricas para embasar os mercados de apostas
    let contextoEstatisticas = "Estatísticas em tempo real ainda não disponíveis (confronto pré-jogo).";
    if (matchData.statistics && matchData.statistics.length > 1) {
       const hStats = matchData.statistics[0].statistics;
       const aStats = matchData.statistics[1].statistics;
       const pegaDado = (arr, tipo) => arr.find(s => s.type === tipo)?.value || 0;

       contextoEstatisticas = `
       - Posse de Bola: ${casa} ${pegaDado(hStats, "Ball Possession")} vs ${pegaDado(aStats, "Ball Possession")} ${fora}
       - Finalizações no Gol: ${casa} ${pegaDado(hStats, "Shots on Goal")} vs ${pegaDado(aStats, "Shots on Goal")} ${fora}
       - Total de Chutes: ${casa} ${pegaDado(hStats, "Total Shots")} vs ${pegaDado(aStats, "Total Shots")} ${fora}
       - Faltas: ${casa} ${pegaDado(hStats, "Fouls")} vs ${pegaDado(aStats, "Fouls")} ${fora}
       - Escanteios: ${casa} ${pegaDado(hStats, "Corner Kicks")} vs ${pegaDado(aStats, "Corner Kicks")} ${fora}
       `;
    }

    // Prompt com foco analítico e mercados de apostas
    const prompt = `Você é um analista tático sênior focado em probabilidade e mercados de apostas esportivas.
Analise a partida a seguir:
Partida: ${casa} vs ${fora}
Competição: ${competicao}
Momento: ${status} (${tempoJogo})
Placar Atual: ${placar}
Métricas de Jogo:
${contextoEstatisticas}

Diretrizes da análise:
1. "panorama": 2 parágrafos curtos explicando o momento das equipes, a proposta de jogo de cada lado e como o ritmo da partida favorece ou desfavorece gols/espaços.
2. "insights": Retorne exatamente 3 bullet points objetivos focados em mercados de apostas (ex: Linhas de Gols Over/Under, Ambas Marcam, Escanteios ou Cartões). Justifique cada um com base no padrão tático ou nos números de pressão/chutes/faltas informados.

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "panorama": "Texto com 2 parágrafos.",
  "insights": [
    "Mercado 1: justificativa técnica e tática",
    "Mercado 2: justificativa técnica e tática",
    "Mercado 3: justificativa técnica e tática"
  ]
}`;

    const geminiReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const geminiData = await geminiReq.json();
    const iaResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

    return res.status(200).json({ panorama: iaResponse.panorama, insights: iaResponse.insights });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar análise da IA.' });
  }
}
