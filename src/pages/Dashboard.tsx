import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DollarSign, ShoppingBag, PackageOpen, TrendingUp, ArrowUpRight, ArrowDownRight,
  Users, AlertTriangle, Target, RefreshCw, Award, Calendar, CreditCard, Percent,
  ChevronUp, ChevronDown, Minus, Clock, BellRing, TrendingDown, Brain, ListChecks, Search, Zap, Map
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts"
import { supabase } from "@/lib/supabase"

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

type PeriodKey = 'hoje' | '7d' | '30d' | 'mes' | '90d' | 'ano'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: '90d', label: '90 dias' },
  { key: 'ano', label: 'Este ano' },
]

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function getPeriodDates(period: PeriodKey) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  let start = today
  let prevStart = ''
  let prevEnd = ''

  if (period === 'hoje') {
    start = today
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    prevStart = yesterday.toISOString().split('T')[0]
    prevEnd = prevStart
  } else if (period === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    start = d.toISOString().split('T')[0]
    const pd = new Date(now); pd.setDate(pd.getDate() - 13)
    const pe = new Date(now); pe.setDate(pe.getDate() - 7)
    prevStart = pd.toISOString().split('T')[0]
    prevEnd = pe.toISOString().split('T')[0]
  } else if (period === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - 29)
    start = d.toISOString().split('T')[0]
    const pd = new Date(now); pd.setDate(pd.getDate() - 59)
    const pe = new Date(now); pe.setDate(pe.getDate() - 30)
    prevStart = pd.toISOString().split('T')[0]
    prevEnd = pe.toISOString().split('T')[0]
  } else if (period === 'mes') {
    start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    prevStart = prevMonth.toISOString().split('T')[0]
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0)
    prevEnd = lastDayPrev.toISOString().split('T')[0]
  } else if (period === '90d') {
    const d = new Date(now); d.setDate(d.getDate() - 89)
    start = d.toISOString().split('T')[0]
    prevStart = ''
    prevEnd = ''
  } else if (period === 'ano') {
    start = `${now.getFullYear()}-01-01`
    prevStart = `${now.getFullYear() - 1}-01-01`
    prevEnd = `${now.getFullYear() - 1}-12-31`
  }

  return { start, end: today, prevStart, prevEnd }
}

interface DashStats {
  faturamento: number
  faturamentoPrev: number
  vendasCount: number
  vendasCountPrev: number
  ticketMedio: number
  ticketMedioPrev: number
  estoqueBaixo: number
  mlFaturamento: number
  recentOrders: any[]
  topProdutos: any[]
  topClientes: any[]
  salesByMonth: any[]
  paymentPie: any[]
  alertas: string[]
  vendasHoje: number
  contasVencendo: number
  clientesTotal: number
  despesasMes: number
}

const emptyStats: DashStats = {
  faturamento: 0, faturamentoPrev: 0,
  vendasCount: 0, vendasCountPrev: 0,
  ticketMedio: 0, ticketMedioPrev: 0,
  estoqueBaixo: 0, mlFaturamento: 0,
  recentOrders: [], topProdutos: [], topClientes: [],
  salesByMonth: [], paymentPie: [], alertas: [],
  vendasHoje: 0, contasVencendo: 0, clientesTotal: 0, despesasMes: 0
}

function GrowthBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return <span className="text-xs text-muted-foreground">—</span>
  if (prev === 0) return <span className="text-xs text-emerald-500 flex items-center gap-0.5"><ChevronUp className="w-3 h-3" />Novo</span>
  const pct = ((current - prev) / prev) * 100
  const pos = pct >= 0
  return (
    <span className={`text-xs flex items-center gap-0.5 font-semibold ${pos ? 'text-emerald-500' : 'text-rose-500'}`}>
      {pos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<DashStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodKey>('mes')

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end, prevStart, prevEnd } = getPeriodDates(period)
      const endDateTime = end + 'T23:59:59'

      // 1. Chamada Consolidada via RPC (Muito mais rápido que 7 selects)
      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
        p_start_date: start,
        p_end_date: end
      })

      if (rpcError) throw rpcError

      // 2. Buscas complementares (Dados granulares para listas e gráficos)
      const [
        vendasRes,
        vendasPrevRes,
        itensRes,
        contasRes
      ] = await Promise.all([
        supabase
          .from('vendas')
          .select('id, total, status, origem_ml, data_venda, forma_pagamento, clientes(nome)')
          .gte('data_venda', start)
          .lte('data_venda', endDateTime),
        prevStart && prevEnd
          ? supabase.from('vendas').select('id, total, status').gte('data_venda', prevStart).lte('data_venda', prevEnd + 'T23:59:59')
          : Promise.resolve({ data: [] }),
        supabase.from('vendas_itens').select('produto_id, quantidade, preco_unitario, produtos(nome)').gte('created_at', start).lte('created_at', endDateTime),
        supabase.from('financeiro_lancamentos').select('id, descricao, data_vencimento, valor, tipo, status').gte('data_vencimento', new Date().toISOString().split('T')[0]).lte('data_vencimento', (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().split('T')[0]; })()).eq('status', 'Pendente')
      ])

      const vendas = vendasRes.data || []
      const vendasPrev = (vendasPrevRes as any).data || []
      const itens = itensRes.data || []
      const contas = contasRes.data || []

      // Atribuição de KPIs do RPC
      const faturamento = rpcStats.faturamento
      const vendasCount = rpcStats.vendas_count
      const estoqueBaixo = rpcStats.estoque_critico
      const mlFaturamento = rpcStats.ml_faturamento
      const vendasHoje = rpcStats.vendas_hoje
      const clientesTotal = rpcStats.clientes_total
      const despesasMes = rpcStats.despesas_mes

      // Cálculo de Comparativos (Período Anterior)
      const vendasPrevValidas = vendasPrev.filter((v: any) => v.status !== 'Cancelado')
      const faturamentoPrev = vendasPrevValidas.reduce((acc: number, v: any) => acc + (v.total || 0), 0)
      const vendasCountPrev = vendasPrevValidas.length
      const ticketMedioPrev = vendasCountPrev > 0 ? faturamentoPrev / vendasCountPrev : 0
      const ticketMedio = vendasCount > 0 ? faturamento / vendasCount : 0

      // Recent orders
      const recentOrders = [...vendas]
        .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())
        .slice(0, 6)

      // Top Produtos (by qty)
      const prodMap: Record<string, { nome: string; qty: number; total: number }> = {}
      itens.forEach((item: any) => {
        const nome = item.produtos?.nome || item.produto_id
        if (!prodMap[nome]) prodMap[nome] = { nome, qty: 0, total: 0 }
        prodMap[nome].qty += item.quantidade || 0
        prodMap[nome].total += (item.quantidade || 0) * (item.preco_unitario || 0)
      })
      const topProdutos = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 5)

      // Top Clientes
      const cliMap: Record<string, { nome: string; total: number; qtd: number }> = {}
      vendas.filter(v => v.status !== 'Cancelado').forEach(v => {
        const nome = (v as any).clientes?.nome || 'Consumidor Final'
        if (!cliMap[nome]) cliMap[nome] = { nome, total: 0, qtd: 0 }
        cliMap[nome].total += v.total || 0
        cliMap[nome].qtd++
      })
      const topClientes = Object.values(cliMap).sort((a, b) => b.total - a.total).slice(0, 5)

      // Sales by Month chart (LIMITADO aos últimos 8 meses para performance)
      const monthMap: Record<string, { name: string; receita: number; despesa: number }> = {}
      const eightMonthsAgo = new Date(); eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
      const startLimit = eightMonthsAgo.toISOString().substring(0, 7) + '-01';

      const [historyVendas, historyFinanc] = await Promise.all([
        supabase.from('vendas').select('data_venda, total, status').gte('data_venda', startLimit),
        supabase.from('financeiro_lancamentos').select('data_vencimento, valor, tipo').gte('data_vencimento', startLimit)
      ])

        ; (historyVendas.data || []).filter(v => v.status !== 'Cancelado').forEach(v => {
          if (!v.data_venda) return
          const m = v.data_venda.substring(0, 7)
          if (!monthMap[m]) monthMap[m] = { name: new Date(m + '-15').toLocaleString('pt-BR', { month: 'short', year: '2-digit' }), receita: 0, despesa: 0 }
          monthMap[m].receita += v.total || 0
        });
      (historyFinanc.data || []).filter(f => f.tipo === 'Despesa').forEach(f => {
        if (!f.data_vencimento) return
        const m = f.data_vencimento.substring(0, 7)
        if (!monthMap[m]) monthMap[m] = { name: new Date(m + '-15').toLocaleString('pt-BR', { month: 'short', year: '2-digit' }), receita: 0, despesa: 0 }
        monthMap[m].despesa += f.valor || 0
      })
      const salesByMonth = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([, v]) => v)

      // Payment Pie
      const payMap: Record<string, number> = {}
      vendas.filter(v => v.status !== 'Cancelado').forEach(v => {
        const key = (v as any).forma_pagamento || 'Não informado'
        payMap[key] = (payMap[key] || 0) + (v.total || 0)
      })
      const paymentPie = Object.entries(payMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))

      // Alerts
      const alertas: string[] = []
      if (estoqueBaixo > 0) alertas.push(`${estoqueBaixo} produto(s) com estoque crítico`)
      if (contas.length > 0) alertas.push(`${contas.length} conta(s) a vencer nos próximos 5 dias`)

      setStats({
        faturamento, faturamentoPrev, vendasCount, vendasCountPrev,
        ticketMedio, ticketMedioPrev, estoqueBaixo, mlFaturamento,
        recentOrders, topProdutos, topClientes, salesByMonth, paymentPie, alertas,
        vendasHoje, contasVencendo: contas.length,
        clientesTotal, despesasMes
      })
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Central de inteligência do negócio.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIOD_OPTIONS.map(p => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {stats.alertas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.alertas.map((alerta, i) => (
            <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs px-3 py-1.5 rounded-full font-medium">
              <BellRing className="w-3 h-3 shrink-0" />
              {alerta}
            </div>
          ))}
        </div>
      )}

      {/* Destaques de Inovação (Smart Features) */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { icon: Brain, label: "AI Pricing", desc: "Sugestões de preço via IA", href: "/produtos", color: "text-purple-500", bg: "bg-purple-500/10" },
          { icon: ListChecks, label: "Checklist Desmonte", desc: "Entrada rápida de peças", href: "/sucatas", color: "text-amber-500", bg: "bg-amber-500/10" },
          { icon: Zap, label: "Sales AI", desc: "WhatsApp para Orçamento", href: "/sales-ai", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { icon: Search, label: "VIN Decoder", desc: "Chassi Automático", href: "/sucatas", color: "text-blue-500", bg: "bg-blue-500/10" },
          { icon: Map, label: "Yard Map", desc: "Mapa Visual do Pátio", href: "/yard-map", color: "text-primary", bg: "bg-primary/10" },
        ].map((feat, i) => (
          <Card key={i} className="border-border/50 hover:border-primary/50 transition-all hover:scale-105 cursor-pointer" onClick={() => window.location.href = feat.href}>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center mb-3`}>
                <feat.icon className={`h-6 w-6 ${feat.color}`} />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-tight">{feat.label}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{feat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPIs Principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Receita Total</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{loading ? '—' : fmt(stats.faturamento)}</div>
            <div className="flex items-center gap-2 mt-2">
              <GrowthBadge current={stats.faturamento} prev={stats.faturamentoPrev} />
              <span className="text-[10px] text-muted-foreground uppercase font-bold">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Vendas Realizadas</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{loading ? '—' : stats.vendasCount}</div>
            <div className="flex items-center gap-2 mt-2">
              <GrowthBadge current={stats.vendasCount} prev={stats.vendasCountPrev} />
              <span className="text-[10px] text-muted-foreground uppercase font-bold">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Ticket Médio</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Percent className="h-4 w-4 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{loading ? '—' : fmt(stats.ticketMedio)}</div>
            <div className="flex items-center gap-2 mt-2">
              <GrowthBadge current={stats.ticketMedio} prev={stats.ticketMedioPrev} />
              <span className="text-[10px] text-muted-foreground uppercase font-bold">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Estoque Crítico</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <PackageOpen className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-500">{loading ? '—' : `${stats.estoqueBaixo} itens`}</div>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold">Abaixo do mínimo</p>
          </CardContent>
        </Card>
      </div>


      {/* KPIs Secundários */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/30 backdrop-blur-md shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Receita Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">{loading ? '—' : fmt(stats.vendasHoje)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Vendas do dia</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-md shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-500">{loading ? '—' : fmt(stats.despesasMes)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Contas a pagar</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-md shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Mercado Livre</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">{loading ? '—' : fmt(stats.mlFaturamento)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Canal ML</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-md shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{loading ? '—' : stats.clientesTotal}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Clientes ativos</p>
          </CardContent>
        </Card>
      </div>


      {/* Gráfico principal + Pedidos recentes */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Receitas vs Despesas por Mês</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">Carregando gráfico...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                    <Legend formatter={(val) => <span className="text-xs text-muted-foreground">{val === 'receita' ? 'Receitas' : 'Despesas'}</span>} />
                    <Bar dataKey="receita" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
                ))
              ) : stats.recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido encontrado</div>
              ) : stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium leading-none flex items-center gap-2">
                      {(order as any).clientes?.nome || "Consumidor"}
                      {order.origem_ml && <Badge variant="ml" className="text-[9px] px-1 py-0">ML</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.data_venda ? new Date(order.data_venda).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(order.total || 0)}</p>
                    <Badge
                      variant={order.status === 'Pago' || order.status === 'Entregue' ? 'default' : order.status === 'Cancelado' ? 'destructive' : 'outline'}
                      className="text-[9px] mt-0.5"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Produtos + Top Clientes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Top 5 Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-muted/40 rounded animate-pulse mb-2" />)
            ) : stats.topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de itens no período</p>
            ) : (
              <div className="space-y-3">
                {stats.topProdutos.map((prod, i) => {
                  const maxQty = stats.topProdutos[0].qty
                  const pct = maxQty > 0 ? (prod.qty / maxQty) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                          <span className="font-medium truncate max-w-[180px]">{prod.nome}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs">{prod.qty} un.</span>
                          <span className="text-muted-foreground text-xs ml-2">{fmt(prod.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              Top 5 Clientes por Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-muted/40 rounded animate-pulse mb-2" />)
            ) : stats.topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de clientes no período</p>
            ) : (
              <div className="space-y-3">
                {stats.topClientes.map((cli, i) => {
                  const maxTotal = stats.topClientes[0].total
                  const pct = maxTotal > 0 ? (cli.total / maxTotal) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-sky-500/10 text-sky-500 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                          <span className="font-medium truncate max-w-[180px]">{cli.nome}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-sky-500">{fmt(cli.total)}</span>
                          <span className="text-muted-foreground text-xs ml-2">{cli.qtd} pedido(s)</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de área (evolução receita) + Formas de Pagamento */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Evolução de Receita</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[250px] w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">Carregando...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.salesByMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#gradReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Formas de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm animate-pulse">Carregando...</div>
            ) : stats.paymentPie.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={stats.paymentPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.paymentPie.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => fmt(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {stats.paymentPie.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-bold">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
