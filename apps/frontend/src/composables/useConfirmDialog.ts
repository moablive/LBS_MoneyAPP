import { ref } from 'vue';

export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
};

const isOpen = ref(false);
const options = ref<ConfirmDialogOptions>({ message: '' });
let resolvePromise: ((value: boolean) => void) | null = null;

export function useConfirmDialog() {
  const confirm = (opts: string | ConfirmDialogOptions): Promise<boolean> => {
    options.value = typeof opts === 'string' ? { message: opts } : opts;
    isOpen.value = true;
    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  };

  const alert = (opts: string | ConfirmDialogOptions): Promise<void> => {
    const o = typeof opts === 'string' ? { message: opts } : opts;
    return confirm({ ...o, isAlert: true }).then(() => {});
  };

  const close = (result: boolean) => {
    isOpen.value = false;
    if (resolvePromise) {
      resolvePromise(result);
      resolvePromise = null;
    }
  };

  return {
    isOpen,
    options,
    confirm,
    alert,
    close,
  };
}
