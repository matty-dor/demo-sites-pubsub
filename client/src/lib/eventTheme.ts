import type { CSSProperties } from 'react'

/** Distinct accents for dark UI; glow matches each for card wash. Order stable — index chosen by `eventId`. */
const EVENT_THEME_PALETTE = [
  { accent: '#5b8def', glow: 'rgba(91, 141, 239, 0.16)' },
  { accent: '#7c8eef', glow: 'rgba(124, 142, 239, 0.15)' },
  { accent: '#9d7bed', glow: 'rgba(157, 123, 237, 0.14)' },
  { accent: '#b879de', glow: 'rgba(184, 121, 222, 0.14)' },
  { accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.13)' },
  { accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.13)' },
  { accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.13)' },
  { accent: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.13)' },
  { accent: '#4ade80', glow: 'rgba(74, 222, 128, 0.12)' },
  { accent: '#86efac', glow: 'rgba(134, 239, 172, 0.11)' },
  { accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.12)' },
  { accent: '#fb923c', glow: 'rgba(251, 146, 60, 0.12)' },
] as const

function hashEventId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Inline styles so `.mock-event-card` / `.mock-experience-card` pick border + button accents per event. */
export function getEventThemeStyle(eventId: string): CSSProperties {
  const idx = hashEventId(eventId) % EVENT_THEME_PALETTE.length
  const { accent, glow } = EVENT_THEME_PALETTE[idx]
  return {
    '--event-accent': accent,
    '--event-accent-glow': glow,
  } as CSSProperties
}
