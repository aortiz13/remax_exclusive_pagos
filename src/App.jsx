
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/layout/Header'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RequestForm from './pages/RequestForm'
import AdminInvites from './pages/AdminInvites'


// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Layout Wrapper
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>

    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

            <Route path="/new-request" element={
              <ProtectedRoute>
                <RequestForm />
              </ProtectedRoute>
            } />

            <Route path="/request/:id" element={
              <ProtectedRoute>
                <RequestForm />
              </ProtectedRoute>
            } />

            <Route path="/admin/invites" element={
              <ProtectedRoute>
                <AdminInvites />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App
