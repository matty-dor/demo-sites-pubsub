import { Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { HomePage } from './pages/HomePage'
import { CreateMockEventPage } from './pages/CreateMockEventPage'
import { EditMockEventPage } from './pages/EditMockEventPage'
import { PersonalizationPage } from './pages/PersonalizationPage'
import { GrowthLoopApiPage } from './pages/GrowthLoopApiPage'
import { MockContentPage } from './pages/MockContentPage'
import { V2ScopeLayout } from './scope/V2ScopeLayout'

export default function App() {
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/mock-events/new" element={<CreateMockEventPage />} />
          <Route path="/mock-events/:id/edit" element={<EditMockEventPage />} />
          <Route path="/mock-content" element={<MockContentPage />} />

          <Route element={<V2ScopeLayout />}>
            <Route path="/v2" element={<HomePage />} />
            <Route path="/v2/events/new" element={<CreateMockEventPage />} />
            <Route path="/v2/events/:id/edit" element={<EditMockEventPage />} />
            <Route path="/v2/content" element={<MockContentPage />} />
          </Route>

          <Route path="/personalization" element={<PersonalizationPage />} />
          <Route path="/growthloop-api" element={<GrowthLoopApiPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
