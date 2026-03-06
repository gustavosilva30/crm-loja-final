import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Package, ShoppingCart, ShoppingBag, DollarSign, Users, Truck, Settings, LogOut, FileText, Bell, BarChart, Wallet, MessageCircle, CheckCircle2, Gavel, CalendarDays, Target, RotateCcw, Users2, QrCode, Car, Zap, Map, LayoutGrid as KanbanIcon, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils"
import { ModeToggle } from "./ModeToggle"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: MessageCircle, label: "Atendimento", href: "/atendimento" },
  { icon: KanbanIcon, label: "Funil de Vendas", href: "/funil" },
  { icon: Zap, label: "Sales AI", href: "/sales-ai" },
  { icon: Map, label: "Yard Map", href: "/yard-map" },
  { icon: Bell, label: "Lembretes", href: "/lembretes" },
  { icon: Package, label: "Estoque", href: "/produtos" },
  { icon: Car, label: "Catálogo", href: "/catalogo" },
  { icon: QrCode, label: "QR Code", href: "/qrcode" },
  { icon: ShoppingBag, label: "Vendas", href: "/vendas" },
  { icon: CheckCircle2, label: "Vendas Concluídas", href: "/vendas-concluidas" },
  { icon: FileText, label: "Orçamentos", href: "/orcamentos" },
  { icon: Wallet, label: "Controle de Caixa", href: "/caixa" },
  { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
  { icon: BarChart, label: "Relatórios", href: "/relatorios" },
  { icon: FileText, label: "Fiscal", href: "/fiscal" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: Truck, label: "Entregas", href: "/entregas" },
  { icon: Gavel, label: "Leilões", href: "/leiloes" },
  { icon: Car, label: "Sucatas", href: "/sucatas" },
  { icon: CalendarDays, label: "Agenda", href: "/agenda" },
  { icon: RotateCcw, label: "Devoluções", href: "/devolucoes" },
  { icon: Target, label: "Metas", href: "/metas" },
  { icon: Users2, label: "Indicações", href: "/indicacoes" },
]

export function Sidebar() {
  const location = useLocation()
  const [counts, setCounts] = useState({ lembretes: 0, entregas: 0, carrinho: 0 })
  const { atendente, signOut } = useAuthStore()

  const handleLogout = async () => {
    await signOut()
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

      let cartItems = 0;
      if (atendente) {
        const { data } = await supabase
          .from('carrinho_itens')
          .select('quantidade')
          .eq('atendente_id', atendente.id);
        cartItems = data?.reduce((acc, curr) => acc + curr.quantidade, 0) || 0;
      }

      setCounts({
        lembretes: overdueReminders || 0,
        entregas: pendingDeliveries || 0,
        carrinho: cartItems
      })
    } catch (err) {
      console.error('Error fetching counts:', err)
    }
  }

  useEffect(() => {
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  const filteredNavItems = navItems.filter(item => {
    if (!atendente) return true

    // ADMIN/GERENTE
    if (atendente.perm_config) return true

    const label = item.label

    // Módulos de Vendas
    if (["Vendas", "Vendas Concluídas", "Orçamentos", "Devoluções", "Clientes", "Entregas", "Indicações"].includes(label)) {
      return atendente.perm_vendas
    }

    // Módulos de Produto/Estoque
    if (["Estoque", "QR Code", "Sucatas"].includes(label)) {
      return atendente.perm_produtos
    }

    // Módulos Financeiros
    if (["Financeiro", "Relatórios", "Metas", "Agenda"].includes(label)) {
      return atendente.perm_financeiro
    }

    // Caixa
    if (label === "Controle de Caixa") return atendente.perm_caixa

    // Fiscal
    if (label === "Fiscal") return atendente.perm_fiscal

    // Leilões (Geralmente restrito a quem tem config ou financeiro)
    if (label === "Leilões") return atendente.perm_config || atendente.perm_financeiro

    // Dashboard, Atendimento, Lembretes são públicos para qualquer logado
    return true
  })

  return (
    <aside className="w-full border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm border border-border">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-foreground">CRM</span>
            <span className="text-[10px] text-foreground font-black uppercase leading-none tracking-wider">Dourados Auto Peças</span>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="px-4">
        <button
          onClick={() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })) }}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted border border-border/50 rounded-lg text-sm text-muted-foreground transition-colors group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 group-hover:text-primary transition-colors" />
            <span>Buscar...</span>
          </div>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4">
        {filteredNavItems.map((item) => {
          const pathWithoutSearch = location.pathname;
          // Exact match for base URL and query params
          const currentUrl = `${location.pathname}${location.search}`;
          const isActive = currentUrl === item.href || (item.href !== "/" && !item.href.includes('?') && (pathWithoutSearch === item.href || pathWithoutSearch.startsWith(`${item.href}/`)))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                  : "text-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-foreground")} />
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
        {(!atendente || atendente.perm_config) && (
          <Link
            to="/configuracoes"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
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
