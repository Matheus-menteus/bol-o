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

    // Se a requisição for só para abrir a aba "Ao Vivo", paramos por aqui e não gastamos tokens da IA!
    if (acao === 'stats') {
       return res.status(200).json({ liveStats: matchData });
    }

    // 2. Se a ação for 'ia', preparamos o contexto e chamamos o Gemini
    const casa = matchData.teams.home.name;
    const fora = matchData.teams.away.name;
    const competicao = matchData.league.name;
    const placar = `${matchData.goals.home ?? 0} x ${matchData.goals.away ?? 0}`;
    const status = matchData.fixture.status.long;

    // Envia a posse de bola para a IA ser mais precisa na análise
    let contextoTatico = "";
    if (matchData.statistics && matchData.statistics.length > 0) {
       const posseCasa = matchData.statistics[0].statistics.find(s => s.type === "Ball Possession")?.value || "50%";
       contextoTatico = `Tática em tempo real: ${casa} está com ${posseCasa} de posse de bola.`;
    }

    const prompt = `Atue como um analista tático de futebol.
    Jogo: ${casa} vs ${fora} (${competicao})
    Status: ${status} | Placar: ${placar}
    ${contextoTatico}

    Retorne APENAS um objeto JSON com esta estrutura (sem markdown por fora):
    {
      "panorama": "Escreva 2 parágrafos analisando o contexto deste jogo (fase, táticas ou resumo se já acabou).",
      "insights": ["Insight 1 focado em tendência ou aposta", "Insight 2", "Insight 3"]
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
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
