import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { CompaniesPage } from './pages/CompaniesPage'
import { FormsPage } from './pages/FormsPage'
import { SubmissionsPage } from './pages/SubmissionsPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { TasksPage } from './pages/TasksPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-muted/30">
        <Routes>
          {/* 認証不要のルート */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* 認証が必要なルート */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Navbar />
                <main className="max-w-7xl mx-auto px-6 py-8">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/companies" element={<CompaniesPage />} />
                    <Route path="/forms" element={<FormsPage />} />
                    <Route path="/submissions" element={<SubmissionsPage />} />
                    <Route path="/schedules" element={<SchedulesPage />} />
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                  </Routes>
                </main>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App