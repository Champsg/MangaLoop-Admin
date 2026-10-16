import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'shujaatbhat8@gmail.com'

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isAuthorized: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  verifyPin: (pin: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data.user
      setUser(currentUser)
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .single()
        setIsAdmin(currentUser.email === ADMIN_EMAIL || !!profile?.is_admin)
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .single()
        setIsAdmin(currentUser.email === ADMIN_EMAIL || !!profile?.is_admin)
      } else {
        setIsAdmin(false)
        setIsAuthorized(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    setIsAuthorized(false)
  }

  const verifyPin = async (pin: string): Promise<boolean> => {
    if (!user || !isAdmin) return false
    const { data: isValid, error } = await supabase.rpc('verify_admin_pin', { pin_code: pin })
    if (error || !isValid) return false
    setIsAuthorized(true)
    return true
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, isAuthorized, isLoading, signIn, signOut, verifyPin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
