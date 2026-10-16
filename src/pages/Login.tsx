import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ShieldAlert, BookOpen, Loader2, KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function LoginPage() {
  const { user, isAdmin, isAuthorized, isLoading, signIn, verifyPin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (user && isAdmin && isAuthorized) {
    return <Navigate to="/" replace />
  }

  // If logged in and admin but not PIN-verified — show PIN screen
  if (user && isAdmin && !isAuthorized) {
    const handleVerify = async () => {
      setSubmitting(true)
      const ok = await verifyPin(pin)
      setSubmitting(false)
      if (!ok) toast.error('Invalid admin PIN')
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md space-y-8 rounded-2xl border border-border/50 bg-card p-8 shadow-2xl"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Verify Identity</h1>
            <p className="text-sm text-muted-foreground">Enter your 6-digit admin PIN to continue</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Access PIN
              </label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="••••••"
                maxLength={6}
                className="h-14 rounded-xl bg-secondary/50 border-none text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button
              onClick={handleVerify}
              disabled={submitting || pin.length < 4}
              className="w-full h-14 rounded-xl font-bold text-lg shadow-xl shadow-primary/20"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify'}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Authorized personnel only
          </div>
        </motion.div>
      </div>
    )
  }

  // Not logged in — show login form
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) toast.error(error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8 rounded-2xl border border-border/50 bg-card p-8 shadow-2xl"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">MangaLoop</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="admin@example.com"
              className="h-12 rounded-xl bg-secondary/50 border-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="h-12 rounded-xl bg-secondary/50 border-none"
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={submitting}
            className="w-full h-12 rounded-xl font-bold text-base shadow-xl shadow-primary/20"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <Lock className="h-4 w-4" /> Sign In
              </>
            )}
          </Button>
        </div>

        {user && !isAdmin && (
          <div className="rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
            Your account does not have admin privileges.
          </div>
        )}

        <div className="flex items-center justify-center gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          Only authorized admins can access this dashboard
        </div>
      </motion.div>
    </div>
  )
}
