import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScopePaths } from '../scope/ScopeContext'
import { DynamicContentV2Section } from './DynamicContentV2Section'
import { PageStructureEditor } from './PageStructureEditor'
import { StaticContentEditor } from './StaticContentEditor'
import {
  fieldPathSuffixFromStored,
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from '../lib/personalizationFieldPath'
import { getAtPath } from '../lib/path'
import { ConditionOperatorValueField } from './ConditionOperatorValueField'
import {
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  mappingRowMatches,
  OPERATOR_LABELS,
} from '../lib/ruleMatch'
import { isValidHttpUrl } from '../lib/urlValidation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { panelTitleSuffixFromSaved } from '../lib/panelTitle'
import {
  createDefaultDynamicRules,
  type ContentSourceMode,
  type DynamicContentState,
  type MappingRow,
  normalizeDynamicContentState,
  type StaticContentType,
  type StaticMappingRow,
  setRulesForEvent,
} from '../store/eventDynamicRulesSlice'

type Props = {
  eventId: string
  eventName: string
}

function buildPanelTitle(eventName: string, suffix: string): string {
  const t = suffix.trim()
  return t ? `${eventName}: ${t}` : `${eventName}: `
}

function emptyStaticRow(): StaticMappingRow {
  return { operator: 'eq', value: '', contentType: 'text', content: '' }
}

function emptyDynamicRow(): MappingRow {
  return { operator: 'eq', value: '', imageUrl: '' }
}

export function DynamicContentRulesSection({ eventId, eventName }: Props) {
  const dispatch = useAppDispatch()
  const { scopeId } = useScopePaths()
  const stored = useAppSelector((s) => s.eventDynamicRules.byEventId[eventId])
  const simData = useAppSelector((s) => s.simulator.personalizationResponse?.data)
  const personalizationResponse = useAppSelector(
    (s) => s.simulator.personalizationResponse,
  )
  const lastPersonalizationFetchedAt = useAppSelector(
    (s) => s.simulator.lastPersonalizationFetchedAt,
  )

  const [titleSuffix, setTitleSuffix] = useState('')
  const [contentSourceMode, setContentSourceMode] =
    useState<ContentSourceMode>('static')
  const [showPersonalizationPeek, setShowPersonalizationPeek] = useState(false)
  const [fieldPathSuffix, setFieldPathSuffix] = useState('')
  const [dynamicMappings, setDynamicMappings] = useState<MappingRow[]>(
    createDefaultDynamicRules().dynamicMappings,
  )
  const [staticMappings, setStaticMappings] = useState<StaticMappingRow[]>(
    createDefaultDynamicRules().staticMappings,
  )
  const [defaultDynamicContent, setDefaultDynamicContent] = useState('')
  const [defaultStatic, setDefaultStatic] = useState(
    createDefaultDynamicRules().defaultStatic,
  )
  const [saveFlash, setSaveFlash] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    const normalized = normalizeDynamicContentState(stored)
    setTitleSuffix(panelTitleSuffixFromSaved(normalized.title, eventName))
    setContentSourceMode(normalized.contentSourceMode)
    setFieldPathSuffix(stored ? fieldPathSuffixFromStored(normalized.fieldPath) : '')
    setDynamicMappings(normalized.dynamicMappings)
    setStaticMappings(normalized.staticMappings)
    setDefaultDynamicContent(normalized.defaultDynamicContent)
    setDefaultStatic(normalized.defaultStatic)
  }, [eventId, eventName, stored])

  function validateBeforeSave(): string | null {
    const suf = fieldPathSuffix.trim().replace(/^\.+/, '')
    if (!suf) {
      return 'Field path must include at least one segment after data. (e.g. entity_id or audiences.31325.phone)'
    }
    if (contentSourceMode === 'static') {
      for (let i = 0; i < staticMappings.length; i++) {
        const row = staticMappings[i]
        if (
          row.contentType === 'imageUrl' &&
          row.content.trim() &&
          !isValidHttpUrl(row.content)
        ) {
          return `Row ${i + 1}: Content must be a valid http(s) image URL when Content Type is Image URL.`
        }
      }
      if (
        defaultStatic.contentType === 'imageUrl' &&
        defaultStatic.content.trim() &&
        !isValidHttpUrl(defaultStatic.content)
      ) {
        return 'Default Content must be a valid http(s) URL when Content Type is Image URL.'
      }
      return null
    }
    for (let i = 0; i < dynamicMappings.length; i++) {
      const row = dynamicMappings[i]
      if (row.imageUrl.trim() && !isValidHttpUrl(row.imageUrl)) {
        return `Dynamic row ${i + 1}: Image URL must be valid http(s).`
      }
    }
    if (
      defaultDynamicContent.trim() &&
      !isValidHttpUrl(defaultDynamicContent)
    ) {
      return 'Default image URL must be a valid http(s) URL.'
    }
    return null
  }

  function saveRules() {
    setValidationError(null)
    const err = validateBeforeSave()
    if (err) {
      setValidationError(err)
      return
    }

    const rules: DynamicContentState = {
      title: buildPanelTitle(eventName, titleSuffix),
      contentSourceMode,
      fieldPath: normalizeRulesFieldPath(fieldPathSuffix),
      dynamicMappings: dynamicMappings.filter((m) => m.value.trim() || m.imageUrl.trim()),
      staticMappings: staticMappings.filter((m) => m.value.trim() || m.content.trim()),
      defaultDynamicContent,
      defaultStatic,
    }
    dispatch(setRulesForEvent({ eventId, rules }))
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 2000)
  }

  const fullFieldPath = normalizeRulesFieldPath(fieldPathSuffix)
  const resolvedRoot = wrapPersonalizationProfileRoot(simData)
  const keyVal = getAtPath(resolvedRoot, fullFieldPath)
  const keyStr = keyVal === undefined || keyVal === null ? '' : String(keyVal)

  const previewStatic = useMemo(() => {
    const row = staticMappings.find((m) =>
      mappingRowMatches(keyVal, m.operator, m.value),
    )
    let contentType = defaultStatic.contentType
    let raw = defaultStatic.content
    if (row) {
      if (row.content.trim()) {
        contentType = row.contentType
        raw = row.content
      } else {
        raw = defaultStatic.content
        contentType = defaultStatic.contentType
      }
    }
    const c = raw.trim()
    if (!c) {
      return {
        kind: 'empty' as const,
        message:
          'No content to preview for this resolved value (configure API Response mappings or Default Content).',
      }
    }
    if (contentType === 'text') {
      return { kind: 'text' as const, text: c }
    }
    if (!isValidHttpUrl(c)) {
      return { kind: 'text' as const, text: 'Invalid image URL' }
    }
    return { kind: 'image' as const, url: c }
  }, [staticMappings, defaultStatic, keyVal])

  const previewDynamicImage =
    dynamicMappings.find((m) =>
      mappingRowMatches(keyVal, m.operator, m.value),
    )?.imageUrl?.trim() ||
    defaultDynamicContent.trim() ||
    null

  const previewHint =
    'Preview uses the simulated Personalization response from the Personalization API page (local mode).'

  const radioHelp =
    'Will your content contain the value from your event payload (dynamic), or will the content be hardcoded (static)? For example, if an event payload contained "cart_subtotal," and you want that value to appear in text like “You have {{cart_subtotal}} in your cart!”, that would be dynamic. If you want something like “You\'ve qualified for free shipping!”, that would be static.'

  const innerBody = (
    <div className="mock-event-collapsible-inner dynamic-rules-inner">
        <p className="muted small dynamic-rules-lede">
          The content variations you set below will be visible on the Experiences page. When you
          trigger the event, a corresponding GrowthLoop Journey will be initiated. The Journey will
          update values on the Personalization API in real-time. When you reload the experience,
          the response from the Personalization API will dictate which content variation is
          displayed.
        </p>

        {saveFlash && <div className="banner banner-success dynamic-rules-saved">Saved.</div>}
        {validationError && (
          <div className="banner banner-error dynamic-rules-saved">{validationError}</div>
        )}

        <label className="stack-label">
          <span>Content Title</span>
          <div className="panel-title-field">
            <span className="panel-title-prefix" title="Derived from event name">
              {eventName}:{' '}
            </span>
            <input
              className="input panel-title-suffix"
              value={titleSuffix}
              onChange={(e) => setTitleSuffix(e.target.value)}
              placeholder="Dynamic Hero"
              aria-label={`Content title after ${eventName} prefix`}
            />
          </div>
        </label>

        <fieldset className="content-source-fieldset">
          <legend className="content-source-legend">Content source</legend>
          <p className="muted small content-source-help">{radioHelp}</p>
          <div className="radio-row">
            <label className="radio-option">
              <input
                type="radio"
                name={`content-source-${eventId}`}
                checked={contentSourceMode === 'static'}
                onChange={() => setContentSourceMode('static')}
              />
              Static
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name={`content-source-${eventId}`}
                checked={contentSourceMode === 'dynamic'}
                onChange={() => setContentSourceMode('dynamic')}
              />
              Dynamic
            </label>
          </div>
        </fieldset>

        <label className="stack-label">
          <div className="stack-label-row field-path-label-row">
            <span>Field path to target API Response value</span>
            <button
              type="button"
              className="link-button field-path-peek-toggle"
              aria-expanded={showPersonalizationPeek}
              onClick={(e) => {
                e.preventDefault()
                setShowPersonalizationPeek((v) => !v)
              }}
            >
              {showPersonalizationPeek ? 'Hide' : 'Display'} the most recent Personalization API
              response
            </button>
          </div>
          {showPersonalizationPeek && (
            <div className="field-path-personalization-peek">
              {lastPersonalizationFetchedAt && personalizationResponse ?
                <pre className="result-block field-path-peek-pre">
                  {JSON.stringify(personalizationResponse, null, 2)}
                </pre>
              : <p className="muted small field-path-peek-empty">
                  No recent Personalization API response yet.{' '}
                  <Link to="/personalization" className="link-inline">
                    Click here to call the Personalization API.
                  </Link>
                </p>
              }
            </div>
          )}
          <div className="panel-title-field">
            <span className="panel-title-prefix" title="Always under the response data object">
              data.
            </span>
            <input
              className="input panel-title-suffix"
              value={fieldPathSuffix}
              onChange={(e) => setFieldPathSuffix(e.target.value)}
              placeholder="Refer to a Personalization API response to insert the proper field path."
              aria-label="Dot path under data (after data. prefix)"
              autoComplete="off"
            />
          </div>
        </label>

        {contentSourceMode === 'static' && (
          <>
            <h3 className="dynamic-rules-subheading">Content Variations</h3>

            <div className="default-content-block">
              <h4 className="dynamic-rules-variation-heading">Default Content</h4>
              <div className="mapping-row-static default-content-row">
                <label className="stack-label mapping-cell">
                  <span className="muted small">Content Type</span>
                  <select
                    className="input"
                    value={defaultStatic.contentType}
                    onChange={(e) =>
                      setDefaultStatic((d) => ({
                        ...d,
                        contentType: e.target.value as StaticContentType,
                      }))
                    }
                  >
                    <option value="text">Text</option>
                    <option value="imageUrl">Image URL</option>
                  </select>
                </label>
                <label className="stack-label mapping-cell">
                  <span className="muted small">Content</span>
                  {defaultStatic.contentType === 'text' ? (
                    <textarea
                      className="input textarea textarea-compact"
                      rows={3}
                      placeholder="Place content here"
                      value={defaultStatic.content}
                      onChange={(e) =>
                        setDefaultStatic((d) => ({ ...d, content: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      className={`input ${defaultStatic.content.trim() && !isValidHttpUrl(defaultStatic.content) ? 'input-invalid' : ''}`}
                      type="url"
                      inputMode="url"
                      placeholder="Place content here"
                      value={defaultStatic.content}
                      onChange={(e) =>
                        setDefaultStatic((d) => ({ ...d, content: e.target.value }))
                      }
                    />
                  )}
                </label>
              </div>
            </div>

            {staticMappings.map((m, i) => (
              <div key={i} className="content-variation-block">
                <div className="content-variation-head">
                  <h4 className="dynamic-rules-variation-heading">
                    Content Variation {i + 1}
                  </h4>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    aria-label={`Remove Content Variation ${i + 1}`}
                    onClick={() => {
                      setStaticMappings((prev) => prev.filter((_, idx) => idx !== i))
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div className="mapping-row-static">
                  <label className="stack-label mapping-cell">
                    <span className="muted small">Operator</span>
                    <select
                      className="input"
                      value={m.operator}
                      onChange={(e) => {
                        const next = staticMappings.slice()
                        next[i] = {
                          ...next[i],
                          operator: e.target.value as ComparisonOperator,
                        }
                        setStaticMappings(next)
                      }}
                    >
                      {COMPARISON_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ConditionOperatorValueField
                    operator={m.operator}
                    value={m.value}
                    onChange={(value) => {
                      const next = staticMappings.slice()
                      next[i] = { ...next[i], value }
                      setStaticMappings(next)
                    }}
                  />
                  <label className="stack-label mapping-cell">
                    <span className="muted small">Content Type</span>
                    <select
                      className="input"
                      value={m.contentType}
                      onChange={(e) => {
                        const next = staticMappings.slice()
                        next[i] = {
                          ...next[i],
                          contentType: e.target.value as StaticContentType,
                        }
                        setStaticMappings(next)
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="imageUrl">Image URL</option>
                    </select>
                  </label>
                  <label className="stack-label mapping-cell">
                    <span className="muted small">Content</span>
                    {m.contentType === 'text' ? (
                      <textarea
                        className="input textarea textarea-compact"
                        rows={3}
                        placeholder="Place content here"
                        value={m.content}
                        onChange={(e) => {
                          const next = staticMappings.slice()
                          next[i] = { ...next[i], content: e.target.value }
                          setStaticMappings(next)
                        }}
                      />
                    ) : (
                      <input
                        className={`input ${m.content.trim() && !isValidHttpUrl(m.content) ? 'input-invalid' : ''}`}
                        type="url"
                        inputMode="url"
                        placeholder="Place content here"
                        value={m.content}
                        onChange={(e) => {
                          const next = staticMappings.slice()
                          next[i] = { ...next[i], content: e.target.value }
                          setStaticMappings(next)
                        }}
                      />
                    )}
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStaticMappings([...staticMappings, emptyStaticRow()])}
            >
              Add mapping
            </button>
          </>
        )}

        {contentSourceMode === 'dynamic' && (
          <>
            <h3 className="dynamic-rules-subheading">Value → Image URL</h3>
            {dynamicMappings.map((m, i) => (
              <div key={i} className="mapping-row-dynamic">
                <label className="stack-label mapping-cell">
                  <span className="muted small">Operator</span>
                  <select
                    className="input"
                    value={m.operator}
                    onChange={(e) => {
                      const next = dynamicMappings.slice()
                      next[i] = {
                        ...next[i],
                        operator: e.target.value as ComparisonOperator,
                      }
                      setDynamicMappings(next)
                    }}
                  >
                    {COMPARISON_OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </option>
                    ))}
                  </select>
                </label>
                <ConditionOperatorValueField
                  operator={m.operator}
                  value={m.value}
                  compact
                  onChange={(value) => {
                    const next = dynamicMappings.slice()
                    next[i] = { ...next[i], value }
                    setDynamicMappings(next)
                  }}
                />
                <label className="stack-label mapping-cell">
                  <span className="muted small">Image URL</span>
                  <input
                    className={`input ${m.imageUrl.trim() && !isValidHttpUrl(m.imageUrl) ? 'input-invalid' : ''}`}
                    type="url"
                    placeholder="https://…"
                    value={m.imageUrl}
                    onChange={(e) => {
                      const next = dynamicMappings.slice()
                      next[i] = { ...next[i], imageUrl: e.target.value }
                      setDynamicMappings(next)
                    }}
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDynamicMappings([...dynamicMappings, emptyDynamicRow()])
              }
            >
              Add mapping
            </button>

            <label className="stack-label default-dynamic-wrap">
              <span>Default image URL</span>
              <input
                className={`input ${defaultDynamicContent.trim() && !isValidHttpUrl(defaultDynamicContent) ? 'input-invalid' : ''}`}
                type="url"
                value={defaultDynamicContent}
                onChange={(e) => setDefaultDynamicContent(e.target.value)}
                placeholder="https://..."
              />
            </label>
          </>
        )}

        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={saveRules}>
            Save rules
          </button>
        </div>

        <div className="dynamic-rules-preview">
          <div className="muted small">{previewHint}</div>
          <div className="preview-stage preview-stage-compact">
            {contentSourceMode === 'dynamic' ? (
              <>
                <img
                  src={
                    previewDynamicImage ||
                    'https://via.placeholder.com/640x360?text=Configure+images'
                  }
                  alt=""
                  className="preview-image preview-image-compact"
                />
                <div className="muted small">
                  Resolved <code>{fullFieldPath}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
              </>
            ) : previewStatic.kind === 'text' ? (
              <>
                <div className="preview-text-box">{previewStatic.text}</div>
                <div className="muted small">
                  Resolved <code>{fullFieldPath}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
              </>
            ) : previewStatic.kind === 'image' ? (
              <>
                <img
                  src={previewStatic.url}
                  alt=""
                  className="preview-image preview-image-compact"
                />
                <div className="muted small">
                  Resolved <code>{fullFieldPath}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
              </>
            ) : (
              <div className="muted small">{previewStatic.message}</div>
            )}
          </div>
        </div>
    </div>
  )

  if (scopeId === 'v2') {
    return (
      <details className="mock-event-collapsible">
        <summary className="mock-event-collapsible-summary">Content</summary>
        <div className="mock-event-collapsible-inner v2-content-inner">
          <details className="mock-event-collapsible">
            <summary className="mock-event-collapsible-summary">Page Structure</summary>
            <div className="mock-event-collapsible-inner">
              <PageStructureEditor eventId={eventId} />
            </div>
          </details>
          <details className="mock-event-collapsible">
            <summary className="mock-event-collapsible-summary">Static Content</summary>
            <div className="mock-event-collapsible-inner">
              <StaticContentEditor eventId={eventId} />
            </div>
          </details>
          <details className="mock-event-collapsible">
            <summary className="mock-event-collapsible-summary">Dynamic Content</summary>
            <DynamicContentV2Section eventId={eventId} />
          </details>
        </div>
      </details>
    )
  }

  return (
    <details className="mock-event-collapsible">
      <summary className="mock-event-collapsible-summary">Dynamic Content Rules</summary>
      {innerBody}
    </details>
  )
}
