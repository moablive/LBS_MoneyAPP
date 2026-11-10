/**
 * Biometria deste aparelho no MoneyAPP (login por passkey, junto com o LoginHUB).
 *
 * O cadastro e a conferência são do hub (`hubPasskeyClient.ts`, arquivo
 * sincronizado). Aqui fica só o que é deste navegador: se a biometria já foi
 * ativada nele (para a tela de login abrir com o botão em destaque) e se a
 * pessoa disse "agora não" à oferta (30 dias de carência, como o banner de
 * instalar).
 */
const CHAVE = 'moneyapp.biometria';
const CARENCIA_MS = 30 * 24 * 60 * 60 * 1000;

interface Estado {
  /** A biometria foi ativada neste navegador. */
  ativa?: boolean;
  /** Quando a pessoa dispensou a oferta. */
  dispensadaEm?: number;
}

function ler(): Estado {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}') as Estado;
  } catch {
    return {};
  }
}

function gravar(estado: Estado): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* navegação privada: só não lembra */
  }
}

export const biometriaAtivaAqui = (): boolean => ler().ativa === true;
export const marcarBiometriaAtiva = (ativa: boolean): void => gravar(ativa ? { ativa: true } : {});
export const dispensarOfertaDeBiometria = (): void => gravar({ ...ler(), dispensadaEm: Date.now() });

/** Vale oferecer "ativar biometria" agora? (Não ativa aqui e sem "agora não" recente.) */
export function podeOferecerBiometria(): boolean {
  const e = ler();
  if (e.ativa) return false;
  return !e.dispensadaEm || Date.now() - e.dispensadaEm > CARENCIA_MS;
}

/** Nome do aparelho para a lista de biometrias: "iPhone · Safari", "Windows · Chrome". */
export function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  const sistema = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Aparelho';
  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari/.test(ua)
              ? 'Safari'
              : '';
  return navegador ? `${sistema} · ${navegador}` : sistema;
}
