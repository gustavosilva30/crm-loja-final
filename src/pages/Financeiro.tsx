import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, MoreHorizontal, ArrowUpCircle, ArrowDownCircle, AlertTriangle, TrendingUp, BarChart3, List } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

interface FinanceiroLancamento {
    id: string
    tipo: 'Receita' | 'Despesa'
    valor: number
    data_vencimento: string
    data_pagamento: string | null
    categoria_financeira: string | null
    status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado'
    descricao: string | null
    forma_pagamento: string | null
    created_at: string
}

export function Financeiro() {
    const [activeTab, setActiveTab] = useState<"lancamentos" | "fluxo">("lancamentos")
    const { atendente } = useAuthStore()
    const [searchTerm, setSearchTerm] = useState("")
    const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Form State
    const [newEntry, setNewEntry] = useState({
        tipo: 'Receita',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        categoria_financeira: 'Geral',
        status: 'Pendente',
        forma_pagamento: 'Dinheiro',
        descricao: ''
    })

    const fetchLancamentos = async () => {
        try {
            const { data, error } = await supabase
                .from('financeiro_lancamentos')
                .select('*')
                .order('data_vencimento', { ascending: false })

            if (error) {
                console.error('Error fetching lancamentos:', error)
            } else {
                setLancamentos(data || [])
            }
        } catch (err) {
            console.error('Unexpected error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLancamentos()
    }, [])

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('financeiro_lancamentos')
                .insert([{
                    ...newEntry,
                    atendente_id: atendente?.id,
                    valor: parseFloat(newEntry.valor)
                }])

            if (error) throw error

            setIsModalOpen(false)
            setNewEntry({
                tipo: 'Receita',
                valor: '',
                data_vencimento: new Date().toISOString().split('T')[0],
                categoria_financeira: 'Geral',
                status: 'Pendente',
                forma_pagamento: 'Dinheiro',
                descricao: ''
            })
            fetchLancamentos()
        } catch (err) {
            console.error('Error adding entry:', err)
            alert('Erro ao adicionar lançamento')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredLancamentos = lancamentos.filter(l =>
        l.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.categoria_financeira?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const receitasTotal = lancamentos
        .filter(l => l.tipo === 'Receita')
        .reduce((acc, l) => acc + (l.valor || 0), 0)

    const despesasTotal = lancamentos
        .filter(l => l.tipo === 'Despesa')
        .reduce((acc, l) => acc + (l.valor || 0), 0)

    const saldoTotal = receitasTotal - despesasTotal

    // Prepare chart data (group by month)
    const chartData = lancamentos.reduce((acc: any[], current) => {
        const month = new Date(current.data_vencimento).toLocaleString('pt-BR', { month: 'short' })
        const existing = acc.find(item => item.name === month)

        if (existing) {
            if (current.tipo === 'Receita') existing.receita += current.valor
            else existing.despesa += current.valor
        } else {
            acc.push({
                name: month,
                receita: current.tipo === 'Receita' ? current.valor : 0,
                despesa: current.tipo === 'Despesa' ? current.valor : 0
            })
        }
        return acc
    }, []).reverse()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
                    <p className="text-muted-foreground mt-1">Gerencie suas contas a pagar, receber e fluxo de caixa.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50">
                        <Button
                            variant={activeTab === "lancamentos" ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => setActiveTab("lancamentos")}
                        >
                            <List className="w-4 h-4" /> Lançamentos
                        </Button>
                        <Button
                            variant={activeTab === "fluxo" ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => setActiveTab("fluxo")}
                        >
                            <BarChart3 className="w-4 h-4" /> Fluxo de Caixa
                        </Button>
                    </div>
                    <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Novo Lançamento
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
                        <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitasTotal)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
                    </CardContent>
                </Card>

                <Card className="border-rose-500/20 bg-rose-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
                        <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesasTotal)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Saldo Previsto</CardTitle>
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${saldoTotal >= 0 ? "text-primary" : "text-rose-500"}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoTotal)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Diferença entre entradas e saídas</p>
                    </CardContent>
                </Card>
            </div>

            {activeTab === "lancamentos" ? (
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="relative w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por descrição, categoria..."
                                    className="pl-9 bg-background"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="gap-2">
                                <Filter className="w-4 h-4" />
                                Filtros
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center p-8 text-muted-foreground">
                                Carregando lançamentos...
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Forma</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLancamentos.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Nenhum lançamento encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredLancamentos.map((lancamento) => (
                                        <TableRow key={lancamento.id}>
                                            <TableCell className="text-xs">
                                                {new Date(lancamento.data_vencimento).toLocaleDateString("pt-BR")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{lancamento.descricao || "-"}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight">
                                                    {lancamento.categoria_financeira || "Geral"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {lancamento.tipo === 'Receita' ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
                                                        <ArrowUpCircle className="w-3 h-3" /> Receita
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold">
                                                        <ArrowDownCircle className="w-3 h-3" /> Despesa
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className={`font-bold ${lancamento.tipo === 'Receita' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valor)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px] font-medium">
                                                    {lancamento.forma_pagamento || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        lancamento.status === 'Pago' ? 'default' :
                                                            lancamento.status === 'Pendente' ? 'outline' : 'destructive'
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {lancamento.status === 'Atrasado' && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                                                    {lancamento.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fluxo de Caixa (Entradas vs Saídas)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                                    <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas" />
                                    <Bar dataKey="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Despesas" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Resumo por Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Array.from(new Set(lancamentos.map(l => l.categoria_financeira || "Geral"))).map(cat => {
                                    const totalCat = lancamentos.filter(l => l.categoria_financeira === cat || (!l.categoria_financeira && cat === "Geral")).reduce((acc, l) => acc + l.valor, 0)
                                    return (
                                        <div key={cat} className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20">
                                            <span className="font-medium">{cat}</span>
                                            <span className="font-bold tracking-tight">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCat)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* NEW ENTRY MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Novo Lançamento Financeiro"
            >
                <form onSubmit={handleAddEntry} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                                value={newEntry.tipo}
                                onChange={e => setNewEntry({ ...newEntry, tipo: e.target.value })}
                            >
                                <option value="Receita">Receita (A Receber)</option>
                                <option value="Despesa">Despesa (A Pagar)</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0,00"
                                value={newEntry.valor}
                                onChange={e => setNewEntry({ ...newEntry, valor: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                            required
                            placeholder="Ex: Aluguel, Venda de Produto..."
                            value={newEntry.descricao}
                            onChange={e => setNewEntry({ ...newEntry, descricao: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vencimento</Label>
                            <Input
                                type="date"
                                required
                                value={newEntry.data_vencimento}
                                onChange={e => setNewEntry({ ...newEntry, data_vencimento: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Input
                                placeholder="Ex: Infraestrutura, Vendas..."
                                value={newEntry.categoria_financeira}
                                onChange={e => setNewEntry({ ...newEntry, categoria_financeira: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Status Inicial</Label>
                            <Select
                                value={newEntry.status}
                                onChange={e => setNewEntry({ ...newEntry, status: e.target.value as any })}
                            >
                                <option value="Pendente">Pendente</option>
                                <option value="Pago">Pago / Recebido</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Forma de Pagamento</Label>
                            <Select
                                value={newEntry.forma_pagamento}
                                onChange={e => setNewEntry({ ...newEntry, forma_pagamento: e.target.value })}
                            >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Pix">PIX</option>
                                <option value="Cartão">Cartão</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Haver Cliente">Haver Cliente</option>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Salvando..." : "Confirmar Lançamento"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
