# Post do LinkedIn — Portal Brasileirão

Texto que acompanha o carrossel (8 páginas, 4:5, PDF como _document post_):
[`post-linkedin-carousel.pdf`](post-linkedin-carousel.pdf).

- **Corpo do post:** cabe em 3.000 caracteres; o LinkedIn corta por volta de 210,
  então a primeira frase precisa se sustentar sozinha.
- **O link vai no primeiro comentário**, não no corpo.
- **Esta versão foi reconstruída a partir dos screenshots do compositor do LinkedIn**
  em 2026-09-02, depois de o rascunho se perder. Ver o histórico no fim do arquivo.
- Números conferidos em 2026-09-02: 41 módulos `*-core.ts`, 79 arquivos de teste
  (47 unitários + 32 de ponta a ponta). Reconferir antes de publicar — eles mudam.

---

## Corpo do post

Depois da Copa do Mundo, de volta com o Brasileirão.
O clube terminou a rodada em 4º. Por quantas posições ele passou na rodada?

A resposta a essa pergunta virou um dashboard no Portal Brasileirão. No painel de cada clube, a campanha aparece com uma vela (gráfico de candlestick) por rodada: o corpo vai da posição em que a rodada começou até a do fim dela, e o pavio atravessa todas as posições que o clube ocupou no meio do caminho.

O que tem no site:
• Classificação completa, com os recortes dos jogos em casa e fora
• A campanha de cada clube dentro da própria linha da tabela
• Jogos rodada a rodada, com gols, escalações e onde assistir
• Artilharia e o elenco de cada clube
• Uma página para cada clube, cada partida e cada estádio
• No estádio: capacidade, ano de inauguração e o clima no momento da leitura
• Painel do clube: seis números do time lidos contra a divisão inteira

A tecnologia por trás:
• React 19, TypeScript e Vite no front, com Tailwind v4
• Tokens do Material Design 3 gerados a partir de uma paleta tonal — o contraste é verificado antes de a paleta ser emitida
• Express servindo a API e o app no mesmo processo
• A lógica de cálculo isolada em 41 módulos puros, sem I/O
• Dá para testar classificação, critérios de desempate e campanha sem rede
• 79 arquivos de teste, entre unitários e de ponta a ponta com Playwright
• AWS em sa-east-1: t3.micro, systemd atrás do nginx
• Deploy a cada merge na main via OIDC — sem credencial de longa duração e sem SSH de entrada
• ~4 minutos do merge ao ar, com volta atrás automática se a versão nova não responder

Escrevi tudo dirigindo o Claude Code, de ponta a ponta — testes e pipeline de deploy incluídos. O que fez diferença não foi o modelo, e sim a disciplina em volta dele: manter a lógica de cálculo isolada, os testes por perto, e um documento no repositório registrando por que cada decisão foi tomada.

Que número você sente falta quando abre uma tabela do Brasileirão? As respostas vão me ajudar a escolher o próximo gráfico.

Link nos comentários.

#React #TypeScript #AWS #EngenhariaDeSoftware #Brasileirão

---

## Primeiro comentário

No ar: https://brasileirao.mpbarbosa.com

Roda numa t3.micro em sa-east-1, como serviço systemd atrás do nginx, com deploy automático a cada merge na main — via OIDC, sem nenhuma credencial AWS de longa duração e sem SSH de entrada. O /api/health devolve o commit de que o build saiu, então dá para conferir o que está no ar sem acreditar em mim.

---

## Procedência desta reconstrução

**Lido diretamente nos screenshots** (alta confiança):

- A abertura `Depois da Copa do Mundo, de volta com o Brasileirão.` — sem "Portal",
  que foi a última correção feita.
- Abertura e gancho **na mesma linha**, separados por quebra simples, não por
  linha em branco.
- O gancho encurtado para `Por quantas posições ele passou na rodada?`
- O parágrafo 2 inteiro (dashboard / vela / candlestick), palavra por palavra.
- `O que tem no site:` seguido **imediatamente** pelos marcadores, sem linha em branco.
- Os dois primeiros marcadores da primeira lista.
- O fecho inteiro: pergunta, `Link nos comentários.` e as hashtags.

**Assumido sem ter visto** (verificar antes de publicar):

- Marcadores 3 a 7 da primeira lista e a seção `A tecnologia por trás:` inteira —
  nunca apareceram na tela depois das edições, então foram mantidos como estavam.
- O parágrafo do Claude Code: só a última linha (`por que cada decisão foi tomada.`)
  apareceu num screenshot; o resto veio da versão salva.
- A linha em branco removida depois de `A tecnologia por trás:` — foi aplicada por
  simetria com a primeira lista, que essa sim foi observada.
