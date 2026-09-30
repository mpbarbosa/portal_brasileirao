# Jev (TypeSafe) neste projeto

Guia prático de como usar o **Jev**, o modelo "System One" da TypeSafe, no Portal
Brasileirão. Escrito a partir da documentação oficial (docs.typesafe.ai, lida em
2026-09-29) e do protótipo que já existe aqui para os melhores momentos.

A documentação ao vivo é a fonte de verdade: `https://docs.typesafe.ai/llms.txt`
lista todas as páginas, e acrescentar `.md` a qualquer endereço devolve o
Markdown. Números de preço, limites e versão abaixo são **leituras datadas**,
não constantes.

## O que o Jev é, e o que não é

O Jev não gera texto. Ele recebe um **estado** (o conteúdo a julgar) e um mapa
de **perguntas tipadas**, e devolve respostas estruturadas com probabilidades,
que o código consome direto — sem pedir JSON a um LLM e fazer parse depois.

- **É** senso comum programável: classificar, rotear, verificar, pontuar.
- **Não é** um agente: não chama ferramentas, não escreve código, não conversa,
  e **não substitui** o modelo por trás do Claude Code. Ele entra *ao lado* dele,
  em decisões pequenas e bem delimitadas.

## As três perguntas

| Tipo | Pergunta | Resposta |
|---|---|---|
| **Noul** | "Isto é verdade?" | `noul`: probabilidade de *sim*, de 0 a 1 |
| **Choice** | "Qual destas opções?" (até 255) | `choice`, `probabilities`, `confidence` |
| **Score** | "Em que nível?" (2 a 10 níveis descritos) | `score`, `legend`, `probabilities`, `confidence` |

Regras que valem para as três:

- **Uma pergunta, um julgamento.** Julgamentos compostos se quebram em várias
  perguntas e se combinam no código.
- **O id da pergunta não chega ao modelo.** A `instructions` precisa dizer tudo;
  referencie campos do estado com crases, como `` `video.title` ``.
- **Dê uma saída "nenhuma"** numa Choice (`different_match`, `other`) sempre que
  nada da lista possa servir.
- **`criteria` aceita objetos**: `what`, `not_for` e exemplos separam opções
  parecidas melhor do que uma frase só.
- Perguntas sobre o mesmo estado vão **na mesma requisição**: rodam em paralelo e
  não enxergam as respostas umas das outras.

**Confiança não é probabilidade.** A confiança resume o formato da distribuição
(uma opção dominante → perto de 1; tudo espalhado → perto de 0). A documentação
sugere agir sozinho acima de 0,9, pedir cuidado entre 0,5 e 0,9, e mandar para
uma pessoa abaixo de 0,5 — **pontos de partida para ajustar com dados próprios**.
Um Noul em 0,5 significa "sim e não igualmente prováveis", não "meio verdade".

## Os limites que decidem o desenho

A própria TypeSafe publica as fraquezas do `jev-1.13`
(`docs.typesafe.ai/model-jaggedness/jev-1.13.md`). As que mais importam aqui:

- **Datas são lidas como texto**, não como quantidades ordenadas.
- **Contas e números** não são confiáveis.
- **Lê ao pé da letra**; negação dupla e raciocínio em várias etapas pioram.
- **Contexto irrelevante** degrada a resposta.
- **Conteúdo adversário** no estado pode influenciar o resultado.
- **Idioma:** o foco é inglês; português funciona com precisão menor.

Daí a regra deste projeto: **fatos ficam no código, leitura fica no Jev.**
Canal, placar, rodada, temporada e janela de upload são comparações exatas e
nunca vão para o modelo — o protótipo nem mostra o placar a ele, para não
convidá-lo a responder o que ninguém perguntou.

## Configuração

1. A chave vai no `.env` (ignorado pelo git), nunca no código:

   ```
   TYPESAFE_API_KEY=apikey_...
   ```

   O `.env` da raiz é copiado para cada worktree novo (ver `CLAUDE.md`). Scripts
   carregam com `import "dotenv/config"`.
2. **Só em workstation.** Como CBF e YouTube, a TypeSafe não é dependência de
   produção: nenhum arquivo que o servidor importa chama a API. Uma variável
   nova no servidor exigiria um padrão seguro quando ausente (ver *New env vars
   must work when unset*).
3. Sem SDK: `scripts/typesafe-api.ts` é o transporte, em `fetch`, no padrão de
   `cbf-api.ts`. Se um dia valer o SDK, é `@typesafe-ai/sdk` (Node ≥ 20).

## Uma chamada

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
```

```json
{
  "model": "jev-latest",
  "state": { "video": { "title": "PALMEIRAS 4 X 1 VASCO | MELHORES MOMENTOS" } },
  "questions": {
    "highlights": {
      "type": "noul",
      "instructions": "Is the video titled `video.title` a highlights package of a single match?",
      "criteria": { "true": "melhores momentos, gols, compacto", "false": "anything else" }
    }
  }
}
```

Resposta: `{ "model": "jev-1.13.0", "answers": { "highlights": { "type": "noul", "noul": 0.97 } }, "usage": { … } }`.

Erros: **401** chave inválida, **422** requisição recusada (o corpo diz qual
campo), **429** limite de taxa, **529** sobrecarga — os dois últimos com backoff
exponencial, que `askSystemOne` já faz.

## O padrão, em código

Siga a divisão de `highlight-search-core.ts` / `highlight-judge-core.ts`:

1. **Um `*-core.ts` puro** monta a requisição (`judgeRequest`) e compõe as
   respostas com as regras do código (`judgeVerdict`). Sem rede, sem relógio —
   `tests/core-purity.test.ts` cobra isso.
2. **Valide as respostas campo a campo** (`parseJudgeAnswers`): qualquer coisa
   ausente ou fora de [0, 1] vira `null`. Zero é uma probabilidade real, não uma
   ausência.
3. **Na dúvida, retenha; nunca aceite.** Resposta ilegível, confiança abaixo do
   limite ou fato que o código não consegue checar → `unconfirmed`, para uma
   pessoa decidir.
4. **Teste com respostas fixas** e confirme cada ramo por mutação: apague a
   regra e veja o teste ficar vermelho. No protótipo, o teste da janela de
   upload passava com a janela apagada até ganhar um caso próprio.

## Medir antes de adotar

Um juiz novo entra comparado com o que já existe, sobre casos com resposta
conhecida. Os dois scripts do protótipo fazem isso:

```sh
# 1. positivos já curados + negativos construídos (invertida, outra partida, outra competição)
npx tsx scripts/eval-highlight-judge.ts --round 24

