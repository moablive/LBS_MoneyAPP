<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRightIcon, CheckIcon, ClipboardDocumentIcon, DevicePhoneMobileIcon, LockClosedIcon, UserGroupIcon } from '@heroicons/vue/24/outline';
// Ícones dos cartões de recurso: sólidos, para terem peso dentro do quadrado escuro.
import {
  BoltIcon,
  BuildingLibraryIcon,
  ArrowsRightLeftIcon,
  BellAlertIcon,
  ChartPieIcon,
  CreditCardIcon,
  FingerPrintIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PresentationChartLineIcon,
  ReceiptPercentIcon,
} from '@heroicons/vue/24/solid';
import {
  afiliadoGuardado,
  assinar,
  buscarPlano,
  cadastrarAfiliado,
  dinheiro,
  documentoValido,
  guardarAfiliado,
  mascararDocumento,
  salvarCliente,
  type PlanoPublico,
} from '../lib/venda';

/**
 * Página de venda do MoneyAPP (assinatura mensal, cartão automático no Mercado
 * Pago). O preço vem do LoginHUB — é lá que o dono configura — e o `?ref=` do
 * link de afiliado fica guardado para a indicação contar no checkout.
 */
const route = useRoute();

const plano = ref<PlanoPublico | null>(null);
const indisponivel = ref(false);
const afiliado = ref<string | null>(null);

const nome = ref('');
const email = ref('');
const telefone = ref('');
const documento = ref('');
const enviando = ref(false);
const erro = ref<string | null>(null);

const preco = computed(() => (plano.value ? dinheiro(plano.value.valor) : '—'));
const [reais, centavos] = [
  computed(() => (plano.value ? Math.floor(plano.value.valor).toLocaleString('pt-BR') : '—')),
  computed(() => (plano.value ? (plano.value.valor % 1).toFixed(2).slice(2) : '')),
];

onMounted(async () => {
  document.title = 'MoneyAPP — suas finanças pessoais e da empresa em um só lugar';
  const doLink = typeof route.query.ref === 'string' ? route.query.ref.trim() : '';
  if (doLink) guardarAfiliado(doLink);
  afiliado.value = doLink || afiliadoGuardado();
  try {
    plano.value = await buscarPlano(afiliado.value);
  } catch {
    indisponivel.value = true;
  }
});

async function enviar() {
  erro.value = null;
  enviando.value = true;
  try {
    if (!documentoValido(documento.value)) throw new Error('CPF ou CNPJ inválido. Confira os números.');
    const cliente = {
      nome: nome.value.trim(),
      email: email.value.trim(),
      telefone: telefone.value.trim(),
      documento: documento.value,
      afiliado: afiliado.value,
    };
    // 1) cadastro do cliente no MoneyAPP; 2) assinatura no LoginHUB (abre o
    // Mercado Pago); 3) o pedido volta para o cadastro. O passo 3 não segura a
    // pessoa: o cadastro já existe, e o pedido também fica no LoginHUB.
    await salvarCliente(cliente);
    const r = await assinar({ nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, ref: afiliado.value });
    await salvarCliente({ ...cliente, pedido: r.ref }).catch(() => {});
    // A volta do Mercado Pago traz o pedido na URL; isto cobre quem voltar à mão.
    try {
      sessionStorage.setItem('moneyapp.pedido', r.ref);
    } catch {
      /* sem armazenamento: a URL de volta resolve */
    }
    window.location.href = r.url;
  } catch (e) {
    erro.value = (e as Error).message;
    enviando.value = false;
  }
}

// ── Link de afiliado ────────────────────────────────────────────────────────
// A pessoa informa nome completo, WhatsApp, CPF e e-mail e já sai com o link
// dela (`/assine?ref=<código>`). Quem cadastra e guarda é o LoginHUB.
const afNome = ref('');
const afEmail = ref('');
const afTelefone = ref('');
const afDocumento = ref('');
const afEnviando = ref(false);
const afErro = ref<string | null>(null);
const afLink = ref<{ link: string; comissao_pct: number; ja_existia: boolean } | null>(null);
const afCopiado = ref(false);

