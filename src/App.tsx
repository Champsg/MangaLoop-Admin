import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Loader2 } from 'lucide-react'

// Pages
import LoginPage from '@/pages/Login'
import OverviewPage from '@/pages/Overview'
import RecentUsersPage from '@/pages/RecentUsers'
import UsersPage from '@/pages/Users'
import FeatureFlagsPage from '@/pages/FeatureFlags'
import SiteNoticePage from '@/pages/SiteNotice'
import ErrorLogsPage from '@/pages/ErrorLogs'
import SettingsPage from '@/pages/Settings'
import MangaRequestsPage from '@/pages/MangaRequests'
import NotificationsPage from '@/pages/Notifications'
import CollectionsPage from '@/pages/Collections'
import ScrapbookModerationPage from '@/pages/ScrapbookModeration'
import AdminPickPage from '@/pages/AdminPick'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isAuthorized, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !isAdmin || !isAuthorized) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="requests" element={<MangaRequestsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="recent-users" element={<RecentUsersPage />} />
                <Route path="activity" element={<RecentUsersPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="scrapbook" element={<ScrapbookModerationPage />} />
                <Route path="admin-pick" element={<AdminPickPage />} />
                <Route path="feature-flags" element={<FeatureFlagsPage />} />
                <Route path="site-notice" element={<SiteNoticePage />} />
                <Route path="errors" element={<ErrorLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

