# Bolão da Galera — Copa 2026 (resultados e ranking automáticos)

Site estático (GitHub Pages) com **dados separados do `index.html`**. Os palpites continuam
indo pelo WhatsApp. Duas grandes vantagens:

- **Placar automático:** um robô do GitHub (Actions) busca os resultados numa API gratuita
  e atualiza `dados/resultados.json` sozinho.
- **Ranking automático:** o site calcula o ranking sozinho cruzando os **votos da galera**
  (`dados/votos.json`) com os **resultados**. Você não edita ranking na mão.

## Estrutura

```
(raiz do repositório)
├── index.html                    ← o site (nosso visual: Jogos / Ranking / Palpitar)
├── dados/
│   ├── jogos.json                ← os 48 jogos (times, bandeiras, grupo, data, nomes p/ API)
│   ├── votos.json                ← palpites de cada um por jogo (usado p/ calcular o ranking)
│   └── resultados.json           ← placares (o robô atualiza; ou você pelo painel admin)
├── scripts/
│   └── atualizar-resultados.mjs  ← robô que busca placares na API
└── .github/workflows/
    └── atualizar-resultados.yml  ← agenda o robô (a cada 30 min)
```

## Subir no GitHub (uma vez)

Coloque todos esses arquivos **na raiz** do repositório, mantendo as pastas `dados/`,
`scripts/` e `.github/workflows/`. Pelo site do GitHub: **Add file → Upload files** e arraste
a pasta inteira (ou crie os caminhos digitando `dados/jogos.json` etc. ao subir cada arquivo).
O GitHub Pages publica em alguns minutos.

> Importante: o site lê os JSON via `fetch`, então **não funciona abrindo o `index.html`
> clicando** (file://). No GitHub Pages funciona normal. Para testar no PC, veja o final.

## Ligar o robô de placares (opcional, mas recomendado)

1. Crie conta grátis em **https://www.football-data.org/client/register** → você recebe um
   **token** por e-mail. (O plano free cobre a Copa, código `WC`.)
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**
   - **Name:** `FD_TOKEN`  ·  **Secret:** cole o token  ·  Save.
3. Aba **Actions** → habilite os workflows → abra **"Atualizar resultados da Copa" → Run workflow**
   pra rodar a primeira vez. Depois roda sozinho a cada 30 min e dá commit quando um placar muda.

Se você **não** ligar o robô, sem problema: dá pra lançar placar na mão pelo painel admin (abaixo).

## Painel admin (placar manual / reserva)

No site, aba **Palpitar**, digite no campo de nome a senha **`admin2026`**. Abre um painel onde
você lança os placares à mão, e baixa um **`resultados.json`** pequeno pra subir em `dados/`.
Útil se o robô não estiver ligado ou demorar. O ranking se recalcula sozinho.
(Pra trocar a senha: no `index.html`, mude `const SENHA="admin2026";`.)

## Ranking: nada a fazer

O ranking é **automático**. Cada acerto (vitória/empate/derrota) vale 1 ponto, somando todas as
rodadas, com pódio e desempate por colocação. Conforme os placares entram (robô ou manual),
o ranking se atualiza sozinho.

## Próximas fases (Rodada 3, oitavas, etc.)

1. Adicione os jogos novos em `dados/jogos.json` com `"rodada": 3` (o site cria a aba sozinho).
2. Quando a galera votar (pela aba Palpitar → WhatsApp), some os votos em `dados/votos.json`
   no mesmo formato (`"id-do-jogo": {"Fulano":"C/E/F", ...}`), onde **C**=mandante, **E**=empate,
   **F**=visitante.
3. Resultados entram pelo robô ou pelo painel admin, e o ranking já considera a nova rodada.

## Detalhes úteis

- **Mudar a frequência do robô:** edite o `cron` no `.yml` (`*/30 * * * *` = 30 min; horário UTC).
- **Time não casou com a API:** abra `dados/jogos.json` e acrescente o nome em inglês que a API
  usa dentro da lista `"api"` daquele time (o robô casa sem acento e mesmo com mandante/visitante
  trocados).

## Testar no PC (opcional)

```bash
cd (pasta do projeto)
python3 -m http.server 8000
# abra http://localhost:8000

# testar o robô localmente:
FD_TOKEN=seu_token node scripts/atualizar-resultados.mjs
```
