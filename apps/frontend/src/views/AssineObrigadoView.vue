<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { consultarPedido, type StatusAssinatura } from '../lib/venda';

/**
 * Volta do Mercado Pago. O cartão pode levar alguns segundos para ser
 * autorizado, então a página pergunta ao LoginHUB de 4 em 4 segundos (por até
 * 2 minutos) se a assinatura já está ativa — é essa consulta que faz o LoginHUB
 * conferir no Mercado Pago e disparar o e-mail de acesso.
 */
const route = useRoute();

const estado = ref<'conferindo' | 'ativa' | 'aguardando' | 'recusada' | 'sem-pedido'>('conferindo');
const email = ref('');

const INTERVALO_MS = 4000;
const TENTATIVAS = 30;
let tentativas = 0;
let relogio: ReturnType<typeof setTimeout> | null = null;

function pedidoDaVolta(): string {
  const daUrl = typeof route.query.pedido === 'string' ? route.query.pedido : '';
  if (daUrl) return daUrl;
  try {
    return sessionStorage.getItem('moneyapp.pedido') || '';
  } catch {
    return '';
  }
}

async function conferir(pedido: string) {
  tentativas += 1;
  let status: StatusAssinatura | null = null;
  try {
    const r = await consultarPedido(pedido);
    status = r.status;
    email.value = r.email;
  } catch (e) {
    if ((e as { status?: number }).status === 404) {
      estado.value = 'sem-pedido';
      return;
    }
  }
  if (status === 'ativa') {
    estado.value = 'ativa';
    return;
  }
  if (status === 'cancelada' || status === 'pausada') {
    estado.value = 'recusada';
    return;
  }
  if (tentativas >= TENTATIVAS) {
    estado.value = 'aguardando';
    return;
  }
  relogio = setTimeout(() => void conferir(pedido), INTERVALO_MS);
}

onMounted(() => {
  document.title = 'MoneyAPP — assinatura';
  const pedido = pedidoDaVolta();
  if (!pedido) {
    estado.value = 'sem-pedido';
    return;
  }
  void conferir(pedido);
});

onBeforeUnmount(() => {
  if (relogio) clearTimeout(relogio);
});
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center p-6">
    <div class="card w-full max-w-md text-center">
      <img src="/logo/MONEYAPP.png" alt="MoneyAPP" class="mx-auto h-20 w-auto object-contain" />

      <template v-if="estado === 'conferindo'">
        <ClockIcon class="mx-auto mt-6 h-10 w-10 animate-pulse text-muted" />
        <h1 class="mt-3 font-display text-2xl font-semibold">Confirmando o pagamento…</h1>
        <p class="mt-2 text-sm text-muted">Estamos conferindo o cartão com o Mercado Pago. Leva alguns segundos; não feche esta página.</p>
      </template>

      <template v-else-if="estado === 'ativa'">
        <CheckCircleIcon class="mx-auto mt-6 h-12 w-12 text-income" />
        <h1 class="mt-3 font-display text-2xl font-semibold">Assinatura ativa</h1>
        <p class="mt-2 text-sm text-muted">
          Enviamos para <strong class="text-fg">{{ email }}</strong> o link para criar a sua senha, o endereço para instalar o
          aplicativo e o bot do Telegram. Se não achar, olhe a caixa de spam.
        </p>
        <RouterLink to="/login" class="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-medium text-white hover:bg-accent/90">Ir para o login</RouterLink>
      </template>

      <template v-else-if="estado === 'aguardando'">
        <ClockIcon class="mx-auto mt-6 h-10 w-10 text-alert" />
        <h1 class="mt-3 font-display text-2xl font-semibold">Pagamento em análise</h1>
        <p class="mt-2 text-sm text-muted">
          O Mercado Pago ainda não confirmou o cartão. Assim que confirmar, o e-mail de acesso chega em
          <strong class="text-fg">{{ email || 'seu e-mail' }}</strong> sozinho. Pode fechar esta página.
        </p>
      </template>

      <template v-else-if="estado === 'recusada'">
        <ExclamationTriangleIcon class="mx-auto mt-6 h-10 w-10 text-expense" />
        <h1 class="mt-3 font-display text-2xl font-semibold">A assinatura não foi concluída</h1>
        <p class="mt-2 text-sm text-muted">O pagamento não foi aprovado ou a assinatura foi cancelada. Você pode tentar de novo com outro cartão.</p>
        <RouterLink to="/assine" class="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-medium text-white hover:bg-accent/90">Tentar de novo</RouterLink>
      </template>

      <template v-else>
        <ExclamationTriangleIcon class="mx-auto mt-6 h-10 w-10 text-muted" />
        <h1 class="mt-3 font-display text-2xl font-semibold">Pedido não encontrado</h1>
        <p class="mt-2 text-sm text-muted">Não achamos uma assinatura em andamento neste navegador.</p>
        <RouterLink to="/assine" class="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-medium text-white hover:bg-accent/90">Ver a assinatura</RouterLink>
      </template>
    </div>
  </div>
</template>
