import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { normalizeRulesFieldPath } from '../lib/personalizationFieldPath'
import {
  normalizeComparisonOperator,
  type ComparisonOperator,
} from '../lib/ruleMatch'

export type { ComparisonOperator }

export type MappingRow = {
  operator: ComparisonOperator
  value: string
  imageUrl: string
}

export type StaticContentType = 'text' | 'imageUrl'

export type StaticMappingRow = {
  operator: ComparisonOperator
  value: string
  contentType: StaticContentType
  content: string
}

export type ContentSourceMode = 'static' | 'dynamic'

export type DynamicContentState = {
  title: string
  contentSourceMode: ContentSourceMode
  fieldPath: string
  dynamicMappings: MappingRow[]
  staticMappings: StaticMappingRow[]
  /** Used when `contentSourceMode` is `dynamic` (image URLs). */
  defaultDynamicContent: string
  /** Used when `contentSourceMode` is `static`. */
  defaultStatic: {
    contentType: StaticContentType
    content: string
  }
}

/** Legacy persisted shape before static/dynamic modes */
export type LegacyDynamicContentState = {
  title?: string
  fieldPath?: string
  defaultImageUrl?: string
  mappings?: Array<{ value: string; imageUrl: string }>
}

export function createDefaultDynamicRules(): DynamicContentState {
  return {
    title: 'Dynamic hero',
    contentSourceMode: 'dynamic',
    fieldPath: normalizeRulesFieldPath('segment'),
    dynamicMappings: [
      { operator: 'eq', value: '', imageUrl: '' },
      { operator: 'eq', value: '', imageUrl: '' },
    ],
    staticMappings: [
      { operator: 'eq', value: '', contentType: 'text', content: '' },
      { operator: 'eq', value: '', contentType: 'text', content: '' },
    ],
    defaultDynamicContent: '',
    defaultStatic: { contentType: 'text', content: '' },
  }
}

export function normalizeDynamicContentState(
  raw: Partial<DynamicContentState> | LegacyDynamicContentState | undefined,
): DynamicContentState {
  const base = createDefaultDynamicRules()
  if (!raw || typeof raw !== 'object') return base

  if ('contentSourceMode' in raw && raw.contentSourceMode) {
    const r = raw as DynamicContentState
    return {
      ...base,
      ...r,
      fieldPath: normalizeRulesFieldPath(r.fieldPath),
      dynamicMappings:
        r.dynamicMappings?.length ?
          r.dynamicMappings.map((m) => ({
            ...m,
            operator: normalizeComparisonOperator(m.operator),
          }))
        : base.dynamicMappings,
      staticMappings:
        r.staticMappings?.length ?
          r.staticMappings.map((m) => ({
            ...m,
            operator: normalizeComparisonOperator(m.operator),
          }))
        : base.staticMappings,
      defaultStatic: r.defaultStatic ?? base.defaultStatic,
      defaultDynamicContent: r.defaultDynamicContent ?? base.defaultDynamicContent,
    }
  }

  const leg = raw as LegacyDynamicContentState
  const dm =
    leg.mappings?.length ?
      leg.mappings.map((m) => ({
        operator: normalizeComparisonOperator(
          'operator' in m ?
            (m as Partial<MappingRow>).operator
          : undefined,
        ),
        value: m.value,
        imageUrl: m.imageUrl,
      }))
    : base.dynamicMappings
  const defImg = leg.defaultImageUrl ?? ''
  return {
    ...base,
    title: leg.title ?? base.title,
    fieldPath: normalizeRulesFieldPath(leg.fieldPath ?? base.fieldPath),
    contentSourceMode: 'dynamic',
    dynamicMappings: dm,
    staticMappings: base.staticMappings,
    defaultDynamicContent: defImg,
    defaultStatic: {
      contentType: 'imageUrl',
      content: defImg,
    },
  }
}

export type EventDynamicRulesState = {
  byEventId: Record<string, DynamicContentState>
}

const initialState: EventDynamicRulesState = {
  byEventId: {},
}

export const eventDynamicRulesSlice = createSlice({
  name: 'eventDynamicRules',
  initialState,
  reducers: {
    setRulesForEvent: (
      state,
      action: PayloadAction<{ eventId: string; rules: DynamicContentState }>,
    ) => {
      state.byEventId[action.payload.eventId] = action.payload.rules
    },
    removeRulesForEvent: (state, action: PayloadAction<string>) => {
      delete state.byEventId[action.payload]
    },
    resetEventDynamicRules: () => initialState,
  },
})

export const { setRulesForEvent, removeRulesForEvent, resetEventDynamicRules } =
  eventDynamicRulesSlice.actions
