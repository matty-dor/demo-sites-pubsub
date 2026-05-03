import { useEffect, useMemo, useState } from 'react'
import { getAtPath } from '../lib/path'
import {
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  mappingRowMatches,
  OPERATOR_LABELS,
} from '../lib/ruleMatch'
import { isValidHttpUrl } from '../lib/urlValidation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
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

function parsePanelTitleSuffix(fullTitle: string, eventName: string): string {
  const prefix = `${eventName}: `
  if (fullTitle.startsWith(prefix)) {
    return fullTitle.slice(prefix.length)
  }
  return fullTitle
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
  const stored = useAppSelector((s) => s.eventDynamicRules.byEventId[eventId])
  const simData = useAppSelector((s) => s.simulator.personalizationResponse?.data)

  const [titleSuffix, setTitleSuffix] = useState('')
  const [contentSourceMode, setContentSourceMode] =
    useState<ContentSourceMode>('dynamic')
  const [fieldPath, setFieldPath] = useState('')
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
    setTitleSuffix(parsePanelTitleSuffix(normalized.title, eventName))
    setContentSourceMode(normalized.contentSourceMode)
    setFieldPath(normalized.fieldPath)
    setDynamicMappings(normalized.dynamicMappings)
    setStaticMappings(normalized.staticMappings)
    setDefaultDynamicContent(normalized.defaultDynamicContent)
    setDefaultStatic(normalized.defaultStatic)
  }, [eventId, eventName, stored])

  function validateBeforeSave(): string | null {
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
      fieldPath,
      dynamicMappings: dynamicMappings.filter((m) => m.value.trim() || m.imageUrl.trim()),
      staticMappings: staticMappings.filter((m) => m.value.trim() || m.content.trim()),
      defaultDynamicContent,
      defaultStatic,
    }
    dispatch(setRulesForEvent({ eventId, rules }))
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 2000)
  }

  const resolved = simData
  const keyVal = getAtPath(resolved, fieldPath)
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
    'Will your content contain dynamic values from your event payload, or will the content be static? For example, if an event payload contained distance_from_store, and you want that value in a string like “You are ${distance_from_store} feet from our location!”, that would be dynamic. If you want something hard-coded like “You\'re close to our store!”, that would be static.'

  return (
    <details className="mock-event-collapsible">
      <summary className="mock-event-collapsible-summary">
        Dynamic Content Rules <span className="muted">(content mappings)</span>
      </summary>
      <div className="mock-event-collapsible-inner dynamic-rules-inner">
        <p className="muted small dynamic-rules-lede">
          Map resolved API values to content. Same simulated personalization payload applies to all
          events.
        </p>

        {saveFlash && <div className="banner banner-success dynamic-rules-saved">Saved.</div>}
        {validationError && (
          <div className="banner banner-error dynamic-rules-saved">{validationError}</div>
        )}

        <label className="stack-label">
          <span>Panel title</span>
          <div className="panel-title-field">
            <span className="panel-title-prefix" title="Derived from mock event name">
              {eventName}:{' '}
            </span>
            <input
              className="input panel-title-suffix"
              value={titleSuffix}
              onChange={(e) => setTitleSuffix(e.target.value)}
              placeholder="Dynamic Hero"
              aria-label={`Panel title after ${eventName} prefix`}
            />
          </div>
          <span className="muted small panel-title-hint">
            Saved as <code>{buildPanelTitle(eventName, titleSuffix)}</code>
          </span>
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
          <span>Field path to target API Response value</span>
          <input
            className="input"
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
            placeholder="e.g. segment or recommendation.hero"
          />
        </label>

        {contentSourceMode === 'static' && (
          <>
            <h3 className="dynamic-rules-subheading">
              API Response Value and Corresponding Content
            </h3>
            {staticMappings.map((m, i) => (
              <div key={i} className="mapping-row-static">
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
                <label className="stack-label mapping-cell">
                  <span className="muted small">Example API Response Value</span>
                  <input
                    className="input"
                    placeholder="Compare to this value (e.g. luxury or 10)"
                    value={m.value}
                    onChange={(e) => {
                      const next = staticMappings.slice()
                      next[i] = { ...next[i], value: e.target.value }
                      setStaticMappings(next)
                    }}
                  />
                </label>
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
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStaticMappings([...staticMappings, emptyStaticRow()])}
            >
              Add mapping
            </button>

            <div className="default-content-block">
              <h3 className="dynamic-rules-subheading">Default Content</h3>
              <label className="stack-label">
                <span>Content Type</span>
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
              <label className="stack-label">
                <span>Content</span>
                {defaultStatic.contentType === 'text' ? (
                  <textarea
                    className="input textarea"
                    rows={4}
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
                <label className="stack-label mapping-cell">
                  <span className="muted small">Example API Response Value</span>
                  <input
                    className="input"
                    placeholder="Compare to this value"
                    value={m.value}
                    onChange={(e) => {
                      const next = dynamicMappings.slice()
                      next[i] = { ...next[i], value: e.target.value }
                      setDynamicMappings(next)
                    }}
                  />
                </label>
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
                  Resolved <code>{fieldPath || '…'}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
              </>
            ) : previewStatic.kind === 'text' ? (
              <>
                <div className="preview-text-box">{previewStatic.text}</div>
                <div className="muted small">
                  Resolved <code>{fieldPath || '…'}</code> ={' '}
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
                  Resolved <code>{fieldPath || '…'}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
              </>
            ) : (
              <div className="muted small">{previewStatic.message}</div>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}
