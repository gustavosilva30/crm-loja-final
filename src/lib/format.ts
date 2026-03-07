/**
 * Funções centralizadas de formatação para o CRM (datas, moeda, números de pedido).
 */

const defaultDatePlaceholder = '---'
const defaultNullPlaceholder = '—'

/** Formata valor em Real (BRL). */
export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Alias para fmtCurrency (compatibilidade com código que usa "fmt"). */
export const fmt = fmtCurrency

/** Formata apenas data (pt-BR). Aceita string, Date ou null/undefined. */
export function fmtDate(d: string | Date | null | undefined, placeholder = defaultDatePlaceholder): string {
  if (d == null) return placeholder
  try {
    const date = typeof d === 'string' ? new Date(d.includes('T') ? d : d + 'T00:00:00') : new Date(d)
    if (isNaN(date.getTime())) return placeholder
    return new Intl.DateTimeFormat('pt-BR').format(date)
  } catch {
    return placeholder
  }
}

/** Formata data e hora (pt-BR, short). */
export function fmtDateTime(d: string | Date | null | undefined, placeholder = defaultDatePlaceholder): string {
  if (d == null) return placeholder
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return placeholder
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  } catch {
    return placeholder
  }
}

/** Formata data e hora em uma linha curta (dd/mm hh:mm). */
export function fmtDateTimeShort(d: string | Date | null | undefined, placeholder = defaultDatePlaceholder): string {
  if (d == null) return placeholder
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return placeholder
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return placeholder
  }
}

/** Formata número de pedido com 6 dígitos (zeros à esquerda). */
export function formatNumPedido(num: number | null | undefined, emptyLabel = '------'): string {
  if (num == null) return emptyLabel
  const n = Number(num)
  if (isNaN(n)) return emptyLabel
  return String(n).padStart(6, '0')
}

/** Formata número de orçamento (pode ser sem zero-pad, conforme uso em Orcamentos). */
export function formatNumOrcamento(num: number | null | undefined, emptyLabel = '------'): string {
  if (num == null) return emptyLabel
  const n = Number(num)
  if (isNaN(n)) return emptyLabel
  return String(n)
}
