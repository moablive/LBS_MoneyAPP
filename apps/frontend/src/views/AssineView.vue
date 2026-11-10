<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRightIcon, ChatBubbleLeftRightIcon, CheckIcon, DevicePhoneMobileIcon, LockClosedIcon } from '@heroicons/vue/24/outline';
// Ícones dos cartões de recurso: sólidos, para terem peso dentro do quadrado escuro.
import {
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
import { afiliadoGuardado, assinar, buscarPlano, dinheiro, guardarAfiliado, type PlanoPublico } from '../lib/venda';

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
    const r = await assinar({ nome: nome.value.trim(), email: email.value.trim(), telefone: telefone.value.trim(), ref: afiliado.value });
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

function irParaAssinar() {
  document.getElementById('assinar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const recursos: { icone: Component; giro?: string; titulo: string; texto: string; bancos?: string[] }[] = [
  { icone: PaperAirplaneIcon, giro: '-rotate-45 translate-x-0.5', titulo: 'Bot do Telegram', texto: 'Lance um gasto mandando uma mensagem, um áudio ou a foto do comprovante. O bot entende e o lançamento aparece no aplicativo.' },
  { icone: ReceiptPercentIcon, titulo: 'Comprovantes guardados', texto: 'Anexe a foto ou o PDF do comprovante em cada lançamento e ache quando precisar, sem procurar na galeria do celular.' },
  { icone: LinkIcon, titulo: 'Compartilhe por link', texto: 'Mande seus lançamentos, com os comprovantes, para o contador ou o sócio por um link protegido por senha. Sem exportar planilha.' },
  { icone: PresentationChartLineIcon, titulo: 'Painel com projeção de 60 dias', texto: 'Saldo de hoje e o que vem pela frente: contas a vencer, faturas e recorrentes já entram na conta.' },
  {
    icone: CreditCardIcon,
    titulo: 'Contas e cartões, PF e PJ',
    texto: 'Pessoa física e empresa separadas na mesma tela, com o limite livre de cada cartão sempre à vista. Cada conta e cartão leva o ícone do banco, ou o ícone que você subir.',
    bancos: ['visa', 'mastercard', 'nubank', 'itau', 'inter', 'c6', 'bradesco', 'santander', 'mercado-pago', 'picpay'],
  },
  { icone: BellAlertIcon, titulo: 'Aviso antes de vencer', texto: 'Alerta diário do que vence, com o botão “Marcar como pago” na própria mensagem.' },
  { icone: ArrowsRightLeftIcon, titulo: 'Empréstimos, recorrentes e investimentos', texto: 'Parcelas, assinaturas e aplicações acompanhadas no mesmo lugar, sem planilha.' },
  { icone: ChartPieIcon, titulo: 'Relatórios', texto: 'Para onde foi o dinheiro, por período e por categoria, em poucos toques.' },
  { icone: FingerPrintIcon, titulo: 'Protegido em duas etapas', texto: 'Login com verificação pelo Google Authenticator. Seus dados não ficam atrás só de uma senha.' },
];

const passos = [
  { titulo: 'Assine', texto: 'Preencha nome e e-mail e cadastre o cartão no Mercado Pago.' },
  { titulo: 'Receba o e-mail', texto: 'Chega o link para criar a sua senha, o endereço para instalar e o bot do Telegram.' },
  { titulo: 'Instale e use', texto: 'O aplicativo instala direto do navegador, no celular e no computador.' },
];

const perguntas = [
  { p: 'Como é a cobrança?', r: 'Todo mês, automaticamente, no cartão de crédito que você cadastrar no Mercado Pago. Sem fidelidade.' },
  { p: 'Como cancelo?', r: 'Na sua conta do Mercado Pago, em Assinaturas, ou respondendo o e-mail de boas-vindas. O acesso vale enquanto a assinatura estiver ativa.' },
  { p: 'Preciso baixar na loja de aplicativos?', r: 'Não. O MoneyAPP instala pelo navegador: no Android e no computador aparece o botão Instalar; no iPhone, Compartilhar → Adicionar à Tela de Início.' },
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
      <RouterLink to="/login" class="rounded-full border border-surface-border bg-surface-raised px-4 py-2 text-sm font-medium hover:bg-surface-overlay">
        Já sou assinante
      </RouterLink>
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
            <p class="flex items-center justify-center gap-1.5 text-xs text-muted">
              <LockClosedIcon class="h-3.5 w-3.5" />
              Pagamento no cartão pelo Mercado Pago. Não guardamos os dados do cartão.
            </p>
            <p class="flex items-center justify-center gap-2">
              <img src="/banks/visa.svg" alt="Visa" class="h-7 w-7 rounded-lg" />
              <img src="/banks/mastercard.svg" alt="Mastercard" class="h-7 w-7 rounded-lg" />
            </p>
          </form>
        </template>
      </div>
    </section>

    <!-- recursos -->
    <section class="mt-20">
      <h2 class="font-display text-3xl font-semibold tracking-tight">O que vem na assinatura</h2>
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="r in recursos" :key="r.titulo" class="card">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950 text-lime shadow-card"><component :is="r.icone" class="h-6 w-6" :class="r.giro" aria-hidden="true" /></span>
          <h3 class="mt-4 font-semibold">{{ r.titulo }}</h3>
          <p class="mt-1 text-sm text-muted">{{ r.texto }}</p>
          <!-- Os mesmos ícones de banco que o aplicativo oferece ao criar a conta (public/banks). -->
          <div v-if="r.bancos" class="mt-3 flex flex-wrap items-center gap-2">
            <img v-for="b in r.bancos" :key="b" :src="`/banks/${b}.svg`" :alt="b" loading="lazy" class="h-7 w-7 rounded-lg object-contain" />
            <span class="flex h-7 items-center rounded-lg border border-dashed border-surface-border px-2 text-xs text-muted">+ o seu</span>
          </div>
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
        <div class="card flex items-start gap-3">
          <DevicePhoneMobileIcon class="h-6 w-6 shrink-0" />
          <p class="text-sm text-muted"><strong class="text-fg">Aplicativo instalável.</strong> Abre em janela própria, como aplicativo da loja, e atualiza sozinho.</p>
        </div>
        <div class="card flex items-start gap-3">
          <ChatBubbleLeftRightIcon class="h-6 w-6 shrink-0" />
          <p class="text-sm text-muted"><strong class="text-fg">Bot no Telegram.</strong> Lançamentos por mensagem, áudio ou foto e avisos de vencimento todo dia.</p>
        </div>
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

    <footer class="mt-12 text-center text-xs text-muted">
      MoneyAPP · Astral Wave · <RouterLink to="/login" class="underline">Entrar</RouterLink>
    </footer>
  </div>
</template>
