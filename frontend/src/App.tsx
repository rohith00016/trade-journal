import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/auth-context'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { AppShell } from '@/components/shared/app-shell'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { JournalPage } from '@/features/journal/journal-page'
import { StrategiesPage } from '@/features/strategies/strategies-page'
import { AnalyticsPage } from '@/features/analytics/analytics-page'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="journal" element={<JournalPage />} />
                <Route path="strategies" element={<StrategiesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route
                  path="day-review"
                  element={<Navigate to="/journal?new=not-taken" replace />}
                />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
