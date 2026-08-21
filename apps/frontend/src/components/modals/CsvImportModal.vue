<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { api } from '@moneyapp/api-client';
import type { Account, Category } from '@moneyapp/models';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [], success: [] }>();

const currentStep = ref(1);

// Data for Step 1
const accounts = ref<Account[]>([]);
const normalAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => accounts.value.filter(a => a.type === 'credit_card'));
const categories = ref<Category[]>([]);
const expenseCategories = computed(() => categories.value.filter(c => c.type === 'expense'));
const incomeCategories = computed(() => categories.value.filter(c => c.type === 'income'));
const selectedAccountId = ref('');
const selectedCategoryId = ref(''); // We need category since backend requires it
const selectedFile = ref<File | null>(null);
const fileError = ref('');

// Data for Step 2 & 3
interface ParsedRow {
  id: string;
  dateStr: string;
  dateObj: Date;
  description: string;
  amount: number;
  selected: boolean;
  categoryId: string;
  receiptDataUrl?: string; // cropped receipt from a phone screenshot (jpeg data URL)
  receiptPrintKey?: string; // links back to the print row it came from (for coverage tracking)
}
const allTransactions = ref<ParsedRow[]>([]);
const availableDates = ref<string[]>([]);
const selectedDateFilter = ref<string[]>([]);

// Phone screenshots ("prints") of the bank statement, used to crop receipts.
interface PrintRow {
  date: string; // normalized DD/MM/YYYY
  time: string; // HH:mm
  title: string;
  description: string;
  amount: number; // signed
  type: string;
  crop: string; // jpeg data URL of the cropped row
  consumed: boolean;
}
const selectedPrints = ref<File[]>([]);
const printPreviews = ref<string[]>([]);

// UI State
const isLoading = ref(false);
const isProcessing = ref(false);
const processStatus = ref('');

// All receipt rows detected across the uploaded screenshots (kept so we can
// verify, at any time, that every one was linked to a CSV transaction).
const printRows = ref<PrintRow[]>([]);

// Mismatch report (CSV rows without a receipt / print rows without a CSV match)
const showMismatch = ref(false);
const mismatchContext = ref<'auto' | 'submit'>('auto');
const unmatchedCsv = computed(() => allTransactions.value.filter(t => !t.receiptDataUrl));
const unmatchedPrint = computed(() => printRows.value.filter(p => !p.consumed));
const linkedPrintCount = computed(() => printRows.value.length - unmatchedPrint.value.length);

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    resetState();
    await fetchData();
  }
});

function resetState() {
  currentStep.value = 1;
  selectedAccountId.value = '';
  selectedCategoryId.value = '';
  selectedFile.value = null;
  fileError.value = '';
  allTransactions.value = [];
  availableDates.value = [];
  selectedDateFilter.value = [];
  selectedPrints.value = [];
  printPreviews.value = [];
  printRows.value = [];
  isLoading.value = false;
  isProcessing.value = false;
  processStatus.value = '';
  showMismatch.value = false;
  mismatchContext.value = 'auto';
}

async function fetchData() {
  try {
    const [accs, cats] = await Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<Category[]>('/categories')
    ]);
    accounts.value = accs;
    categories.value = cats;
    if (accs.length > 0) selectedAccountId.value = accs[0].id;
    if (cats.length > 0) selectedCategoryId.value = cats[0].id;
  } catch (e) {
    console.error('Failed to load accounts/categories', e);
  }
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
    fileError.value = '';
  }
}

function handlePrintsChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  for (const file of Array.from(target.files)) {
    selectedPrints.value.push(file);
    const reader = new FileReader();
    reader.onload = (ev) => printPreviews.value.push(ev.target?.result as string);
    reader.readAsDataURL(file);
  }
  target.value = '';
}

function removePrint(index: number) {
  selectedPrints.value.splice(index, 1);
  printPreviews.value.splice(index, 1);
}

