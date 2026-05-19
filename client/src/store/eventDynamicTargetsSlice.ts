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

export type V2MappingCondition = {
  fieldPath: string
  operator: ComparisonOperator
  value: string
}

export type V2StaticMappingRow = {
  /** All conditions must match (AND). Legacy rows migrate into a single condition. */
  conditions: V2MappingCondition[]
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
  /**
   * Deprecated: migrated into each mapping row’s `conditions`. Ignored at runtime after
   * normalization; kept so older persisted v2 configs still migrate cleanly.
   */
  fieldPath?: string
  targets: V2DynamicTarget[]
}

export function emptyV2MappingCondition(): V2MappingCondition {
  return {
    fieldPath: normalizeRulesFieldPath('segment'),
    operator: 'eq',
    value: '',
  }
}

export function emptyV2StaticMapping(): V2StaticMappingRow {
  return {
    conditions: [emptyV2MappingCondition()],
    contentType: 'text',
    content: '',
  }
}

export function createDefaultV2DynamicConfig(): V2DynamicConfig {
  return {
    contentSourceMode: 'static',
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

function normalizeV2MappingCondition(
  raw: Partial<V2MappingCondition> | undefined,
  legacyFieldPath: string,
): V2MappingCondition {
  return {
    fieldPath: normalizeRulesFieldPath(
      raw?.fieldPath && raw.fieldPath.trim() ? raw.fieldPath : legacyFieldPath,
    ),
    operator: normalizeComparisonOperator(raw?.operator),
    value: typeof raw?.value === 'string' ? raw.value : '',
  }
}

function normalizeV2StaticMappingRow(
  raw:
    | (Partial<V2StaticMappingRow> & {
        operator?: ComparisonOperator
        value?: string
      })
    | undefined,
  legacyFieldPath: string,
): V2StaticMappingRow {
  const contentType = raw?.contentType === 'imageUrl' ? 'imageUrl' : 'text'
  const content = typeof raw?.content === 'string' ? raw.content : ''

  if (Array.isArray(raw?.conditions) && raw.conditions.length > 0) {
    return {
      conditions: raw.conditions.map((c) =>
        normalizeV2MappingCondition(c, legacyFieldPath),
      ),
      contentType,
      content,
    }
  }

  if (raw && ('operator' in raw || 'value' in raw)) {
    return {
      conditions: [
        normalizeV2MappingCondition(
          {
            fieldPath: legacyFieldPath,
            operator: raw.operator,
            value: raw.value,
          },
          legacyFieldPath,
        ),
      ],
      contentType,
      content,
    }
  }

  return {
    conditions: [emptyV2MappingCondition()],
    contentType,
    content,
  }
}

export function normalizeV2DynamicConfig(
  raw: Partial<V2DynamicConfig> | undefined,
): V2DynamicConfig {
  const base = createDefaultV2DynamicConfig()
  if (!raw || typeof raw !== 'object') return base

  const legacyFieldPath = normalizeRulesFieldPath(raw.fieldPath)

  const targets: V2DynamicTarget[] = Array.isArray(raw.targets)
    ? raw.targets.map((t) => ({
        id: typeof t?.id === 'string' && t.id ? t.id : safeRandomId(),
        rowId: typeof t?.rowId === 'string' ? t.rowId : '',
        side: t?.side === 'A' || t?.side === 'B' ? t.side : null,
        staticMappings: Array.isArray(t?.staticMappings)
          ? t.staticMappings.map((m) =>
              normalizeV2StaticMappingRow(m, legacyFieldPath),
            )
          : [],
      }))
    : []

  return {
    contentSourceMode:
      raw.contentSourceMode === 'flexible' ? 'flexible' : 'static',
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
