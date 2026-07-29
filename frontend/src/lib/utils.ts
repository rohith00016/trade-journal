import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUsd(value: number | null | undefined) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatR(value: number | null | undefined) {
  const n = Number(value ?? 0)
  const safe = Number.isFinite(n) ? n : 0
  const sign = safe > 0 ? '+' : ''
  return `${sign}${safe.toFixed(2)}R`
}

export function pnlClass(value: number | null | undefined) {
  const n = Number(value ?? 0)
  if (n > 0) return 'text-profit'
  if (n < 0) return 'text-loss'
  return 'text-muted-foreground'
}
