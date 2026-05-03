import { Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { HomePage } from './pages/HomePage'
import { CreateMockEventPage } from './pages/CreateMockEventPage'
import { PersonalizationPage } from './pages/PersonalizationPage'
import { MockContentPage } from './pages/MockContentPage'

export default function App() {
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/mock-events/new" element={<CreateMockEventPage />} />
          <Route path="/mock-content" element={<MockContentPage />} />
          <Route path="/personalization" element={<PersonalizationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
