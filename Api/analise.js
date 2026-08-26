// Arquivo: api/analise.js

export default async function handler(req, res) {
  // Configuração de CORS (caso o HTML fique no GitHub Pages e a API na Vercel)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { jogoId } = req.query;
  if (!jogoId) {
    return res.status(400).json({ error: 'O ID do jogo é obrigatório.' });
  }

  try {
    // 1. Busca os dados super atualizados (ao vivo) da football-data
    const fdReq = await fetch(`https://api.football-data.org/v4/matches/${jogoId}`, {
      headers: { 'X-Auth-Token': process.env.FD_TOKEN }
    });
    
    if (!fdReq.ok) throw new Error('Erro ao buscar dados na API de Futebol');
    const matchData = await fdReq.json();

    // 2. Prepara o contexto da partida para o Gemini
    const casa = matchData.homeTeam.shortName || matchData.homeTeam.name;
    const fora = matchData.awayTeam.shortName || matchData.awayTeam.name;
    const competicao = matchData.competition.name;
    const placar = `${matchData.score.fullTime.home ?? 0} x ${matchData.score.fullTime.away ?? 0}`;
    const status = matchData.status;

    // Prompt engessado para garantir que a IA responda sempre no mesmo formato
    const prompt = `Atue como um analista tático de futebol de alto nível.
    Jogo: ${casa} vs ${fora} (${competicao})
    Status: ${status}
    Placar Atual/Final: ${placar}

    Retorne APENAS um objeto JSON com esta estrutura (sem formatação markdown por fora):
    {
      "panorama": "Escreva 2 parágrafos curtos analisando o contexto deste jogo (fase dos times, importância do confronto ou resumo do que aconteceu se já acabou).",
      "insights": "Escreva 3 bullet points curtos com tendências, dicas de apostas (ex: over/under gols, escanteios) ou estatísticas chave."
    }`;

    // 3. Chama a API do Gemini (usando o modelo Flash, que é absurdamente rápido e barato/gratuito)
    const geminiReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Forçamos a IA a cuspir um JSON limpo e válido!
        generationConfig: { response_mime_type: "application/json" } 
      })
    });

    if (!geminiReq.ok) throw new Error('Erro na API do Gemini');
    const geminiData = await geminiReq.json();
    
    // Pega o texto da resposta e converte de volta para objeto JS
    const iaResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

    // 4. Devolve o "pacotão" pronto pro seu Frontend!
    return res.status(200).json({
      liveStats: matchData,        // Dados crus para você usar na aba "Ao Vivo"
      panorama: iaResponse.panorama,
      insights: iaResponse.insights
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar a análise tática.' });
  }
}