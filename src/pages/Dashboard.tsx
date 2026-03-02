import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, ShoppingBag, PackageOpen, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { supabase } from "@/lib/supabase"

const salesData = [
  { name: "Jan", total: 12000 },
  { name: "Fev", total: 15000 },
  { name: "Mar", total: 18000 },
  { name: "Abr", total: 14000 },
  { name: "Mai", total: 22000 },
  { name: "Jun", total: 28000 },
  { name: "Jul", total: 32000 },
]

export function Dashboard() {
  const [stats, setStats] = useState({
    faturamento: 0,
    vendasCont: 0,
    estoqueBaixo: 0,
    mlFaturamento: 0,
    recentOrders: [] as any[]
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        const { data: vendas } = await supabase.from('vendas').select('total, origem_ml, status, id, data_venda, clientes ( nome )')
        const { data: produtos } = await supabase.from('produtos').select('estoque_atual, estoque_minimo')

        const faturamento = vendas?.filter(v => v.status !== 'Cancelado').reduce((acc, v) => acc + (v.total || 0), 0) || 0
        const mlFaturamento = vendas?.filter(v => v.origem_ml && v.status !== 'Cancelado').reduce((acc, v) => acc + (v.total || 0), 0) || 0
        const estoqueBaixo = produtos?.filter(p => p.estoque_atual <= p.estoque_minimo).length || 0

        setStats({
          faturamento,
          vendasCont: vendas?.length || 0,
          estoqueBaixo,
          mlFaturamento,
          recentOrders: vendas?.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 5) || []
        })
      } catch (err) {
        console.error('Error fetching dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardStats()
  }, [])
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu negócio hoje.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamento)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-primary mr-1" />
              Baseado no histórico do Supabase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Realizadas</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendasCont}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <span className="text-primary font-medium">Total de pedidos</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <PackageOpen className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.estoqueBaixo} itens</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowDownRight className="h-3 w-3 text-destructive mr-1" />
              Requer atenção imediata
            </p>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mercado Livre</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mlFaturamento)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-accent mr-1" />
              <span className="text-accent">Vendas integradas</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Gráfico Principal */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução de Receita</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00ff9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#00ff9d' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#00ff9d" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pedidos Recentes */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido recente</div>
              ) : stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium leading-none flex items-center gap-2">
                      {order.clientes?.nome || "Consumidor"}
                      {order.origem_ml && <Badge variant="ml" className="text-[10px] px-1.5 py-0">ML</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      #{order.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total || 0)}
                    </p>
                    <Badge variant={order.status === 'Pago' ? 'default' : order.status === 'Pendente' ? 'outline' : 'secondary'} className="text-[10px]">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