# 2. o que as regras recusaram numa busca real, posto diante do Jev
npx tsx scripts/find-highlights.ts --round 24 --dump r24.json
npx tsx scripts/rejudge-rejected-highlights.ts r24.json
```

O que eles mediram em 2026-09-29, nas rodadas 24 e 28:

- **Aceitos errados: zero.** Em 92 casos construídos e em 413 recusados reais, o
  Jev nunca liberou um link errado nem perdeu um certo que as regras acertam.
- **Resgates: zero links novos.** Dois vídeos legítimos que a regex não lê
  (um "COMPACTO" da CazéTV, um "CRUZEIRO VENCE VITÓRIA" do ge tv) ficaram
  retidos — e as duas partidas já tinham link do mesmo canal.
- **As respostas variam entre execuções:** com as mesmas entradas, uma rodada
  reteve 4 partidas invertidas e a seguinte 1. Casos perto do limite mudam de
  lado.

**Viés a lembrar:** os positivos do primeiro script são links que as regras já
tinham achado, então um título que só o Jev leria não pode aparecer ali. É por
isso que o segundo script existe.

## O limite que a varredura das 24 rodadas mediu

Em 2026-09-30 os dois scripts rodaram sobre as **24 rodadas restantes**: 237
partidas, 7.722 candidatos, 5.513 recusados de canais conhecidos ao Jev, US$
0,19. O resultado muda o que se pode dizer do modelo.

**Aceitou seis, e nenhum estava errado** — todos eram grafias que `namesClub`
não alcança: quatro títulos escrevendo **"ATHLETICO"** sem o `-PR`, e dois com
erro de digitação de uma letra (`SANTOX`, `AHLETICO-PR`). **Quatro dos seis já
estavam no arquivo, curados à mão**, o que é a medida do custo: essa lacuna já
tinha cobrado trabalho manual quatro vezes.

**A leitura confiante do modelo sobre QUAL partida é, isolada, não é
confiável** — e este é o limite a conhecer antes de subir qualquer limiar. Nos
293 candidatos recusados por *título sem placar legível* cujo canal a partida
não tinha, 35 vieram com pacote ≥ 0,90 **e** partida ≥ 0,90; abertos um a um, a
maioria é falso positivo:

- `ATHLETICO 1 X 2 VITÓRIA | 32ª RODADA` lido como Atlético-MG x Vitória da
  rodada 25 — outro clube, outra rodada, outro placar;
- `MIRASSOL E CRUZEIRO EMPATAM EM 1 A 1` lido como o 2x2 daquelas equipes;
- `BOTAFOGO 3 X 1 FLAMENGO | BRASILEIRÃO SUB-20` lido como o jogo profissional.

Nada disso chega a ser aceito, porque `judgeVerdict` retém todo título sem
placar que o código possa conferir — o desenho segura. O que a medição diz é
**por que** ele segura: sem o placar no estado, por decisão, o modelo casa
nomes de clube e responde "esta partida" com convicção mesmo quando o placar do
próprio título contradiz a partida. Um limiar sobre a resposta dele, sozinho,
publicaria links errados.

## Custo

Preço publicado (`docs.typesafe.ai/models.md`, lido em 2026-09-29): **US$ 0,042
por milhão de tokens de entrada; saída grátis.** Limites: 64k tokens por
requisição, 1.200 requisições/min, ajustados dinamicamente.

Medido: 413 julgamentos = 345.589 tokens = **US$ 0,0145**, em 34 s.

Comparado ao Claude Code julgando os mesmos 413 candidatos (estimado com o
preço do Opus 5.5 e ~3,5 caracteres por token): **~US$ 0,20–0,30** contra
**~US$ 0,05–0,07** com o Jev filtrando e o Claude revisando só os 17 retidos.
Nos dois casos o que domina é o contexto fixo de cada rodada de conversa no
Claude Code, não o julgamento. O ganho do Jev é **atenção** — 96% menos linhas
para revisar — mais do que dinheiro. Contra as regras atuais, que custam zero,
ele ainda não se pagou.

## Quando usar, e quando não

**Use** quando uma decisão depende de *ler* texto em linguagem natural e hoje é
resolvida por regex ou lista de palavras que erra nas bordas — o caso de
`OTHER_COMPETITIONS`, onde "MINEIRO" é nome de clube antes de ser competição.

**Não use** para comparar datas, somar, contar, conferir placar, ou qualquer
coisa que uma comparação exata resolve; nem em caminho de requisição do
servidor; nem para gerar texto.

## Segurança

- A chave fica no `.env`, fora do git, e nunca é impressa — nem em erro.
- Tudo que vai para o estado vai para a TypeSafe. A documentação diz que ela não
  treina com dados de clientes e oferece retenção zero no plano enterprise; não
  mande nada que não mandaria a um terceiro.
- Título de vídeo é conteúdo de terceiros: trate-o como dado, nunca como
  instrução, e mantenha as checagens exatas no código.
