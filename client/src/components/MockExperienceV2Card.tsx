import { backendStorageEnabled } from '../config/storageMode'
import { getEventThemeStyle } from '../lib/eventTheme'
import { useMockEventPublish } from '../hooks/useMockEventPublish'
import { withEventTypeFirst } from '../lib/eventTypePayload'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import type { V2DynamicConfig } from '../store/eventDynamicTargetsSlice'
import { useAppSelector } from '../store/hooks'
import type { PageStructureRow } from '../store/pageStructureSlice'
import type { StaticContent } from '../store/staticContentSlice'
import type { SchemaNode } from '../types/schema'
import { MockExperienceV2LiveRegion } from './MockExperienceV2LiveRegion'

type Props = {
  eventId: string
  eventName: string
  eventSchema: SchemaNode[]
  rows: PageStructureRow[]
  staticContent: StaticContent | undefined
  dynamicConfig: V2DynamicConfig | undefined
}

export function MockExperienceV2Card({
  eventId,
  eventName,
  eventSchema,
  rows,
  staticContent,
  dynamicConfig,
}: Props) {
  const backend = backendStorageEnabled()
  const payload = useAppSelector(
    (s) => s.eventPayloads.byEventId[eventId],
  )
  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  const handleTrigger = () => {
    const raw = payload ?? buildDefaultPayload(eventSchema, eventName)
    const aligned = withEventTypeFirst(
      eventName,
      alignPayloadToMockSchema(eventSchema, raw),
    )
    triggerPublish(eventId, aligned, eventName)
  }

  // Click handler for the trigger button placed inside <summary>.
  // Prevents the default <details> toggle while still firing the trigger.
  const handleSummaryTrigger = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    handleTrigger()
  }

  return (
    <details
      className="card mock-experience-card mock-experience-v2-card"
      style={getEventThemeStyle(eventId)}
      open
    >
      <summary className="mock-experience-v2-summary">
        <div className="mock-experience-v2-summary-inner">
          <span className="mock-experience-v2-disclosure" aria-hidden="true" />
          <div className="mock-experience-v2-summary-titles">
            <h2 className="mock-experience-card-event-name">
              Event Name: {eventName}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-primary mock-experience-v2-summary-trigger"
            disabled={backend && publishPending}
            onClick={handleSummaryTrigger}
          >
            Trigger {eventName} Event
          </button>
        </div>
      </summary>

      <div className="mock-experience-v2-body">
        <MockExperienceV2LiveRegion
          eventId={eventId}
          eventName={eventName}
          eventSchema={eventSchema}
          rows={rows}
          staticContent={staticContent}
          dynamicConfig={dynamicConfig}
        />

        {publishStatus[eventId] && (
          <details className="mock-event-collapsible">
            <summary className="mock-event-collapsible-summary">
              Trigger result <span className="muted">(JSON)</span>
            </summary>
            <pre className="result-block mock-event-collapsible-pre">
              {publishStatus[eventId]}
            </pre>
          </details>
        )}
      </div>
    </details>
  )
}
