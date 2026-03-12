
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
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
import CameraRequestPage from './pages/CameraRequestPage'

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
import AdminShiftSchedule from './pages/AdminShiftSchedule'
import ShiftBookingPage from './pages/ShiftBookingPage'
import GuardLeadReportPage from './pages/GuardLeadReportPage'
import AdminCaptaciones from './pages/AdminCaptaciones'
import SalesPipeline from './pages/SalesPipeline'
import CRMActions from './pages/CRMActions'
import ManagementReportList from './pages/ManagementReportList'
import ManagementReportPage from './pages/ManagementReportPage'
import AdminVideoGenerator from './pages/AdminVideoGenerator'
import ChatwootWidget from './components/chatwoot/ChatwootWidget'
import CameraAgentActions from './components/crm/CameraAgentActions'
import AdminAuditLogs from './pages/AdminAuditLogs'
import InspectionFormPage from './pages/InspectionFormPage'
import InspectionDashboard from './pages/InspectionDashboard'
import AdminAdministradaImport from './pages/AdminAdministradaImport'
import PublicInspectionPage from './pages/PublicInspectionPage'
import { Toaster } from 'sonner'
import { initGlobalErrorCapture, auditLog } from './services/auditLogService'
import { LOGO_BASE64 } from './services/logo'

// Initialize global error capture once
initGlobalErrorCapture()

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
const MAINTENANCE_MODE = true // ← Set to false to disable maintenance screen

const Layout = ({ children }) => {
  const { user } = useAuth()

  if (MAINTENANCE_MODE) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #001a4d 0%, #003DA5 40%, #0052cc 100%)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes loading { from { margin-left: 0; } to { margin-left: 60%; } }
          @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        `}</style>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(220,20,49,0.08)' }} />

        <div style={{
          textAlign: 'center',
          color: '#fff',
          maxWidth: '520px',
          animation: 'fadeIn 0.8s ease-out',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* RE/MAX Logo */}
          <div style={{ marginBottom: '32px', animation: 'float 3s ease-in-out infinite' }}>
            <img
              src={`data:image/png;base64,${LOGO_BASE64}`}
              alt="RE/MAX Exclusive"
              style={{
                width: '160px',
                height: 'auto',
                margin: '0 auto',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
              }}
            />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '30px',
            fontWeight: 700,
            marginBottom: '16px',
            color: '#ffffff',
            letterSpacing: '0.5px',
          }}>
            Sistema en Mantenimiento
          </h1>

          {/* Divider */}
          <div style={{
            width: '60px',
            height: '3px',
            background: '#DC1431',
            margin: '0 auto 24px',
            borderRadius: '2px',
          }} />

          {/* Message */}
          <p style={{
            fontSize: '18px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '36px',
          }}>
            El sistema se encuentra en mantenimiento, todo volverá a operar con normalidad a las <strong style={{ color: '#fff', fontWeight: 700 }}>13hs</strong>.
          </p>

          {/* Loading bar */}
          <div style={{
            width: '220px',
            height: '4px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '4px',
            margin: '0 auto',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40%',
              height: '100%',
              background: 'linear-gradient(90deg, #DC1431, #ff4060)',
              borderRadius: '4px',
              animation: 'loading 1.5s ease-in-out infinite alternate',
            }} />
          </div>

          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.45)',
            marginTop: '28px',
            letterSpacing: '0.3px',
          }}>
            Gracias por su paciencia · RE/MAX Exclusive
          </p>
        </div>
      </div>
    )
  }

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

// Route change logger — logs every navigation to audit
const RouteChangeLogger = () => {
  const location = useLocation()
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      auditLog.info('navigation', 'route.change', `Navegó a ${location.pathname}`, {
        module: 'App',
        details: { from: prevPath.current, to: location.pathname }
      })
      prevPath.current = location.pathname
    }
  }, [location.pathname])

  return null
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <RouteChangeLogger />
          <Routes>
            {/* ═══ Standalone route: Inspection Form (no sidebar/header) ═══ */}
            <Route path="/inspeccion/:inspectionId" element={
              <ProtectedRoute>
                <InspectionFormPage />
              </ProtectedRoute>
            } />

            {/* ═══ Public route: External Inspection (no login) ═══ */}
            <Route path="/inspeccion-publica/:token" element={<PublicInspectionPage />} />

            {/* ═══ All other routes wrapped in Layout ═══ */}
            <Route path="/*" element={
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

                  <Route path="/request/evaluacion-comercial/:id" element={
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

                  <Route path="/request/camera-360" element={
                    <ProtectedRoute>
                      <CameraRequestPage />
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
                  <Route path="/admin/audit-logs" element={
                    <ProtectedRoute>
                      <AdminAuditLogs />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/shift-schedule" element={
                    <ProtectedRoute>
                      <AdminShiftSchedule />
                    </ProtectedRoute>
                  } />

                  <Route path="/shifts" element={
                    <ProtectedRoute>
                      <ShiftBookingPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/guard-leads" element={
                    <ProtectedRoute>
                      <GuardLeadReportPage />
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

                  <Route path="/informes-gestion" element={
                    <ProtectedRoute>
                      <ManagementReportList />
                    </ProtectedRoute>
                  } />
                  <Route path="/informes-gestion/:reportId" element={
                    <ProtectedRoute>
                      <ManagementReportPage />
                    </ProtectedRoute>
                  } />

                  {/* ═══ Inspections Dashboard ═══ */}
                  <Route path="/inspecciones" element={
                    <ProtectedRoute>
                      <InspectionDashboard />
                    </ProtectedRoute>
                  } />

                  {/* ═══ Admin: Import Administradas Excel ═══ */}
                  <Route path="/admin/import-administradas" element={
                    <ProtectedRoute>
                      <AdminAdministradaImport />
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
            } />
          </Routes>
        </Router>
        <Toaster position="top-right" richColors theme="light" closeButton className="font-sans" />
        <ChatwootWidget />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