async function processFile() {
  if (!selectedFile.value || !selectedAccountId.value || !selectedCategoryId.value) {
    fileError.value = 'Selecione uma conta, categoria e arquivo.';
    return;
  }

  isProcessing.value = true;
  fileError.value = '';
  try {
    processStatus.value = 'Lendo CSV...';
    const text = await selectedFile.value.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      fileError.value = 'Nenhuma transação válida encontrada no CSV.';
      return;
    }

    allTransactions.value = rows;
    const dates = Array.from(new Set(rows.map(r => r.dateStr)));
    dates.sort((a, b) => {
      const parseBrDate = (str: string) => {
        const parts = str.split('/');
        if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        return new Date(str).getTime();
      };
      return parseBrDate(b) - parseBrDate(a); // Sort descending (newest first)
    });
    availableDates.value = dates;
    selectedDateFilter.value = [...dates]; // Select all by default

    // If the user attached phone screenshots, read them, crop each receipt and
    // match it to a CSV transaction by date + amount (+ name).
    if (selectedPrints.value.length > 0) {
      await processPrints();
    }

    currentStep.value = 2;
  } catch (e) {
    console.error(e);
    fileError.value = 'Erro ao processar os arquivos.';
  } finally {
    isProcessing.value = false;
    processStatus.value = '';
  }
}

// ---------- receipt cropping from screenshots --------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function cropRow(img: HTMLImageElement, yTop: number, yBottom: number): string {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  // small vertical padding so the crop isn't cut too tight
  const pad = Math.round(H * 0.005);
  const top = Math.max(0, Math.round(yTop * H) - pad);
  const bottom = Math.min(H, Math.round(yBottom * H) + pad);
  const height = Math.max(1, bottom - top);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, top, W, height, 0, 0, W, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Crop an arbitrary rectangle (normalized 0..1 coords) from an image.
function cropRect(img: HTMLImageElement, x: number, y: number, w: number, h: number): string {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const sx = Math.round(clamp01(x) * W);
  const sy = Math.round(clamp01(y) * H);
  const sw = Math.max(1, Math.round(clamp01(w) * W));
  const sh = Math.max(1, Math.round(clamp01(h) * H));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.85);
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
};

// Normalize any date the model returns (DD/MM, DD/MM/YYYY, DD/ago...) to DD/MM/YYYY.
function normalizeDateToBr(raw: string): string {
  if (!raw) return '';
  const parts = raw.replace(/\s+/g, '').split('/');
  const rawDay = parts[0];
  const rawMonth = parts[1];
  if (!rawDay || !rawMonth) return '';
  const day = rawDay.padStart(2, '0');
  let month = rawMonth.toLowerCase();
  const mapped = MONTH_MAP[month.slice(0, 3)];
  if (mapped) month = mapped;
  month = month.padStart(2, '0');
  const year = parts[2] && parts[2].length === 4 ? parts[2] : String(new Date().getFullYear());
  return `${day}/${month}/${year}`;
}

// Canonical day key (YYYY-MM-DD) so matching works regardless of whether the
// CSV uses DD/MM/YYYY (Brazilian) or YYYY-MM-DD (ISO) dates.
function toDayKey(s: string): string {
  if (!s) return '';
  if (s.includes('/')) {
    const [dd, mm, yyyy] = s.split('/');
    if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return s;
}

function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token-overlap similarity (0..1) between two names.
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / Math.min(ta.size, tb.size);
}

