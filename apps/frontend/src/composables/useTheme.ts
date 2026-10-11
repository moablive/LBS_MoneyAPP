import { ref, watchEffect } from 'vue';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'moneyapp-theme';
/** Cor da barra do navegador/PWA em cada tema (bate com --surface-base). */
const THEME_COLOR: Record<Theme, string> = { light: '#f3f4ee', dark: '#121215' };

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage bloqueado: fica no padrão */ }
  return 'light';
}

// Estado único para o app inteiro: o toggle do rail e o do menu mobile
// mexem na mesma ref.
const theme = ref<Theme>(readStored());

function apply(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
}

watchEffect(() => {
  apply(theme.value);
  try { localStorage.setItem(STORAGE_KEY, theme.value); } catch { /* idem */ }
});

export function useTheme() {
  const toggle = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark'; };
  const set = (t: Theme) => { theme.value = t; };
  return { theme, toggle, set };
}
