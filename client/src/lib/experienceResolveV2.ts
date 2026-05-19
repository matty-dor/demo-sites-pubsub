import type {
  V2DynamicTarget,
  V2DynamicTargetSide,
} from '../store/eventDynamicTargetsSlice'
import type {
  StaticBlockContent,
  StaticContent,
} from '../store/staticContentSlice'
import { interpolateApiValues } from './apiValueTemplate'
import {
  firstActiveConditionValue,
  mappingConditionsMatch,
  resolvedValuesByPathSuffix,
} from './mappingConditions'
import { isValidHttpUrl } from './urlValidation'

export type V2CellResolved =
  | {
      kind: 'text'
      source: 'matched' | 'default'
      text: string
    }
  | {
      kind: 'image'
      source: 'matched' | 'default'
      url: string
    }
  | {
      kind: 'invalidImage'
      source: 'matched' | 'default'
    }
  | {
      kind: 'empty'
      placeholder: string
    }

export type ResolveV2CellOptions = {
  /** Skip dynamic mappings and resolve from Static Content only (used for the default view). */
  forceDefault?: boolean
}

export function blockIndexForSide(side: V2DynamicTargetSide): number {
  return side === 'B' ? 1 : 0
}

export function staticBlockFor(
  staticContent: StaticContent | undefined,
  rowId: string,
  side: V2DynamicTargetSide,
): StaticBlockContent | undefined {
  if (!staticContent) return undefined
  const blocks = staticContent.byRowId[rowId]
  if (!blocks) return undefined
  return blocks[blockIndexForSide(side)]
}

function fromStaticBlock(
  staticBlock: StaticBlockContent | undefined,
  cellLabel: string,
  source: 'matched' | 'default' = 'default',
): V2CellResolved {
  if (!staticBlock) return { kind: 'empty', placeholder: cellLabel }
  const c = staticBlock.content.trim()
  if (!c) return { kind: 'empty', placeholder: cellLabel }
  if (staticBlock.contentType === 'text') {
    return { kind: 'text', source, text: c }
  }
  if (!isValidHttpUrl(c)) return { kind: 'invalidImage', source }
  return { kind: 'image', source, url: c }
}

/**
 * Resolve the rendered content for a single page-structure cell using v2 rules:
 *   1. If `forceDefault` is false and a dynamic target is configured for this cell, evaluate
 *      its mappings (all conditions per variation must match); first match wins.
 *   2. Otherwise (or if no mapping matches), fall back to the corresponding Static Content
 *      block.
 *   3. Otherwise return an empty placeholder using `cellLabel`.
 */
export function resolveV2Cell(
  target: V2DynamicTarget | undefined,
  staticBlock: StaticBlockContent | undefined,
  personalizationData: unknown,
  cellLabel: string,
  options?: ResolveV2CellOptions,
): V2CellResolved {
  const forceDefault = options?.forceDefault === true
  if (!forceDefault && target) {
    const match = target.staticMappings.find((m) =>
      mappingConditionsMatch(personalizationData, m.conditions),
    )
    if (match && match.content.trim()) {
      const c = match.content.trim()
      if (match.contentType === 'text') {
        const valuesBySuffix = resolvedValuesByPathSuffix(
          personalizationData,
          match.conditions,
        )
        const firstVal = firstActiveConditionValue(
          personalizationData,
          match.conditions,
        )
        return {
          kind: 'text',
          source: 'matched',
          text: interpolateApiValues(c, valuesBySuffix, firstVal),
        }
      }
      if (!isValidHttpUrl(c)) return { kind: 'invalidImage', source: 'matched' }
      return { kind: 'image', source: 'matched', url: c }
    }
  }
  return fromStaticBlock(staticBlock, cellLabel, 'default')
}
