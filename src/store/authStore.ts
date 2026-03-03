import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AuthState {
    user: any | null
    atendente: any | null
    loading: boolean
    initialized: boolean
    signIn: () => Promise<void>
    signOut: () => Promise<void>
    refresh: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    atendente: null,
    loading: true,
    initialized: false,

    signIn: async () => {
        set({ loading: true })
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            const { data: atendente } = await supabase
                .from('atendentes')
                .select('*')
                .eq('auth_user_id', session.user.id)
                .single()

            set({ user: session.user, atendente, loading: false, initialized: true })
        } else {
            set({ user: null, atendente: null, loading: false, initialized: true })
        }
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, atendente: null })
    },

    refresh: async () => {
        await get().signIn()
    }
}))
