import { BACK_LINK, LINK_UNDERLINE } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";

/**
 * `/privacidade` — what the app stores about a reader, and what they can do
 * about it.
 *
 * **Public and indexable**, unlike `/conta` and `/entrar`. A privacy notice
 * that only a signed-in reader can find is not a notice: the point is to be
 * readable *before* deciding, and Google's consent screen links to it from
 * outside this site entirely.
 *
 * Written to be true of this build rather than to be legally decorative. Every
 * claim here is checkable against the code — `docs/accounts.md` §5 is the
 * argument, and the wording follows the schema in `account-store.ts` field by
 * field. If a column is added there, this page is wrong until it is edited.
 */
export function PrivacyView({ onBack }: { onBack: () => void }) {
  return (
    <section aria-labelledby="privacidade-titulo" className="max-w-prose">
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <h2 id="privacidade-titulo" className="mt-3 text-title-large font-bold">
        Privacidade
      </h2>

      <p className="mt-2 text-body-medium text-ink-muted">
        O Portal Brasileirão funciona inteiro sem conta. Esta página vale para
        quem decide criar uma.
      </p>

      <Surface filled className="mt-4 px-4 py-3">
        <h3 className="text-body-large font-semibold">Sem conta, nada é guardado</h3>
        <p className="mt-1 text-body-medium text-ink-muted">
          Navegar pela tabela, pelos jogos, pelos elencos e pelos estádios não
          guarda nada sobre você em nenhum servidor. O time que você segue e o
          tema claro ou escuro ficam apenas no seu próprio aparelho, no
          armazenamento do navegador, e some se você limpar os dados do site.
        </p>
      </Surface>

      <h3 className="mt-6 text-body-large font-semibold">O que guardamos com conta</h3>
      <p className="mt-1 text-body-medium text-ink-muted">Quatro coisas, e só:</p>
      <ul className="mt-2 space-y-1 text-body-medium text-ink-muted">
        <li>• O seu nome, como o Google o informa.</li>
        <li>• Um identificador do Google, para reconhecer você na próxima vez.</li>
        <li>• O time que você segue.</li>
        <li>• A página em que o Portal abre para você.</li>
      </ul>
      <p className="mt-2 text-body-medium text-ink-muted">
        Guardamos também um registro de cada aparelho conectado, para que
        &ldquo;sair de todos os aparelhos&rdquo; funcione. Não guardamos o seu
        e-mail, não guardamos foto, e não guardamos nenhum registro do que você
        lê no site.
      </p>

      <h3 className="mt-6 text-body-large font-semibold">Por quê</h3>
      <p className="mt-1 text-body-medium text-ink-muted">
        Para guardar as suas preferências e o seu time entre aparelhos, que é o
        serviço que você pediu ao entrar. Não usamos nada disso para publicidade
        e não vendemos nem compartilhamos com ninguém.
      </p>

      <h3 className="mt-6 text-body-large font-semibold">Quem mais vê</h3>
      <p className="mt-1 text-body-medium text-ink-muted">
        A <strong>Amazon Web Services</strong> hospeda o site, e portanto o
        servidor onde esses dados ficam. O <strong>Google</strong> faz a entrada:
        ao escolher entrar, você é levado a uma página do Google, que fica com o
        registro dessa entrada segundo as políticas dele. É uma transferência de
        dados para fora do Brasil, e é bom saber disso antes de decidir.
      </p>

      <h3 className="mt-6 text-body-large font-semibold">Cookies</h3>
      <p className="mt-1 text-body-medium text-ink-muted">
        Um só, e apenas depois de você entrar: o que mantém a sua sessão. Não há
        cookie de publicidade, de medição ou de terceiros, e por isso também não
        há aquele aviso de cookies para você clicar. O tema e o time ficam no
        armazenamento do navegador, que não é enviado a servidor nenhum.
      </p>

      <h3 className="mt-6 text-body-large font-semibold">Apagar</h3>
      <p className="mt-1 text-body-medium text-ink-muted">
        Em{" "}
        <a href="/conta" className={LINK_UNDERLINE}>
          Minha conta
        </a>{" "}
        há um botão que apaga a conta na hora — a conta, as sessões, o time que
        você segue e a sua página inicial, tudo de uma vez, sem pedido e sem
        espera. O que você vê nessa
        página é tudo o que temos, então ela também serve como o seu acesso aos
        dados.
      </p>

      <h3 className="mt-6 text-body-large font-semibold">Falar com a gente</h3>
      <p className="mt-1 text-body-medium text-ink-muted">
        Este é um projeto independente, sem vínculo com a CBF ou com os clubes.
        Para qualquer questão sobre os seus dados, abra uma issue no{" "}
        <a
          href="https://github.com/mpbarbosa/portal_brasileirao/issues"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_UNDERLINE}
        >
          repositório do projeto
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        .
      </p>
    </section>
  );
}
