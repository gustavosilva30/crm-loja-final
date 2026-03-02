import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Package, ShoppingCart, DollarSign, Users, Truck, Settings, LogOut, FileText, Bell, BarChart, Wallet, MessageCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ModeToggle } from "./ModeToggle"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: MessageCircle, label: "Atendimento", href: "/atendimento" },
  { icon: Bell, label: "Lembretes", href: "/lembretes" },
  { icon: Package, label: "Estoque", href: "/produtos" },
  { icon: ShoppingCart, label: "Vendas", href: "/vendas" },
  { icon: CheckCircle2, label: "Vendas Concluídas", href: "/vendas-concluidas" },
  { icon: FileText, label: "Orçamentos", href: "/orcamentos" },
  { icon: Wallet, label: "Controle de Caixa", href: "/caixa" },
  { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
  { icon: BarChart, label: "Relatórios", href: "/relatorios" },
  { icon: FileText, label: "Fiscal", href: "/fiscal" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: Truck, label: "Entregas", href: "/entregas" },
]

export function Sidebar() {
  const location = useLocation()
  const [counts, setCounts] = useState({ lembretes: 0, entregas: 0 })
  const [permissions, setPermissions] = useState<any>(null)

  const fetchPermissions = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data } = await supabase
        .from('atendentes')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single()
      setPermissions(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const fetchCounts = async () => {
    try {
      const now = new Date().toISOString()

      const { count: overdueReminders } = await supabase
        .from('lembretes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pendente')
        .lt('data_lembrete', now)

      const { count: pendingDeliveries } = await supabase
        .from('entregas')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Entregue')

      setCounts({
        lembretes: overdueReminders || 0,
        entregas: pendingDeliveries || 0
      })
    } catch (err) {
      console.error('Error fetching counts:', err)
    }
  }

  useEffect(() => {
    fetchCounts()
    fetchPermissions()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  const filteredNavItems = navItems.filter(item => {
    if (!permissions) return true // Show all while loading or if not linked
    if (item.label === "Vendas" && !permissions.perm_vendas) return false
    if (item.label === "Estoque" && !permissions.perm_produtos) return false
    if (item.label === "Financeiro" && !permissions.perm_financeiro) return false
    if (item.label === "Controle de Caixa" && !permissions.perm_caixa) return false
    if (item.label === "Fiscal" && !permissions.perm_fiscal) return false
    // Relatórios e Clientes geralmente são livres ou vinculados a Vendas/Financeiro
    return true
  })

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,255,157,0.4)]">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">ERP<span className="text-primary">Moderno</span></span>
        </div>
        <ModeToggle />
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(0,255,157,0.1)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </div>

              {((item.label === "Lembretes" && counts.lembretes > 0) ||
                (item.label === "Entregas" && counts.entregas > 0)) && (
                  <div className="flex items-center gap-1 animate-pulse">
                    <Bell className="w-3 h-3 text-rose-500 fill-rose-500" />
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {item.label === "Lembretes" ? counts.lembretes : counts.entregas}
                    </span>
                  </div>
                )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        {(!permissions || permissions.perm_config) && (
          <Link
            to="/configuracoes"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
            Configurações
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
