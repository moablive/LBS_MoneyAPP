<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@moneyapp/api-client';
import type { CreateCategoryInput, CategoryType, Category } from '@moneyapp/models';
import Modal from './Modal.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm } = useConfirmDialog();

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ 
  categoryToEdit?: Category | null;
}>();
const emit = defineEmits<{
  (e: 'created', value: unknown): void;
  (e: 'deleted'): void;
}>();

const name = ref('');
const type = ref<CategoryType>('expense');
const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
];
const color = ref(PRESET_COLORS[5]);
const submitting = ref(false);
const error = ref<string | null>(null);

watch(
  open,
  (v) => {
    if (v) {
      if (props.categoryToEdit) {
        name.value = props.categoryToEdit.name;
        type.value = props.categoryToEdit.type;
        color.value = props.categoryToEdit.color || PRESET_COLORS[5];
      } else {
        name.value = '';
        type.value = 'expense';
        color.value = PRESET_COLORS[5];
      }
      error.value = null;
    }
  },
  { immediate: true }
);

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    const payload: Partial<CreateCategoryInput> = {
      name: name.value.trim(),
      type: type.value,
      color: color.value,
    };
    if (props.categoryToEdit) {
      await api.patch(`/categories/${props.categoryToEdit.id}`, payload);
    } else {
      await api.post<unknown>('/categories', payload);
    }
    emit('created', null); // Trigger reload
    open.value = false;
  } catch (e: any) {
    if (e?.response?.data?.error === 'duplicate_category') {
      error.value = 'Já existe uma categoria com esse nome e tipo.';
    } else {
      error.value = 'Não foi possível salvar a categoria.';
    }
  } finally {
    submitting.value = false;
  }
}

async function remove() {
  if (!props.categoryToEdit) return;
  if (!(await confirm('Tem certeza que deseja excluir esta categoria?'))) return;

  submitting.value = true;
  error.value = null;
  try {
    await api.delete(`/categories/${props.categoryToEdit.id}`);
    emit('deleted');
    open.value = false;
  } catch (e: any) {
    if (e?.response?.data?.error === 'category_in_use') {
      error.value = 'Esta categoria está em uso por transações ou assinaturas e não pode ser excluída.';
    } else {
      error.value = 'Não foi possível excluir a categoria.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="categoryToEdit ? 'Editar Categoria' : 'Nova Categoria'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Nome</span>
        <input
          v-model="name"
          required
          maxlength="120"
          placeholder="..."
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Tipo</span>
          <select
            v-model="type"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>

        <div class="block space-y-2">
          <span class="text-xs uppercase tracking-wide text-muted">Cor</span>
          <div class="flex flex-wrap gap-2 pt-1">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              type="button"
              class="w-6 h-6 rounded-full border-2 transition-transform focus:outline-none focus:ring-2 focus:ring-accent"
              :style="{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent', transform: color === c ? 'scale(1.15)' : 'scale(1)' }"
              @click="color = c"
            ></button>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <div class="flex justify-between gap-2 pt-2 border-t border-surface-border mt-4">
        <div>
          <button
            v-if="categoryToEdit"
            type="button"
            class="px-4 py-2 rounded-xl text-expense hover:bg-expense/10 text-sm font-medium transition-colors"
            @click="remove"
          >
            Excluir
          </button>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100"
            @click="open = false"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="submitting || !name"
            class="px-4 py-2 rounded-xl bg-accent text-white font-medium disabled:opacity-60"
          >
            {{ submitting ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>
    </form>
  </Modal>
</template>
