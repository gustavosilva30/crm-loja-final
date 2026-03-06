import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle2, AlertCircle, ShoppingBag, Package } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface Notification {
    id: string
    title: string
    message: string
    type: 'sale' | 'stock' | 'system'
    time: string
    read: boolean
}

export function NotificationsCenter() {
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])

    useEffect(() => {
        // Simulated dynamic notifications based on real DB checks could go here.
        // We'll hydrate with some mock data that would otherwise be fetched via Supabase real-time
        const fetchNotifications = async () => {
            try {
                const { count: lowStock } = await supabase.from('produtos').select('*', { count: 'exact', head: true }).lte('estoque_atual', 5)
                const { data: recentSales } = await supabase.from('vendas').select('id, total').order('data_venda', { ascending: false }).limit(2)

                const notifs: Notification[] = []

                if (lowStock && lowStock > 0) {
                    notifs.push({
                        id: 'stock-alert',
                        title: 'Estoque Crítico',
                        message: `${lowStock} produtos estão abaixo do mínimo permitido.`,
                        type: 'stock',
                        time: 'Agora',
                        read: false
                    })
                }

                if (recentSales) {
                    recentSales.forEach(s => {
                        notifs.push({
                            id: `sale-${s.id}`,
                            title: 'Nova Venda Concluída',
                            message: `A venda #${s.id} no valor de R$ ${s.total} foi registrada.`,
                            type: 'sale',
                            time: 'Hoje',
                            read: false
                        })
                    })
                }

                notifs.push({
                    id: 'sys-1',
                    title: 'Bem-vindo ao novo CRM',
                    message: 'A interface foi atualizada para a versão Enterprise.',
                    type: 'system',
                    time: 'Hoje',
                    read: true
                })

                setNotifications(notifs)
            } catch (e) {
                console.log(e)
            }
        }

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <div className="fixed top-6 right-8 z-50">
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2.5 rounded-full bg-card border border-border/50 shadow-sm hover:shadow-md transition-all hover:bg-muted"
            >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center border-2 border-background animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 top-14 w-80 bg-card/80 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden z-50"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
                                <h3 className="font-bold tracking-tight">Notificações</h3>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full tracking-widest">
                                    {unreadCount} Novas
                                </span>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                        <CheckCircle2 className="w-8 h-8 opacity-20" />
                                        <p>Tudo atualizado por aqui.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/30">
                                        {notifications.map((notif) => {
                                            const Icon = notif.type === 'sale' ? ShoppingBag : notif.type === 'stock' ? Package : AlertCircle
                                            const color = notif.type === 'sale' ? 'text-emerald-500 bg-emerald-500/10' :
                                                notif.type === 'stock' ? 'text-rose-500 bg-rose-500/10' : 'text-blue-500 bg-blue-500/10'

                                            return (
                                                <div key={notif.id} className={`p-4 flex gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${notif.read ? 'opacity-60' : ''}`}>
                                                    <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-sm font-bold text-foreground leading-none">{notif.title}</h4>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">{notif.time}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{notif.message}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-muted/30 border-t border-border/50 text-center">
                                <button
                                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                                >
                                    Marcar todas como lidas
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