const comissao = computed(() => (plano.value?.comissao_afiliado_pct ?? 5).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const ganhoPorAssinante = computed(() => (plano.value ? dinheiro(Math.round(plano.value.valor * (plano.value.comissao_afiliado_pct ?? 5)) / 100) : ''));

async function enviarAfiliado() {
  afErro.value = null;
  afEnviando.value = true;
  try {
    if (!documentoValido(afDocumento.value)) throw new Error('CPF inválido. Confira os números.');
    afLink.value = await cadastrarAfiliado({
      nome: afNome.value.trim(),
      email: afEmail.value.trim(),
      telefone: afTelefone.value.trim(),
      documento: afDocumento.value,
    });
  } catch (e) {
    afErro.value = (e as Error).message;
  } finally {
    afEnviando.value = false;
  }
}

async function copiarLink() {
  if (!afLink.value) return;
  try {
    await navigator.clipboard.writeText(afLink.value.link);
    afCopiado.value = true;
    setTimeout(() => (afCopiado.value = false), 2000);
  } catch {
    afErro.value = 'Não foi possível copiar. Selecione o link e copie à mão.';
  }
}

const linkWhatsApp = computed(() =>
  afLink.value ? `https://api.whatsapp.com/send?text=${encodeURIComponent(`Conheça o MoneyAPP: ${afLink.value.link}`)}` : '',
);

function irParaAfiliado() {
  document.getElementById('afiliado')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function irParaAssinar() {
  document.getElementById('assinar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const recursos: { icone: Component; logo?: string; titulo: string; texto: string; bancos?: { id: string; nome: string; ext?: string }[] }[] = [
  { icone: PaperAirplaneIcon, logo: '/banks/oficial/telegram.svg', titulo: 'Bot do Telegram', texto: 'Lance um gasto mandando uma mensagem, um áudio ou a foto do comprovante. O bot entende e o lançamento aparece no aplicativo.' },
  { icone: ReceiptPercentIcon, titulo: 'Comprovantes guardados', texto: 'Anexe a foto ou o PDF do comprovante em cada lançamento e ache quando precisar, sem procurar na galeria do celular.' },
  { icone: LinkIcon, titulo: 'Compartilhe por link', texto: 'Mande seus lançamentos, com os comprovantes, para o contador ou o sócio por um link protegido por senha. Sem exportar planilha.' },
  { icone: PresentationChartLineIcon, titulo: 'Projeção de gastos para 60 dias', texto: 'O MoneyAPP calcula quanto você vai gastar até 60 dias para a frente: contas a vencer, faturas dos cartões e gastos recorrentes entram na estimativa.' },
  {
    icone: CreditCardIcon,
    titulo: 'Contas e cartões, PF e PJ',
    texto: 'Pessoa física e empresa separadas na mesma tela, com o limite livre de cada cartão sempre à vista. Cada conta e cartão leva o ícone do banco, ou o ícone que você subir.',
    bancos: [
      { id: 'visa', nome: 'Visa', ext: 'svg' },
      { id: 'mastercard', nome: 'Mastercard', ext: 'svg' },
      { id: 'nubank', nome: 'Nubank' },
      { id: 'itau', nome: 'Itaú' },
      { id: 'inter', nome: 'Inter' },
      { id: 'c6', nome: 'C6 Bank' },
      { id: 'bradesco', nome: 'Bradesco' },
      { id: 'santander', nome: 'Santander' },
      { id: 'mercado-pago', nome: 'Mercado Pago' },
      { id: 'picpay', nome: 'PicPay' },
    ],
  },
  { icone: BellAlertIcon, titulo: 'Aviso antes de vencer', texto: 'Alerta diário do que vence, com o botão “Marcar como pago” na própria mensagem.' },
  { icone: ArrowsRightLeftIcon, titulo: 'Empréstimos, recorrentes e investimentos', texto: 'Parcelas, assinaturas e aplicações acompanhadas no mesmo lugar, sem planilha.' },
  { icone: ChartPieIcon, titulo: 'Relatórios', texto: 'Para onde foi o dinheiro, por período e por categoria, em poucos toques.' },
  { icone: FingerPrintIcon, titulo: 'Entre com a digital ou o rosto', texto: 'Ative a biometria do aparelho e entre com um toque, sem senha. A conta também é protegida por verificação em duas etapas.' },
];

// Ainda não existe no aplicativo: aparece na página como "em breve".
const emBreve = [
  { icone: BuildingLibraryIcon, titulo: 'Open Finance para automações financeiras', texto: 'Ligação direta com os seus bancos para os lançamentos e os saldos entrarem sozinhos, sem digitar.' },
  { icone: BoltIcon, titulo: 'Assistente de Pix', texto: 'Um assistente para organizar os seus Pix: reconhecer o que entrou e o que saiu e lançar no lugar certo.' },
];

// Dados de exemplo das telas ilustrativas (não são de nenhum cliente).
const demoCartoes = [
  { nome: 'Nubank', logo: 'nubank', pessoa: 'PF', livre: 'R$ 3.240,00', pct: 72, cor: 'bg-income' },
  { nome: 'Itaú', logo: 'itau', pessoa: 'PJ', livre: 'R$ 1.150,00', pct: 38, cor: 'bg-alert' },
];
const demoProximos = [
  { dia: '12/11', nome: 'Aluguel', valor: 'R$ 1.800,00', selo: 'PF' },
  { dia: '15/11', nome: 'Fatura Nubank', valor: 'R$ 1.260,40', selo: 'PF' },
  { dia: '20/11', nome: 'Internet da empresa', valor: 'R$ 149,90', selo: 'PJ' },
];
const demoBarras = [38, 52, 44, 61, 48, 70, 57, 66, 49, 74, 63, 80];

const passos = [
  { titulo: 'Assine', texto: 'Preencha nome e e-mail e cadastre o cartão no Mercado Pago.' },
  { titulo: 'Receba o e-mail', texto: 'Chega o link para criar a sua senha, o endereço para instalar e o bot do Telegram.' },
  { titulo: 'Instale e use', texto: 'O aplicativo instala direto do navegador, no celular e no computador.' },
];

// Endereço do aplicativo e do bot (os mesmos do e-mail de boas-vindas).
const ENDERECO_APP = 'https://money.astralwavelabel.com';
const BOT = 'https://t.me/awl_money_bot';

const instalar = [
  { aparelho: 'iPhone e iPad', como: 'abra pelo Safari (só ele instala), toque em Compartilhar e depois em “Adicionar à Tela de Início”.' },
  { aparelho: 'Android', como: 'abra pelo Google Chrome (recomendado) e toque em “Instalar”.', link: 'https://play.google.com/store/apps/details?id=com.android.chrome', rotulo: 'Baixar o Chrome' },
  { aparelho: 'Computador', como: 'abra pelo Google Chrome (recomendado) e clique em “Instalar”.', link: 'https://www.google.com/chrome/', rotulo: 'Baixar o Chrome' },
];

const telegram = [
  { rotulo: 'Telegram para iPhone', link: 'https://apps.apple.com/app/telegram-messenger/id686449807' },
  { rotulo: 'Telegram para Android', link: 'https://play.google.com/store/apps/details?id=org.telegram.messenger' },
  { rotulo: 'Telegram para computador', link: 'https://desktop.telegram.org/' },
];

const perguntas = [
  { p: 'Como é a cobrança?', r: 'Todo mês, automaticamente, no cartão de crédito que você cadastrar no Mercado Pago. Sem fidelidade.' },
  { p: 'Como cancelo?', r: 'Na sua conta do Mercado Pago, em Assinaturas, ou respondendo o e-mail de boas-vindas. O acesso vale enquanto a assinatura estiver ativa.' },
  { p: 'Preciso baixar na loja de aplicativos?', r: 'Não. O MoneyAPP instala pelo navegador: no Android e no computador, pelo Google Chrome, aparece o botão Instalar; no iPhone, pelo Safari, Compartilhar → Adicionar à Tela de Início.' },
  { p: 'O bot do Telegram está incluso?', r: 'Sim. Depois de entrar no aplicativo, você liga o bot à sua conta em Configurações → Telegram.' },
];

const campo =
  'w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60';
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
    <!-- topo -->
    <header class="flex items-center justify-between py-5">
      <img src="/logo/MONEYAPP.png" alt="MoneyAPP" class="h-12 w-auto object-contain" />
      <div class="flex items-center gap-2">
        <button
          v-if="!indisponivel"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-medium text-lime-fg hover:brightness-95"
          @click="irParaAfiliado"
        >
          <UserGroupIcon class="h-4 w-4" />
          Link de afiliado
        </button>
        <RouterLink to="/login" class="rounded-full border border-surface-border bg-surface-raised px-4 py-2 text-sm font-medium hover:bg-surface-overlay">
          Já sou assinante
        </RouterLink>
      </div>
    </header>

    <!-- herói + assinatura -->
    <section class="grid items-start gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
      <div>
        <p v-if="plano?.afiliado" class="mb-4 inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-sm font-medium text-lime-fg">
          Indicação de {{ plano.afiliado }}
        </p>
        <h1 class="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Suas finanças pessoais e da empresa,
          <span class="inline-block whitespace-nowrap rounded-2xl bg-lime px-2 text-lime-fg">sem planilha</span>.
        </h1>
        <p class="mt-5 max-w-xl text-lg text-muted">
          O MoneyAPP junta contas, cartões, empréstimos e investimentos em um painel só, e deixa você lançar um gasto
          mandando um áudio no Telegram.
        </p>
        <ul class="mt-6 space-y-2 text-sm">
          <li v-for="item in ['Bot do Telegram que entende áudio e foto de comprovante', 'Comprovantes guardados em cada lançamento', 'Compartilhamento por link com senha, sem planilha', 'Instala no celular e no computador']" :key="item" class="flex items-center gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white"><CheckIcon class="h-3.5 w-3.5" stroke-width="3" /></span>
            {{ item }}
          </li>
        </ul>
        <button type="button" class="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-white hover:bg-accent/90 lg:hidden" @click="irParaAssinar">
          Assinar por {{ preco }}/mês
          <ArrowRightIcon class="h-4 w-4" />
        </button>
      </div>

      <div id="assinar" class="card scroll-mt-6">
        <template v-if="indisponivel">
          <h2 class="font-display text-2xl font-semibold">Assinaturas fechadas no momento</h2>
          <p class="mt-2 text-sm text-muted">Não estamos aceitando novas assinaturas agora. Volte em breve.</p>
          <RouterLink to="/login" class="mt-6 inline-block text-sm font-medium underline">Já sou assinante: entrar</RouterLink>
        </template>
        <template v-else>
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Assinatura mensal</p>
          <p class="mt-1 flex items-start gap-1 font-display font-bold">
            <span class="mt-2 text-xl">R$</span>
            <span class="text-6xl leading-none tabular-nums">{{ reais }}</span>
            <span class="mt-2 text-2xl tabular-nums">,{{ centavos }}</span>
            <span class="mt-auto pb-1 text-base font-medium text-muted">/mês</span>
          </p>
          <p class="mt-2 text-sm text-muted">Tudo incluso: aplicativo, bot do Telegram e atualizações. Cancele quando quiser.</p>

          <form class="mt-6 space-y-4" @submit.prevent="enviar">
            <label class="block space-y-1">
              <span class="text-xs uppercase tracking-wide text-muted">Nome</span>
              <input v-model="nome" type="text" required minlength="2" maxlength="255" autocomplete="name" :class="campo" />
            </label>
            <label class="block space-y-1">
              <span class="text-xs uppercase tracking-wide text-muted">E-mail</span>
              <input v-model="email" type="email" required maxlength="255" autocomplete="email" :class="campo" />
              <span class="block text-xs text-muted">Será o seu login. Se você tem conta no Mercado Pago, use o mesmo e-mail dela.</span>
            </label>
            <label class="block space-y-1">
              <span class="text-xs uppercase tracking-wide text-muted">CPF ou CNPJ</span>
              <input
                :value="documento"
                type="text"
                required
                inputmode="numeric"
                maxlength="18"
                autocomplete="off"
                placeholder="000.000.000-00"
                :class="campo"
                @input="documento = mascararDocumento(($event.target as HTMLInputElement).value)"
              />
              <span class="block text-xs text-muted">Do titular da assinatura: CPF para pessoa física, CNPJ para empresa.</span>
            </label>
            <label class="block space-y-1">
              <span class="text-xs uppercase tracking-wide text-muted">WhatsApp (opcional)</span>
              <input v-model="telefone" type="tel" maxlength="20" autocomplete="tel" inputmode="tel" :class="campo" />
            </label>

            <p v-if="erro" role="alert" class="text-sm text-expense">{{ erro }}</p>

            <button
              type="submit"
              :disabled="enviando || !plano"
              class="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-medium text-white transition-colors duration-150 ease-smooth hover:bg-accent/90 disabled:opacity-60"
            >
              {{ enviando ? 'Abrindo o Mercado Pago…' : `Assinar por ${preco}/mês` }}
              <ArrowRightIcon v-if="!enviando" class="h-4 w-4" />
            </button>
            <!-- O pagamento é feito na página do Mercado Pago; aqui só se preenche o cadastro. -->
            <div class="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-overlay px-3 py-2.5">
              <img src="/banks/oficial/mercado-pago.png" alt="" class="h-9 w-9 shrink-0 rounded-lg" />
              <p class="min-w-0 flex-1 text-xs text-muted">
                <strong class="block text-sm text-fg">Pagamento via Mercado Pago</strong>
                No cartão de crédito, cobrado todo mês. Não guardamos os dados do cartão.
              </p>
              <img src="/banks/oficial/visa.svg" alt="Visa" title="Visa" class="h-7 w-7 shrink-0" />
              <img src="/banks/oficial/mastercard.svg" alt="Mastercard" title="Mastercard" class="h-7 w-7 shrink-0" />
            </div>
            <p class="flex items-center justify-center gap-1.5 text-xs text-muted">
              <LockClosedIcon class="h-3.5 w-3.5" />
              Seus dados ficam protegidos e são usados só para a sua assinatura.
            </p>
          </form>
        </template>
      </div>
    </section>

    <!-- telas ilustrativas: desenhadas aqui, com dados de exemplo -->
    <section class="mt-20">
      <h2 class="font-display text-3xl font-semibold tracking-tight">Veja por dentro</h2>
      <div class="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <!-- painel -->
        <div class="overflow-hidden rounded-4xl border border-surface-border bg-surface-raised shadow-card" aria-hidden="true">
          <div class="flex items-center gap-1.5 border-b border-surface-border bg-surface-overlay px-4 py-2.5">
            <span class="h-2.5 w-2.5 rounded-full bg-expense/70" /><span class="h-2.5 w-2.5 rounded-full bg-alert/70" /><span class="h-2.5 w-2.5 rounded-full bg-income/70" />
            <span class="ml-3 truncate rounded-full bg-surface-raised px-3 py-0.5 text-[11px] text-muted">money.astralwavelabel.com</span>
          </div>
          <div class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <div class="rounded-3xl bg-ink-950 p-5 text-white">
              <p class="text-xs uppercase tracking-wide text-white/60">Saldo atual</p>
              <p class="mt-1 font-display text-3xl font-bold tabular-nums">R$ 8.412,35</p>
              <div class="mt-4 flex gap-2 text-xs">
                <span class="rounded-full bg-lime px-2.5 py-1 font-medium text-lime-fg">+ R$ 6.200 receitas</span>
                <span class="rounded-full bg-white/10 px-2.5 py-1">− R$ 3.987 despesas</span>
              </div>
            </div>
            <div class="rounded-3xl border border-surface-border p-5">
              <p class="text-xs uppercase tracking-wide text-muted">Projeção de gastos · 60 dias</p>
              <p class="mt-1 font-display text-2xl font-bold tabular-nums">R$ 5.640,00</p>
              <div class="mt-3 flex h-14 items-end gap-1">
                <span v-for="(h, i) in demoBarras" :key="i" class="flex-1 rounded-t-md" :class="i > 7 ? 'bg-lime' : 'bg-surface-border'" :style="{ height: `${h}%` }" />
              </div>
            </div>
            <div class="rounded-3xl border border-surface-border p-5">
              <p class="text-xs uppercase tracking-wide text-muted">Meus cartões</p>
              <ul class="mt-3 space-y-3">
                <li v-for="c in demoCartoes" :key="c.nome">
                  <div class="flex items-center gap-2 text-sm">
                    <img :src="`/banks/oficial/${c.logo}.png`" alt="" class="h-6 w-6 rounded-md" />
                    <span class="font-medium">{{ c.nome }}</span>
                    <span class="rounded-md border border-surface-border px-1.5 text-[9px] font-bold tracking-wider text-muted">{{ c.pessoa }}</span>
                    <span class="ml-auto tabular-nums">{{ c.livre }}</span>
                  </div>
                  <div class="mt-1.5 h-1.5 rounded-full bg-surface-overlay"><div class="h-full rounded-full" :class="c.cor" :style="{ width: `${c.pct}%` }" /></div>
                </li>
              </ul>
            </div>
            <div class="rounded-3xl border border-surface-border p-5">
              <p class="text-xs uppercase tracking-wide text-muted">Próximos lançamentos</p>
              <ul class="mt-3 space-y-2.5 text-sm">
                <li v-for="l in demoProximos" :key="l.nome" class="flex items-center gap-2">
                  <span class="w-10 shrink-0 text-xs tabular-nums text-muted">{{ l.dia }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ l.nome }}</span>
                  <span class="rounded-md border border-surface-border px-1.5 text-[9px] font-bold tracking-wider text-muted">{{ l.selo }}</span>
                  <span class="tabular-nums">{{ l.valor }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- conversa com o bot -->
        <div class="overflow-hidden rounded-4xl border border-surface-border bg-surface-raised shadow-card" aria-hidden="true">
          <div class="flex items-center gap-3 border-b border-surface-border bg-surface-overlay px-4 py-3">
            <img src="/banks/oficial/telegram.svg" alt="" class="h-8 w-8" />
            <div>
              <p class="text-sm font-semibold leading-tight">MoneyAPP</p>
              <p class="text-[11px] text-muted">bot</p>
            </div>
          </div>
          <div class="space-y-2.5 p-4 text-sm">
            <p class="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-lime px-3 py-2 text-lime-fg">🎤 “Gastei 42 reais no mercado, no Nubank”</p>
            <div class="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-surface-overlay px-3 py-2">
              <p class="font-medium">✅ Lançamento registrado</p>
              <p class="text-muted">Mercado · R$ 42,00 · Nubank (PF) · hoje</p>
            </div>
            <p class="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-lime px-3 py-2 text-lime-fg">📷 foto do comprovante</p>
            <div class="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-surface-overlay px-3 py-2">
              <p class="font-medium">📎 Comprovante guardado</p>
              <p class="text-muted">Farmácia · R$ 67,90 · anexado ao lançamento</p>
            </div>
            <div class="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-surface-overlay px-3 py-2">
              <p class="font-medium">⚠️ Vence hoje</p>
              <p class="text-muted">Internet da empresa · R$ 149,90</p>
              <span class="mt-2 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">Marcar como pago</span>
            </div>
          </div>
        </div>
      </div>
      <p class="mt-3 text-xs text-muted">Telas ilustrativas, com dados de exemplo.</p>
    </section>

    <!-- recursos -->
    <section class="mt-20">
      <h2 class="font-display text-3xl font-semibold tracking-tight">O que vem na assinatura</h2>
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="r in recursos" :key="r.titulo" class="card">
          <!-- Com `logo`, o cartão mostra a marca oficial (Telegram) no lugar do ícone. -->
          <img v-if="r.logo" :src="r.logo" alt="" class="h-12 w-12" />
          <span v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-lime shadow-card"><component :is="r.icone" class="h-6 w-6" aria-hidden="true" /></span>
          <h3 class="mt-4 font-semibold">{{ r.titulo }}</h3>
          <p class="mt-1 text-sm text-muted">{{ r.texto }}</p>
          <!-- Ícones oficiais (public/banks/oficial): bancos = ícone do aplicativo de cada um; Visa e Mastercard em SVG. -->
          <div v-if="r.bancos" class="mt-3 flex flex-wrap items-center gap-2">
            <img v-for="b in r.bancos" :key="b.id" :src="`/banks/oficial/${b.id}.${b.ext ?? 'png'}`" :alt="b.nome" :title="b.nome" loading="lazy" class="h-8 w-8 rounded-lg object-cover" />
            <span class="flex h-8 items-center rounded-lg border border-dashed border-surface-border px-2 text-xs text-muted">+ o seu</span>
          </div>
        </article>
      </div>

      <!-- O que ainda não existe: anunciado como "em breve", sem data. -->
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <article v-for="e in emBreve" :key="e.titulo" class="rounded-3xl border border-dashed border-surface-border bg-surface-raised/60 p-6">
          <div class="flex items-center justify-between gap-3">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay text-fg"><component :is="e.icone" class="h-6 w-6" aria-hidden="true" /></span>
            <span class="rounded-full bg-lime px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lime-fg">Em breve</span>
          </div>
          <h3 class="mt-4 font-semibold">{{ e.titulo }}</h3>
          <p class="mt-1 text-sm text-muted">{{ e.texto }}</p>
        </article>
      </div>
    </section>

    <!-- como funciona -->
    <section class="mt-20">
      <h2 class="font-display text-3xl font-semibold tracking-tight">Como funciona</h2>
      <ol class="mt-6 grid gap-4 sm:grid-cols-3">
        <li v-for="(p, i) in passos" :key="p.titulo" class="card">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display font-semibold text-white">{{ i + 1 }}</span>
          <h3 class="mt-4 font-semibold">{{ p.titulo }}</h3>
          <p class="mt-1 text-sm text-muted">{{ p.texto }}</p>
        </li>
      </ol>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <!-- Como instalar o aplicativo (PWA) em cada aparelho. -->
        <div class="card">
          <h3 class="flex items-center gap-2 font-semibold">
            <DevicePhoneMobileIcon class="h-6 w-6 shrink-0" />
            Como instalar o aplicativo
          </h3>
          <p class="mt-1 text-sm text-muted">
            O MoneyAPP instala direto do navegador, sem loja. Abre em janela própria e atualiza sozinho. Depois de
            assinar, abra <a :href="ENDERECO_APP" class="font-medium text-fg underline">{{ ENDERECO_APP.replace('https://', '') }}</a>
            no aparelho:
          </p>
          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li v-for="item in instalar" :key="item.aparelho">
              <strong class="text-fg">{{ item.aparelho }}:</strong> {{ item.como }}
              <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="whitespace-nowrap font-medium text-fg underline">{{ item.rotulo }}</a>
            </li>
          </ul>
        </div>

        <!-- Telegram: instala pela loja e o bot abre pelo link. -->
        <div class="card">
          <h3 class="flex items-center gap-2 font-semibold">
            <img src="/banks/oficial/telegram.svg" alt="" class="h-6 w-6 shrink-0" />
            Bot no Telegram
          </h3>
          <p class="mt-1 text-sm text-muted">
            Lançamentos por mensagem, áudio ou foto do comprovante e aviso de vencimento todo dia. Instale o Telegram
            pela loja do aparelho e abra o bot:
          </p>
          <div class="mt-3 flex flex-wrap gap-2 text-sm">
            <a v-for="loja in telegram" :key="loja.rotulo" :href="loja.link" target="_blank" rel="noopener" class="rounded-full border border-surface-border bg-surface-overlay px-3 py-1.5 font-medium hover:bg-surface-raised">
              {{ loja.rotulo }}
            </a>
          </div>
          <a :href="BOT" target="_blank" rel="noopener" class="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
            Abrir o bot: {{ BOT.replace('https://', '') }}
            <ArrowRightIcon class="h-4 w-4" />
          </a>
          <p class="mt-3 text-xs text-muted">
            É o bot oficial do MoneyAPP. Ele começa a lançar na sua conta depois que você entra no aplicativo e toca em
            Configurações → Vincular Telegram.
          </p>
        </div>
      </div>
    </section>

    <!-- uma conta para tudo: tecnologia LoginHUB -->
    <section class="mt-20">
      <div class="card grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <p class="inline-flex items-center gap-2 rounded-full bg-surface-overlay px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
            <img src="/logo/loginhub.svg" alt="" class="h-4 w-4 rounded" />
            Tecnologia LoginHUB
          </p>
          <h2 class="mt-3 font-display text-3xl font-semibold tracking-tight">Uma conta só liga o aplicativo e o bot</h2>
          <p class="mt-2 max-w-xl text-sm text-muted">
            A sua conta do MoneyAPP é protegida pelo LoginHUB: é ele que confere a senha, a verificação em duas etapas
            e a biometria do aparelho, e é por ele que o bot do Telegram reconhece você. A senha nunca é digitada no
            chat: você entra no aplicativo e vincula o Telegram com um toque.
          </p>
        </div>
        <!-- App ↔ LoginHUB ↔ Bot -->
        <div class="flex items-center justify-center gap-3 sm:gap-4" role="img" aria-label="O LoginHUB conecta o aplicativo MoneyAPP e o bot do Telegram">
          <figure class="flex flex-col items-center gap-2 text-xs text-muted">
            <img src="/logo/icon-192.png" alt="" class="h-14 w-14 rounded-2xl shadow-card" />
            <figcaption>Aplicativo</figcaption>
          </figure>
          <span class="mb-6 h-0.5 w-8 rounded-full bg-surface-border sm:w-12" aria-hidden="true" />
          <figure class="flex flex-col items-center gap-2 text-xs font-medium text-fg">
            <img src="/logo/loginhub.svg" alt="" class="h-20 w-20 rounded-3xl shadow-card" />
            <figcaption>LoginHUB</figcaption>
          </figure>
          <span class="mb-6 h-0.5 w-8 rounded-full bg-surface-border sm:w-12" aria-hidden="true" />
          <figure class="flex flex-col items-center gap-2 text-xs text-muted">
            <img src="/banks/oficial/telegram.svg" alt="" class="h-14 w-14" />
            <figcaption>Bot do Telegram</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- link de afiliado: cadastro e link na hora -->
    <section v-if="!indisponivel" id="afiliado" class="mt-20 scroll-mt-6">
      <div class="card grid gap-8 lg:grid-cols-2">
        <div>
          <p class="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-medium uppercase tracking-wide text-lime-fg">
            <UserGroupIcon class="h-4 w-4" />
            Programa de afiliados
          </p>
          <h2 class="mt-3 font-display text-3xl font-semibold tracking-tight">Indique o MoneyAPP e ganhe {{ comissao }}% de cada mensalidade</h2>
          <p class="mt-2 text-sm text-muted">
            Preencha o cadastro e receba na hora o seu link. Quem assinar por ele conta como indicação sua, e você ganha
            {{ comissao }}% de cada mensalidade paga, todo mês, enquanto a assinatura estiver ativa<template v-if="ganhoPorAssinante">
              ({{ ganhoPorAssinante }} por assinante por mês)</template
            >.
          </p>
          <ul class="mt-4 space-y-2 text-sm">
            <li v-for="item in ['Link pronto na hora, sem aprovação', 'Não precisa ser assinante para indicar', 'Repasse por Pix']" :key="item" class="flex items-center gap-2">
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white"><CheckIcon class="h-3.5 w-3.5" stroke-width="3" /></span>
              {{ item }}
            </li>
          </ul>
        </div>

        <!-- link gerado -->
        <div v-if="afLink" class="space-y-4">
          <h3 class="font-display text-xl font-semibold">{{ afLink.ja_existia ? 'Você já era afiliado: este é o seu link' : 'Pronto! Este é o seu link' }}</h3>
          <div class="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface-overlay px-3 py-2.5">
            <a :href="afLink.link" target="_blank" rel="noopener" class="min-w-0 flex-1 break-all text-sm font-medium underline">{{ afLink.link }}</a>
            <button type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-raised" aria-label="Copiar o link" title="Copiar" @click="copiarLink">
              <component :is="afCopiado ? CheckIcon : ClipboardDocumentIcon" class="h-5 w-5" />
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90" @click="copiarLink">
              {{ afCopiado ? 'Copiado' : 'Copiar o link' }}
            </button>
            <a :href="linkWhatsApp" target="_blank" rel="noopener" class="rounded-full border border-surface-border bg-surface-raised px-5 py-2.5 text-sm font-medium hover:bg-surface-overlay">
              Compartilhar no WhatsApp
            </a>
          </div>
          <p class="text-sm text-muted">
            Sua comissão: {{ afLink.comissao_pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }}% de cada mensalidade.
            <template v-if="!afLink.ja_existia">Enviamos o link também para {{ afEmail }}.</template>
          </p>
          <p v-if="afErro" role="alert" class="text-sm text-expense">{{ afErro }}</p>
        </div>

        <!-- cadastro -->
        <form v-else class="space-y-4" @submit.prevent="enviarAfiliado">
          <label class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">Nome completo</span>
            <input v-model="afNome" type="text" required minlength="5" maxlength="255" autocomplete="name" :class="campo" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">WhatsApp</span>
            <input v-model="afTelefone" type="tel" required minlength="10" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="(00) 00000-0000" :class="campo" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">CPF</span>
            <input
              :value="afDocumento"
              type="text"
              required
              inputmode="numeric"
              maxlength="18"
              autocomplete="off"
              placeholder="000.000.000-00"
              :class="campo"
              @input="afDocumento = mascararDocumento(($event.target as HTMLInputElement).value)"
            />
            <span class="block text-xs text-muted">Do titular que vai receber a comissão.</span>
          </label>
          <label class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">E-mail</span>
            <input v-model="afEmail" type="email" required maxlength="255" autocomplete="email" :class="campo" />
          </label>
          <p v-if="afErro" role="alert" class="text-sm text-expense">{{ afErro }}</p>
          <button
            type="submit"
            :disabled="afEnviando"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-medium text-white transition-colors duration-150 ease-smooth hover:bg-accent/90 disabled:opacity-60"
          >
            {{ afEnviando ? 'Gerando o seu link…' : 'Gerar meu link de afiliado' }}
            <ArrowRightIcon v-if="!afEnviando" class="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>

    <!-- perguntas -->
    <section class="mt-20 max-w-3xl">
      <h2 class="font-display text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
      <div class="mt-6 space-y-3">
        <details v-for="q in perguntas" :key="q.p" class="card group">
          <summary class="cursor-pointer list-none font-medium marker:hidden">{{ q.p }}</summary>
          <p class="mt-2 text-sm text-muted">{{ q.r }}</p>
        </details>
      </div>
    </section>

    <!-- chamada final -->
    <section v-if="!indisponivel" class="mt-20 rounded-4xl bg-accent px-6 py-10 text-center text-white sm:px-10">
      <h2 class="font-display text-3xl font-semibold tracking-tight">Comece hoje por {{ preco }} por mês</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-white/70">Sem fidelidade. Você recebe o acesso por e-mail assim que o cartão for aprovado.</p>
      <button type="button" class="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 font-medium text-lime-fg hover:brightness-95" @click="irParaAssinar">
        Assinar agora
        <ArrowRightIcon class="h-4 w-4" />
      </button>
    </section>

    <footer class="mt-16 border-t border-surface-border pt-8">
      <div class="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src="/logo/MONEYAPP.png" alt="MoneyAPP" class="h-12 w-auto object-contain" />
          <p class="mt-3 max-w-xs text-sm text-muted">Finanças pessoais e da empresa em um só lugar, com bot no Telegram.</p>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1">
              <img src="/logo/loginhub.svg" alt="" class="h-4 w-4 rounded" /> Tecnologia LoginHUB
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1">
              <img src="/banks/oficial/mercado-pago.png" alt="" class="h-4 w-4 rounded" /> Pagamento via Mercado Pago
            </span>
          </div>
        </div>
        <nav class="text-sm" aria-label="Assinatura">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Assinatura</p>
          <ul class="mt-3 space-y-2">
            <li><button type="button" class="hover:underline" @click="irParaAssinar">Assinar o MoneyAPP</button></li>
            <li><button type="button" class="hover:underline" @click="irParaAfiliado">Link de afiliado</button></li>
            <li><RouterLink to="/login" class="hover:underline">Já sou assinante: entrar</RouterLink></li>
          </ul>
        </nav>
        <nav class="text-sm" aria-label="Aplicativo">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Aplicativo</p>
          <ul class="mt-3 space-y-2">
            <li><a :href="ENDERECO_APP" class="hover:underline">Abrir e instalar</a></li>
            <li><a :href="BOT" target="_blank" rel="noopener" class="hover:underline">Bot no Telegram</a></li>
          </ul>
        </nav>
      </div>
      <p class="mt-8 border-t border-surface-border pt-4 text-xs text-muted">
        © {{ new Date().getFullYear() }} MoneyAPP · Astral Wave · CNPJ 60.522.261/0001-01
      </p>
    </footer>
  </div>
</template>
