import { useCallback, useState } from 'react'
import { persistor } from '../store'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch } from '../store/hooks'
import { resetMockEvents } from '../store/mockEventsSlice'
import { resetEventDynamicRules } from '../store/eventDynamicRulesSlice'
import { resetSimulator } from '../store/simulatorSlice'

export function DemoResetButton() {
  const dispatch = useAppDispatch()
  const [busy, setBusy] = useState(false)

  const backend = backendStorageEnabled()

  const reset = useCallback(async () => {
    if (
      !window.confirm(
        'Clear all mock events, dynamic content rules, and simulated personalization data in this browser?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      dispatch(resetMockEvents())
      dispatch(resetEventDynamicRules())
      dispatch(resetSimulator())
      await persistor.flush()
    } finally {
      setBusy(false)
    }
  }, [dispatch])

  if (backend) return null

  return (
    <button
      type="button"
      className="btn btn-ghost demo-reset"
      disabled={busy}
      onClick={() => void reset()}
      title="Clears Redux state and localStorage for this demo"
    >
      Reset demo data
    </button>
  )
}
