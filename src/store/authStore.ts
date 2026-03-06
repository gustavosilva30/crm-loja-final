import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AuthState {
    user: any | null
    atendente: any | null
    whatsappInstancia: any | null
    loading: boolean
    initialized: boolean
    signIn: () => Promise<void>
    signOut: () => Promise<void>
    refresh: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    atendente: null,
    whatsappInstancia: null,
    loading: true,
    initialized: false,

    signIn: async () => {
        set({ loading: true })
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            // 1. Tentar buscar por auth_user_id primeiro (vínculo já existente)
            let { data: atendente, error: fetchErr } = await supabase
                .from('atendentes')
                .select('*')
                .eq('auth_user_id', session.user.id)
                .maybeSingle()

            // 2. Se não achou, tentar por e-mail (vínculo inicial) - case insensitive
            if (!atendente && session.user.email) {
                const { data: foundByEmail } = await supabase
                    .from('atendentes')
                    .select('*')
                    .ilike('email', session.user.email)
                    .maybeSingle()

                if (foundByEmail) {
                    // Atualiza o atendente com o ID do usuário de auth do Supabase
                    const { data: updated } = await supabase
                        .from('atendentes')
                        .update({ auth_user_id: session.user.id })
                        .eq('id', foundByEmail.id)
                        .select()
                        .single()

                    atendente = updated
                }
            }

            let whatsappInstancia = null;
            if (atendente) {
                const { data: inst } = await supabase
                    .from('whatsapp_instancias')
                    .select('*')
                    .eq('atendente_id', atendente.id)
                    .maybeSingle()
                whatsappInstancia = inst;
            }

            set({ user: session.user, atendente, whatsappInstancia, loading: false, initialized: true })
        } else {
            set({ user: null, atendente: null, whatsappInstancia: null, loading: false, initialized: true })
        }
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, atendente: null, whatsappInstancia: null })
    },

    refresh: async () => {
        await get().signIn()
    }
}))
