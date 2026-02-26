
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RequestForm from './pages/RequestForm'
import NewRequestSelection from './pages/NewRequestSelection'
import ContractForm from './pages/ContractForm'
import AdminInvites from './pages/AdminInvites'
import ForgotPassword from './pages/ForgotPassword'
import UpdatePassword from './pages/UpdatePassword'
import AgentLeadView from './pages/AgentLeadView'
import InvoiceForm from './pages/InvoiceForm'
import AdminRequests from './pages/AdminRequests'
import AdminPropertyImport from './pages/AdminPropertyImport'
import LeadDetail from './pages/LeadDetail'
import WeeklyKpiForm from './components/kpi/WeeklyKpiForm'
import EvaluacionComercialForm from './pages/EvaluacionComercialForm'

import KpiDashboard from './components/kpi/KpiDashboard'
import AdminKpiView from './components/kpi/AdminKpiView'
import BusinessPlan from './pages/kpi/BusinessPlan'
import CRM from './pages/CRM'
import ContactDetail from './components/crm/ContactDetail'
import PropertyDetail from './components/crm/PropertyDetail'
import PropertyMapPage from './pages/PropertyMapPage'
import DocumentsHub from './pages/DocumentsHub'
import AgentDocuments from './pages/AgentDocuments'
import CalendarPage from './pages/Calendar'
import VirtualClassroom from './pages/VirtualClassroom'
import AdminVirtualClassroom from './pages/AdminVirtualClassroom'
import Casilla from './pages/Casilla'
import NewMandate from './pages/crm/NewMandate'
import AdminCameraSchedule from './pages/AdminCameraSchedule'
import AdminCaptaciones from './pages/AdminCaptaciones'
import SalesPipeline from './pages/SalesPipeline'
import CRMActions from './pages/CRMActions'
import AdminVideoGenerator from './pages/AdminVideoGenerator'
import ChatwootWidget from './components/chatwoot/ChatwootWidget'
import CameraAgentActions from './components/crm/CameraAgentActions'
import { Toaster } from 'sonner'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />

  // Force profile completion
  const isProfileComplete = profile?.first_name && profile?.last_name && profile?.phone
  if (!isProfileComplete && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ message: 'Por favor completa tu perfil para continuar.' }} />
  }

  return children
}

// Layout Wrapper
const Layout = ({ children }) => {
  const { user } = useAuth()

  return (
    <div className="h-screen w-full bg-[#f8f9fc] dark:bg-[#030712] flex overflow-hidden relative isolate selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-400/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-400/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
      </div>

      {user && <Sidebar />}

      <div className="flex-1 flex flex-col h-full relative z-10 w-full min-w-0 max-w-[1920px] mx-auto">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
      {user && <CameraAgentActions />}
    </div>
  )
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />

              <Route path="/calendar" element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              } />

              <Route path="/casilla" element={
                <ProtectedRoute>
                  <Casilla />
                </ProtectedRoute>
              } />

              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />

              <Route path="/new-request" element={
                <ProtectedRoute>
                  <NewRequestSelection />
                </ProtectedRoute>
              } />

              <Route path="/request/payment/new" element={
                <ProtectedRoute>
                  <RequestForm />
                </ProtectedRoute>
              } />

              <Route path="/request/contract/new" element={
                <ProtectedRoute>
                  <ContractForm />
                </ProtectedRoute>
              } />

              <Route path="/request/contract/:id" element={
                <ProtectedRoute>
                  <ContractForm />
                </ProtectedRoute>
              } />

              <Route path="/request/evaluacion-comercial/new" element={
                <ProtectedRoute>
                  <EvaluacionComercialForm />
                </ProtectedRoute>
              } />

              <Route path="/request/:id" element={
                <ProtectedRoute>
                  <RequestForm />
                </ProtectedRoute>
              } />

              <Route path="/request/invoice/new" element={
                <ProtectedRoute>
                  <InvoiceForm />
                </ProtectedRoute>
              } />

              <Route path="/request/invoice/:id" element={
                <ProtectedRoute>
                  <InvoiceForm />
                </ProtectedRoute>
              } />



              <Route path="/admin/invites" element={
                <ProtectedRoute>
                  <AdminInvites />
                </ProtectedRoute>
              } />

              <Route path="/admin/requests" element={
                <ProtectedRoute>
                  <AdminRequests />
                </ProtectedRoute>
              } />
              <Route path="/admin/kpis" element={
                <ProtectedRoute>
                  <AdminKpiView />
                </ProtectedRoute>
              } />
              <Route path="/admin/import" element={
                <ProtectedRoute>
                  <AdminPropertyImport />
                </ProtectedRoute>
              } />
              <Route path="/admin/camera-schedule" element={
                <ProtectedRoute>
                  <AdminCameraSchedule />
                </ProtectedRoute>
              } />
              <Route path="/admin/captaciones" element={
                <ProtectedRoute>
                  <AdminCaptaciones />
                </ProtectedRoute>
              } />

              <Route path="/crm" element={
                <ProtectedRoute>
                  <CRM />
                </ProtectedRoute>
              } />

              <Route path="/crm/actions" element={
                <ProtectedRoute>
                  <CRMActions />
                </ProtectedRoute>
              } />

              <Route path="/crm/pipeline" element={
                <ProtectedRoute>
                  <SalesPipeline />
                </ProtectedRoute>
              } />

              <Route path="/crm/contact/:id" element={
                <ProtectedRoute>
                  <ContactDetail />
                </ProtectedRoute>
              } />

              <Route path="/crm/property/:id" element={
                <ProtectedRoute>
                  <PropertyDetail />
                </ProtectedRoute>
              } />

              <Route path="/crm/map" element={
                <ProtectedRoute>
                  <PropertyMapPage />
                </ProtectedRoute>
              } />

              <Route path="/new-mandate" element={
                <ProtectedRoute>
                  <NewMandate />
                </ProtectedRoute>
              } />

              <Route path="/documents" element={
                <ProtectedRoute>
                  <DocumentsHub />
                </ProtectedRoute>
              } />

              <Route path="/my-documents" element={
                <ProtectedRoute>
                  <AgentDocuments />
                </ProtectedRoute>
              } />

              {/* KPI Routes */}
              <Route path="/kpis/entry" element={
                <ProtectedRoute>
                  <WeeklyKpiForm />
                </ProtectedRoute>
              } />

              <Route path="/kpis/dashboard" element={
                <ProtectedRoute>
                  <KpiDashboard />
                </ProtectedRoute>
              } />
              <Route path="/kpis/business-plan" element={
                <ProtectedRoute>
                  <BusinessPlan />
                </ProtectedRoute>
              } />

              {/* Public Route for Lead Assignment */}
              <Route path="/busqueda/:id" element={<LeadDetail />} />

              {/* Public Route for Agents to View Lead */}
              <Route path="/nuevolead/:id" element={<AgentLeadView />} />

              {/* Public Route for Agents to View Lead */}
              <Route path="/nuevolead/:id" element={<AgentLeadView />} />

              {/* Aula Virtual Routes */}
              <Route path="/aula-virtual" element={
                <ProtectedRoute>
                  <VirtualClassroom />
                </ProtectedRoute>
              } />
              <Route path="/admin/aula-virtual" element={
                <ProtectedRoute>
                  <AdminVirtualClassroom />
                </ProtectedRoute>
              } />
              <Route path="/admin/video-generator" element={
                <ProtectedRoute>
                  <AdminVideoGenerator />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
        <Toaster position="top-right" richColors theme="light" closeButton className="font-sans" />
        <ChatwootWidget />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