async function processPrints() {
  const collected: PrintRow[] = [];
  for (let i = 0; i < selectedPrints.value.length; i++) {
    processStatus.value = `Lendo comprovantes (${i + 1}/${selectedPrints.value.length})...`;
    const file = selectedPrints.value[i];
    if (!file) continue;
    const dataUrl = await fileToDataUrl(file);
    const base64 = dataUrl.split(',')[1] ?? '';
    const img = await loadImage(dataUrl);
    const res = await api.post<{ rows: any[] }>('/transactions/parse-statement', { imageBase64: base64 });
    for (const r of res.rows || []) {
      const crop = cropRow(img, Number(r.yTop), Number(r.yBottom));
      collected.push({
        date: normalizeDateToBr(r.date),
        time: r.time || '',
        title: r.title || '',
        description: r.description || '',
        amount: Number(r.amount),
        type: r.type === 'income' ? 'income' : 'expense',
        crop,
        consumed: false,
      });
    }
  }

  // Deduplicate rows repeated across overlapping screenshots.
  const seen = new Set<string>();
  const deduped = collected.filter(r => {
    const key = `${r.date}|${r.time}|${r.amount.toFixed(2)}|${normalizeName(r.description)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  printRows.value = deduped;
  matchReceipts();
}

function matchReceipts() {
  processStatus.value = 'Associando comprovantes...';
  for (const tx of allTransactions.value) {
    if (tx.receiptDataUrl) continue;
    const candidates = printRows.value.filter(
      p => !p.consumed && toDayKey(p.date) === toDayKey(tx.dateStr) && Math.abs(p.amount - tx.amount) < 0.005
    );
    if (candidates.length === 0) continue;
    // Prefer the row whose name best matches the CSV description.
    candidates.sort((a, b) => nameSimilarity(b.description, tx.description) - nameSimilarity(a.description, tx.description));
    const best = candidates[0];
    if (!best) continue;
    best.consumed = true;
    tx.receiptDataUrl = best.crop;
    tx.receiptPrintKey = printKey(best);
  }

  // Only interrupt the user when a receipt from the screenshots could not be
  // linked — that is the case that risks losing data. CSV rows without a
  // receipt are expected (prints may not cover every day) and just informational.
  if (unmatchedPrint.value.length > 0) {
    mismatchContext.value = 'auto';
    showMismatch.value = true;
  }
}

function printKey(p: PrintRow): string {
  return `${p.date}|${p.time}|${p.amount.toFixed(2)}|${normalizeName(p.description)}`;
}

// CSV transactions on the same day still missing a receipt — best targets for a
// leftover print. Falls back to any receiptless transaction if none share the day.
function assignCandidates(p: PrintRow): ParsedRow[] {
  const sameDay = allTransactions.value.filter(t => !t.receiptDataUrl && toDayKey(t.dateStr) === toDayKey(p.date));
  const pool = sameDay.length > 0 ? sameDay : allTransactions.value.filter(t => !t.receiptDataUrl);
  return [...pool].sort(
    (a, b) => Math.abs(a.amount - p.amount) - Math.abs(b.amount - p.amount)
  );
}

function assignPrintToTransaction(p: PrintRow, txId: string) {
  if (!txId) return;
  const tx = allTransactions.value.find(t => t.id === txId);
  if (!tx) return;
  // If that transaction already had a print linked, free it up first.
  if (tx.receiptPrintKey) {
    const prev = printRows.value.find(pr => printKey(pr) === tx.receiptPrintKey);
    if (prev) prev.consumed = false;
  }
  tx.receiptDataUrl = p.crop;
  tx.receiptPrintKey = printKey(p);
  p.consumed = true;
}

function detachReceipt(row: ParsedRow) {
  if (row.receiptPrintKey) {
    const prev = printRows.value.find(pr => printKey(pr) === row.receiptPrintKey);
    if (prev) prev.consumed = false;
    row.receiptPrintKey = undefined;
  }
  row.receiptDataUrl = undefined;
}

function openMismatchReview() {
  mismatchContext.value = 'auto';
  showMismatch.value = true;
}

// ---------- manual cropping (fallback when the AI mis-detects) ---------------

const showManualCrop = ref(false);
const manualTargetRow = ref<ParsedRow | null>(null);
const manualPrintIndex = ref(0);
const isSelecting = ref(false);
const selStart = ref<{ x: number; y: number } | null>(null);
const selection = ref<{ x: number; y: number; w: number; h: number } | null>(null);

function openManualCrop(row: ParsedRow) {
  manualTargetRow.value = row;
  manualPrintIndex.value = 0;
  selection.value = null;
  isSelecting.value = false;
  selStart.value = null;
  showManualCrop.value = true;
}

function closeManualCrop() {
  showManualCrop.value = false;
  manualTargetRow.value = null;
  selection.value = null;
}

function relativePoint(e: PointerEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return {
    x: clamp01((e.clientX - rect.left) / rect.width),
    y: clamp01((e.clientY - rect.top) / rect.height),
  };
}

function onCropPointerDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  const p = relativePoint(e, el);
  selStart.value = p;
  isSelecting.value = true;
  selection.value = { x: p.x, y: p.y, w: 0, h: 0 };
  el.setPointerCapture(e.pointerId);
}

function onCropPointerMove(e: PointerEvent) {
  if (!isSelecting.value || !selStart.value) return;
  const el = e.currentTarget as HTMLElement;
  const p = relativePoint(e, el);
  const s = selStart.value;
  selection.value = {
    x: Math.min(p.x, s.x),
    y: Math.min(p.y, s.y),
    w: Math.abs(p.x - s.x),
    h: Math.abs(p.y - s.y),
  };
}

function onCropPointerUp() {
  isSelecting.value = false;
}

async function applyManualCrop() {
  const row = manualTargetRow.value;
  const sel = selection.value;
  const dataUrl = printPreviews.value[manualPrintIndex.value];
  if (!row || !sel || !dataUrl || sel.w < 0.01 || sel.h < 0.005) return;
  const img = await loadImage(dataUrl);
  row.receiptDataUrl = cropRect(img, sel.x, sel.y, sel.w, sel.h);
  closeManualCrop();
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  
  let separator = ',';
  if (lines[0].includes('\t')) separator = '\t';
  else if (lines[0].includes(';')) separator = ';';
  
  let startIndex = 0;
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('data') || header.includes('date') || header.includes('valor') || header.includes('amount');
  if (hasHeader) startIndex = 1;

  let dateIdx = 0;
  let descIdx = 1;
  let valIdx = 2;

  if (hasHeader) {
    const headers = lines[0].toLowerCase().split(separator).map(h => h.trim());
    const possibleDates = ['data', 'date'];
    const possibleDesc = ['descrição', 'historico', 'histórico', 'origem / destino', 'detalhe', 'lançamento', 'nome', 'estabelecimento'];
    const possibleVal = ['valor', 'amount'];
    
    let foundDate = false;
    let foundDesc = false;
    let foundVal = false;
    
    headers.forEach((h, i) => {
      if (!foundDate && possibleDates.some(pd => h.includes(pd))) { dateIdx = i; foundDate = true; }
      else if (!foundDesc && possibleDesc.some(pd => h.includes(pd))) { descIdx = i; foundDesc = true; }
      else if (!foundVal && possibleVal.some(pd => h.includes(pd))) { valIdx = i; foundVal = true; }
    });
  }

  const result: ParsedRow[] = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    // Basic CSV splitting taking quotes into account
    const regex = new RegExp(`(?!\s*$)\s*(?:'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'|"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|([^${separator}]+))\s*(?:${separator}|$)`, 'g');
    let match;
    const cols = [];
    while ((match = regex.exec(lines[i])) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      cols.push(match[1] || match[2] || match[3] || '');
    }
    
    const simpleCols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
    const finalCols = cols.length > Math.max(dateIdx, descIdx, valIdx) ? cols : simpleCols;
    
    if (finalCols.length > Math.max(dateIdx, descIdx, valIdx)) {
      const dateStrRaw = finalCols[dateIdx].trim();
      const desc = finalCols[descIdx].trim();
      let valStr = finalCols[valIdx].trim();
      
      valStr = valStr.replace('−', '-');
      valStr = valStr.replace(/[^\d.,-]/g, '');
      
      const lastComma = valStr.lastIndexOf(',');
      const lastDot = valStr.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        valStr = valStr.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > lastComma) {
        valStr = valStr.replace(/,/g, '');
      } else if (lastComma !== -1) {
        valStr = valStr.replace(',', '.');
      }
      
      const amount = parseFloat(valStr);
      
      if (!isNaN(amount) && dateStrRaw) {
        let d = new Date();
        let formattedDateStr = dateStrRaw;
        if (dateStrRaw.includes('/')) {
          const parts = dateStrRaw.split('/');
          if (parts.length === 3) {
            d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            formattedDateStr = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
          }
        } else if (dateStrRaw.includes('-')) {
          d = new Date(dateStrRaw);
        }
        
        result.push({
          id: `csv-${i}`,
          dateStr: formattedDateStr,
          dateObj: d,
          description: desc || 'Transação Importada',
          amount,
          selected: true,
          categoryId: selectedCategoryId.value
        });
      }
    }
  }
  return result;
}

const formattedDates = computed(() => {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return availableDates.value.map(dStr => {
    const parts = dStr.split('/');
    let dayName = '';
    if (parts.length === 3) {
      const dObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (!isNaN(dObj.getTime())) {
        dayName = days[dObj.getDay()];
      }
    } else if (dStr.includes('-')) {
      const dObj = new Date(dStr);
      if (!isNaN(dObj.getTime())) {
        // Need to account for timezone issues, but assuming local
        dayName = days[dObj.getDay() + (dObj.getHours() < 12 ? 1 : 0)]; 
      }
    }
    return {
      value: dStr,
      label: dayName ? `${dStr} - ${dayName}` : dStr
    };
  });
});

const filteredTransactions = computed(() => {
  return allTransactions.value.filter(t => selectedDateFilter.value.includes(t.dateStr));
});

function toggleAllDates() {
  if (selectedDateFilter.value.length === availableDates.value.length) {
    selectedDateFilter.value = [];
  } else {
    selectedDateFilter.value = [...availableDates.value];
  }
}

function confirmDateFilter() {
  // Update selections: only keep selected if they are in the current filter
  // Wait, the requirement says "Each item has a checkbox (checked by default). User can uncheck."
  // It's better to just move to step 3
  currentStep.value = 3;
}

async function submitImport(force = false) {
  const toImport = filteredTransactions.value.filter(t => t.selected);
  if (toImport.length === 0) return;

  // Safety check: if any receipt read from the screenshots was not linked to a
  // CSV transaction, force the user to review/confirm before importing.
  if (!force && printRows.value.length > 0 && unmatchedPrint.value.length > 0) {
    mismatchContext.value = 'submit';
    showMismatch.value = true;
    return;
  }

  isLoading.value = true;
  try {
    const payload = toImport.map(t => ({
      description: t.description,
      amount: t.amount,
      type: t.amount >= 0 ? 'income' : 'expense',
      status: 'paid',
      occurredAt: t.dateObj.toISOString(),
      accountId: selectedAccountId.value,
      categoryId: t.categoryId,
      ...(t.receiptDataUrl
        ? { receipt: { mimeType: 'image/jpeg', base64: t.receiptDataUrl } }
        : {}),
    }));
    
    await api.post('/transactions/bulk', payload);
    
    window.dispatchEvent(new CustomEvent('transaction-created'));
    emit('success');
    emit('close');
  } catch (e) {
    console.error('Failed to bulk import', e);
    alert('Erro ao importar transações.');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')"></div>
    
    <div class="relative bg-surface-raised border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-surface-overlay">
        <h2 class="text-lg font-bold text-white tracking-wide">Importar CSV</h2>
        <button @click="emit('close')" class="text-muted hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto flex-1 custom-scrollbar">
        <!-- Step 1: Upload & Account -->
        <div v-if="currentStep === 1" class="space-y-6">
          <p class="text-sm text-muted">Selecione a conta, a categoria padrão e o arquivo CSV para importar suas transações.</p>
          
          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted">Conta</label>
              <select v-model="selectedAccountId" class="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors">
                <option value="" disabled>Selecione uma conta...</option>
                <optgroup label="Contas" v-if="normalAccounts.length > 0">
                  <option v-for="a in normalAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                </optgroup>
                <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
                  <option v-for="a in creditCardAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                </optgroup>
              </select>
            </div>
            
            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted">Categoria Padrão</label>
              <select v-model="selectedCategoryId" class="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors">
                <option value="" disabled>Selecione uma categoria...</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted">Arquivo CSV</label>
              <input type="file" accept=".csv" @change="handleFileChange" class="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 transition-colors cursor-pointer" />
              <p v-if="fileError" class="text-xs text-red-400 mt-1">{{ fileError }}</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted">Prints do Extrato (opcional)</label>
              <p class="text-[11px] text-muted/80 leading-snug">Anexe uma ou mais capturas de tela do extrato do app do banco. A IA vai recortar o comprovante de cada transação e associar automaticamente pela data e valor.</p>
              <input type="file" accept="image/*" multiple @change="handlePrintsChange" class="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 transition-colors cursor-pointer" />
              <div v-if="printPreviews.length > 0" class="flex flex-wrap gap-2 pt-1">
                <div v-for="(p, i) in printPreviews" :key="i" class="relative w-16 h-24 rounded-lg overflow-hidden border border-surface-border bg-surface-base">
                  <img :src="p" class="w-full h-full object-cover" />
                  <button @click="removePrint(i)" type="button" class="absolute top-0.5 right-0.5 bg-black/60 w-5 h-5 flex items-center justify-center rounded-full text-white text-xs hover:bg-black/80">&times;</button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="pt-4 flex justify-end">
            <button @click="processFile" :disabled="isProcessing" class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <svg v-if="isProcessing" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isProcessing ? (processStatus || 'Processando...') : 'Continuar' }}
            </button>
          </div>
        </div>

        <!-- Step 2: Date Filter -->
        <div v-else-if="currentStep === 2" class="space-y-6">
          <p class="text-sm text-muted">Escolha de quais dias você deseja importar as transações lidas no arquivo.</p>
          
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted">Filtrar por Data</label>
              <button @click="toggleAllDates" class="text-xs text-accent hover:text-accent/80 transition-colors">
                {{ selectedDateFilter.length === availableDates.length ? 'Desmarcar Todos' : 'Marcar Todos' }}
              </button>
            </div>
            
            <div class="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <label v-for="d in formattedDates" :key="d.value" class="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-surface-base cursor-pointer hover:border-accent/50 transition-colors" :class="{'bg-accent/5 border-accent/30': selectedDateFilter.includes(d.value)}">
                <input type="checkbox" :value="d.value" v-model="selectedDateFilter" class="w-4 h-4 rounded text-accent bg-surface-overlay border-surface-border focus:ring-accent focus:ring-offset-surface-base" />
                <span class="text-sm font-medium text-white">{{ d.label }}</span>
              </label>
            </div>
          </div>

          <div class="pt-4 flex justify-between border-t border-surface-border">
            <button @click="currentStep = 1" class="text-muted hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Voltar
            </button>
            <button @click="confirmDateFilter" :disabled="selectedDateFilter.length === 0" class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed">
              Ver Transações
            </button>
          </div>
        </div>

        <!-- Step 3: Review -->
        <div v-else-if="currentStep === 3" class="space-y-4">
          <div class="flex justify-between items-center mb-2">
            <p class="text-sm text-muted">Revise as transações selecionadas ({{ filteredTransactions.filter(t => t.selected).length }} de {{ filteredTransactions.length }}).</p>
          </div>

          <!-- Print receipts coverage summary -->
          <div v-if="printRows.length > 0" class="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
               :class="unmatchedPrint.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-income/40 bg-income/5'">
            <div class="text-xs leading-snug">
              <p class="font-semibold text-white">
                Comprovantes: {{ linkedPrintCount }}/{{ printRows.length }} atrelados
              </p>
              <p v-if="unmatchedPrint.length > 0" class="text-amber-400 mt-0.5">
                {{ unmatchedPrint.length }} print(s) ainda sem transação correspondente.
              </p>
              <p v-else class="text-income mt-0.5">Todos os prints foram atrelados a uma transação.</p>
            </div>
            <button
              v-if="unmatchedPrint.length > 0"
              @click="openMismatchReview"
              type="button"
              class="shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-amber-500/25 transition-colors"
            >
              Revisar
            </button>
          </div>
          
          <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <div v-for="t in filteredTransactions" :key="t.id" class="flex items-center gap-4 p-3 rounded-xl border border-surface-border bg-surface-base transition-colors" :class="{'bg-accent/5 border-accent/30': t.selected}">
              <label class="flex items-center cursor-pointer">
                <input type="checkbox" v-model="t.selected" class="w-4 h-4 rounded text-accent bg-surface-overlay border-surface-border focus:ring-accent focus:ring-offset-surface-base" />
              </label>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ t.description }}</p>
                <p class="text-xs text-muted">{{ t.dateStr }}</p>
              </div>
              <div class="shrink-0 flex items-center gap-1.5">
                <div v-if="t.receiptDataUrl" class="relative">
                  <a :href="t.receiptDataUrl" target="_blank" title="Ver comprovante">
                    <img :src="t.receiptDataUrl" class="w-14 h-10 object-cover rounded-md border border-accent/40" />
                  </a>
                  <button @click="detachReceipt(t)" type="button" title="Remover comprovante" class="absolute -top-1.5 -right-1.5 bg-black/70 w-4 h-4 flex items-center justify-center rounded-full text-white text-[10px] hover:bg-black/90">&times;</button>
                </div>
                <button @click="openManualCrop(t)" type="button" :title="t.receiptDataUrl ? 'Refazer recorte manual' : 'Recortar comprovante manualmente'" class="w-8 h-10 rounded-md border border-dashed border-surface-border flex items-center justify-center text-muted hover:text-accent hover:border-accent/50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
                </button>
              </div>
              <div class="flex flex-col items-end gap-1">
                <div class="text-sm font-bold font-display" :class="t.amount >= 0 ? 'text-income' : 'text-expense'">
                  {{ t.amount >= 0 ? '+' : '' }}{{ t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}
                </div>
                <select v-model="t.categoryId" class="bg-surface-overlay border border-surface-border rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-accent text-white max-w-[140px] truncate cursor-pointer">
                  <optgroup label="Despesas" v-if="expenseCategories.length > 0">
                    <option v-for="c in expenseCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </optgroup>
                  <optgroup label="Receitas" v-if="incomeCategories.length > 0">
                    <option v-for="c in incomeCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          <div class="pt-4 flex justify-between border-t border-surface-border mt-4">
            <button @click="currentStep = 2" class="text-muted hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" :disabled="isLoading">
              Voltar
            </button>
            <button @click="submitImport()" :disabled="isLoading || filteredTransactions.filter(t => t.selected).length === 0" class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isLoading ? 'Importando...' : 'Importar Selecionadas' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mismatch report overlay -->
    <div v-if="showMismatch" class="absolute inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showMismatch = false"></div>
      <div class="relative bg-surface-raised border border-surface-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div class="px-6 py-4 border-b border-surface-border bg-surface-overlay flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <h3 class="text-base font-bold text-white">Divergências encontradas</h3>
        </div>
        <div class="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
          <div v-if="unmatchedCsv.length > 0" class="space-y-2">
            <p class="text-sm font-semibold text-white">{{ unmatchedCsv.length }} transação(ões) do CSV sem comprovante <span class="text-muted font-normal">(ok — os prints podem não cobrir todos os dias)</span>:</p>
            <ul class="space-y-1">
              <li v-for="t in unmatchedCsv.slice(0, 20)" :key="t.id" class="flex justify-between items-center text-xs bg-surface-base border border-surface-border rounded-lg px-3 py-2">
                <span class="text-muted truncate mr-2">{{ t.dateStr }} · {{ t.description }}</span>
                <span class="font-semibold shrink-0" :class="t.amount >= 0 ? 'text-income' : 'text-expense'">{{ t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
              </li>
            </ul>
            <p v-if="unmatchedCsv.length > 20" class="text-[11px] text-muted">+ {{ unmatchedCsv.length - 20 }} outra(s)…</p>
          </div>
          <div v-if="unmatchedPrint.length > 0" class="space-y-2">
            <p class="text-sm font-semibold text-white">{{ unmatchedPrint.length }} comprovante(s) do print sem transação no CSV:</p>
            <p class="text-[11px] text-muted">Atrele cada um a uma transação abaixo, ou deixe em branco para ignorar.</p>
            <ul class="space-y-2">
              <li v-for="(p, i) in unmatchedPrint" :key="`up-${i}`" class="flex items-center gap-3 bg-surface-base border border-surface-border rounded-lg px-3 py-2">
                <img v-if="p.crop" :src="p.crop" class="w-14 h-10 object-cover rounded-md border border-surface-border shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-center gap-2">
                    <span class="text-xs text-muted truncate">{{ p.date }} {{ p.time }} · {{ p.description || p.title }}</span>
                    <span class="text-xs font-semibold shrink-0" :class="p.amount >= 0 ? 'text-income' : 'text-expense'">{{ p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
                  </div>
                  <select
                    @change="assignPrintToTransaction(p, ($event.target as HTMLSelectElement).value)"
                    class="mt-1 w-full bg-surface-overlay border border-surface-border rounded-lg text-xs px-2 py-1.5 text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">Atrelar a uma transação...</option>
                    <option v-for="t in assignCandidates(p)" :key="t.id" :value="t.id">
                      {{ t.dateStr }} · {{ t.description }} · {{ t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}
                    </option>
                  </select>
                </div>
              </li>
            </ul>
          </div>

          <p v-if="unmatchedCsv.length === 0 && unmatchedPrint.length === 0" class="text-sm text-income text-center py-4">
            Tudo certo! Todos os comprovantes foram atrelados.
          </p>
        </div>
        <div class="px-6 py-4 border-t border-surface-border flex justify-between gap-3">
          <button @click="showMismatch = false" class="text-muted hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Fechar
          </button>
          <button
            v-if="mismatchContext === 'submit'"
            @click="showMismatch = false; submitImport(true)"
            class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >
            Importar mesmo assim
          </button>
          <button
            v-else
            @click="showMismatch = false"
            class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>

    <!-- Manual crop overlay -->
    <div v-if="showManualCrop" class="absolute inset-0 z-[120] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeManualCrop"></div>
      <div class="relative bg-surface-raised border border-surface-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-surface-border bg-surface-overlay">
          <h3 class="text-base font-bold text-white">Recorte manual</h3>
          <p v-if="manualTargetRow" class="text-xs text-muted mt-0.5 truncate">
            {{ manualTargetRow.dateStr }} · {{ manualTargetRow.description }} ·
            <span :class="manualTargetRow.amount >= 0 ? 'text-income' : 'text-expense'">{{ manualTargetRow.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</span>
          </p>
        </div>

        <div class="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-3">
          <!-- No prints yet: let the user add one right here -->
          <div v-if="printPreviews.length === 0" class="text-center py-6 space-y-3">
            <p class="text-sm text-muted">Nenhum print carregado. Anexe uma captura do extrato para recortar.</p>
            <label class="inline-block cursor-pointer bg-accent/10 text-accent text-xs font-semibold px-4 py-2 rounded-full hover:bg-accent/20 transition-colors">
              Anexar print
              <input type="file" accept="image/*" multiple class="hidden" @change="handlePrintsChange" />
            </label>
          </div>

          <template v-else>
            <!-- Print selector when there are multiple screenshots -->
            <div v-if="printPreviews.length > 1" class="flex gap-2 flex-wrap">
              <button
                v-for="(p, i) in printPreviews"
                :key="`mp-${i}`"
                type="button"
                @click="manualPrintIndex = i; selection = null"
                class="w-10 h-14 rounded-md overflow-hidden border-2 transition-colors"
                :class="manualPrintIndex === i ? 'border-accent' : 'border-surface-border opacity-60 hover:opacity-100'"
              >
                <img :src="p" class="w-full h-full object-cover" />
              </button>
            </div>

            <p class="text-xs text-muted">Arraste sobre o comprovante da transação para selecioná-lo.</p>

            <div class="max-h-[55vh] overflow-y-auto custom-scrollbar rounded-lg border border-surface-border bg-black/30 flex justify-center">
              <div
                class="relative inline-block select-none touch-none cursor-crosshair"
                @pointerdown="onCropPointerDown"
                @pointermove="onCropPointerMove"
                @pointerup="onCropPointerUp"
              >
                <img :src="printPreviews[manualPrintIndex]" class="block w-full max-w-full pointer-events-none" />
                <div
                  v-if="selection && (selection.w > 0 || selection.h > 0)"
                  class="absolute border-2 border-accent bg-accent/20 pointer-events-none"
                  :style="{
                    left: (selection.x * 100) + '%',
                    top: (selection.y * 100) + '%',
                    width: (selection.w * 100) + '%',
                    height: (selection.h * 100) + '%',
                  }"
                ></div>
              </div>
            </div>
          </template>
        </div>

        <div class="px-6 py-4 border-t border-surface-border flex justify-between gap-3">
          <button @click="closeManualCrop" type="button" class="text-muted hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Cancelar
          </button>
          <div class="flex gap-2">
            <button
              v-if="selection"
              @click="selection = null"
              type="button"
              class="text-muted hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Limpar
            </button>
            <button
              @click="applyManualCrop"
              type="button"
              :disabled="!selection || selection.w < 0.01 || selection.h < 0.005"
              class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Usar recorte
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
