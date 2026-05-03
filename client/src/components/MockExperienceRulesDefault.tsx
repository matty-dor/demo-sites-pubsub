import { isValidHttpUrl } from '../lib/urlValidation'
import {
  normalizeDynamicContentState,
  type DynamicContentState,
} from '../store/eventDynamicRulesSlice'

type Props = {
  rules: DynamicContentState
}

export function MockExperienceRulesDefault({ rules }: Props) {
  const r = normalizeDynamicContentState(rules)

  if (r.contentSourceMode === 'static') {
    const { contentType, content } = r.defaultStatic
    const trimmed = content.trim()
    if (!trimmed) {
      return (
        <p className="muted small mock-experience-default-empty">
          No default content saved yet.
        </p>
      )
    }
    if (contentType === 'imageUrl') {
      if (isValidHttpUrl(trimmed)) {
        return (
          <div className="mock-experience-default-block">
            <div className="muted small mock-experience-default-label">Default content</div>
            <img src={trimmed} alt="" className="mock-experience-default-img" />
          </div>
        )
      }
      return (
        <div className="mock-experience-default-block">
          <div className="muted small mock-experience-default-label">Default content (image URL)</div>
          <code className="mock-experience-default-raw">{trimmed}</code>
        </div>
      )
    }
    return (
      <div className="mock-experience-default-block">
        <div className="muted small mock-experience-default-label">Default content</div>
        <div className="preview-text-box mock-experience-default-text">{trimmed}</div>
      </div>
    )
  }

  const url = r.defaultDynamicContent.trim()
  if (!url) {
    return (
      <p className="muted small mock-experience-default-empty">No default image URL saved yet.</p>
    )
  }
  if (isValidHttpUrl(url)) {
    return (
      <div className="mock-experience-default-block">
        <div className="muted small mock-experience-default-label">Default image URL</div>
        <img src={url} alt="" className="mock-experience-default-img" />
      </div>
    )
  }
  return (
    <div className="mock-experience-default-block">
      <div className="muted small mock-experience-default-label">Default image URL</div>
      <code className="mock-experience-default-raw">{url}</code>
    </div>
  )
}
