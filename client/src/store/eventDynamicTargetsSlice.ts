import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { normalizeRulesFieldPath } from '../lib/personalizationFieldPath'
import {
  normalizeComparisonOperator,
  type ComparisonOperator,
} from '../lib/ruleMatch'

/**
 * Events v2 — Dynamic Content section state.
 *
 * Differs from {@link DynamicContentState} (v1) in that v2 binds variation lists to a specific
 * page-structure cell (a row, optionally a `50-50` side). The v1 slice is left untouched so
 * existing v1 events keep working.
 */

export type V2ContentSourceMode = 'static' | 'flexible'

export type V2StaticContentType = 'text' | 'imageUrl'

export type V2StaticMappingRow = {
  operator: ComparisonOperator
  value: string
  contentType: V2StaticContentType
  content: string
}

/** `null` means a Full-Width row's only cell. `'A'`/`'B'` identify the two cells of a 50-50 row. */
export type V2DynamicTargetSide = 'A' | 'B' | null

export type V2DynamicTarget = {
  id: string
  rowId: string
  side: V2DynamicTargetSide
  staticMappings: V2StaticMappingRow[]
}

export type V2DynamicConfig = {
  contentSourceMode: V2ContentSourceMode
  /** Single Personalization-API field path applied to every target's mappings. */
  fieldPath: string
  targets: V2DynamicTarget[]
}

export function emptyV2StaticMapping(): V2StaticMappingRow {
  return { operator: 'eq', value: '', contentType: 'text', content: '' }
}

export function createDefaultV2DynamicConfig(): V2DynamicConfig {
  return {
    contentSourceMode: 'static',
    fieldPath: normalizeRulesFieldPath('segment'),
    targets: [],
  }
}

function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

export function newV2DynamicTarget(
  rowId: string,
  side: V2DynamicTargetSide,
): V2DynamicTarget {
  return {
    id: safeRandomId(),
    rowId,
    side,
    staticMappings: [emptyV2StaticMapping()],
  }
}

export function normalizeV2DynamicConfig(
  raw: Partial<V2DynamicConfig> | undefined,
): V2DynamicConfig {
  const base = createDefaultV2DynamicConfig()
  if (!raw || typeof raw !== 'object') return base

  const targets: V2DynamicTarget[] = Array.isArray(raw.targets)
    ? raw.targets.map((t) => ({
        id: typeof t?.id === 'string' && t.id ? t.id : safeRandomId(),
        rowId: typeof t?.rowId === 'string' ? t.rowId : '',
        side: t?.side === 'A' || t?.side === 'B' ? t.side : null,
        staticMappings: Array.isArray(t?.staticMappings)
          ? t.staticMappings.map((m) => ({
              operator: normalizeComparisonOperator(m?.operator),
              value: typeof m?.value === 'string' ? m.value : '',
              contentType: m?.contentType === 'imageUrl' ? 'imageUrl' : 'text',
              content: typeof m?.content === 'string' ? m.content : '',
            }))
          : [],
      }))
    : []

  return {
    contentSourceMode:
      raw.contentSourceMode === 'flexible' ? 'flexible' : 'static',
    fieldPath: normalizeRulesFieldPath(raw.fieldPath),
    targets,
  }
}

export type EventDynamicTargetsState = {
  byEventId: Record<string, V2DynamicConfig>
}

const initialState: EventDynamicTargetsState = {
  byEventId: {},
}

export const eventDynamicTargetsSlice = createSlice({
  name: 'eventDynamicTargets',
  initialState,
  reducers: {
    setDynamicTargetsForEvent: (
      state,
      action: PayloadAction<{ eventId: string; config: V2DynamicConfig }>,
    ) => {
      state.byEventId[action.payload.eventId] = action.payload.config
    },
    removeDynamicTargetsForEvent: (state, action: PayloadAction<string>) => {
      delete state.byEventId[action.payload]
    },
    resetEventDynamicTargets: () => initialState,
  },
})

export const {
  setDynamicTargetsForEvent,
  removeDynamicTargetsForEvent,
  resetEventDynamicTargets,
} = eventDynamicTargetsSlice.actions
