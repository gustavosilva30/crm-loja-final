import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle, AlertTriangle, TrendingUp, BarChart3, List, Pencil, Trash2, CalendarClock, FileBarChart2, RepeatIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts"

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
    const [activeTab, setActiveTab] = useState<"lancamentos" | "fluxo" | "dre" | "previsao">("lancamentos")
    const { atendente } = useAuthStore()
    const [searchTerm, setSearchTerm] = useState("")
    const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<FinanceiroLancamento | null>(null)

    // Filtros Profissionais
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterTipo, setFilterTipo] = useState<string>("all")
    const [filterCategoria, setFilterCategoria] = useState<string>("all")

    // Form State
    const [newEntry, setNewEntry] = useState({
        tipo: 'Receita',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        categoria_financeira: 'Geral',
        status: 'Pendente',
        forma_pagamento: 'Dinheiro',
        descricao: '',
        centro_de_custo: '',
        recorrencia: 'unica',
        recorrencia_meses: 1
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
            const valor = parseFloat(newEntry.valor)
            const basePayload = {
                tipo: newEntry.tipo,
                valor,
                data_vencimento: newEntry.data_vencimento,
                categoria_financeira: newEntry.categoria_financeira,
                status: newEntry.status,
                forma_pagamento: newEntry.forma_pagamento,
                descricao: newEntry.descricao,
                centro_de_custo: newEntry.centro_de_custo || null,
                atendente_id: atendente?.id,
                is_automatico: false
            }

            if (editingEntry) {
                const { error } = await supabase.from('financeiro_lancamentos').update(basePayload).eq('id', editingEntry.id)
                if (error) throw error
            } else {
                // Gerar parcelas se recorrente
                const meses = newEntry.recorrencia !== 'unica' ? newEntry.recorrencia_meses : 1
                const inserts = []
                for (let i = 0; i < meses; i++) {
                    const dataBase = new Date(newEntry.data_vencimento + 'T12:00:00')
                    let dias = 0
                    if (newEntry.recorrencia === 'mensal') dias = i * 30
                    else if (newEntry.recorrencia === 'quinzenal') dias = i * 15
                    else if (newEntry.recorrencia === 'semanal') dias = i * 7
                    dataBase.setDate(dataBase.getDate() + dias)
                    const suffix = meses > 1 ? ` (${i + 1}/${meses})` : ''
                    inserts.push({ ...basePayload, data_vencimento: dataBase.toISOString().split('T')[0], descricao: basePayload.descricao + suffix })
                }
                const { error } = await supabase.from('financeiro_lancamentos').insert(inserts)
                if (error) throw error
            }

            setIsModalOpen(false)
            setEditingEntry(null)
            setNewEntry({ tipo: 'Receita', valor: '', data_vencimento: new Date().toISOString().split('T')[0], categoria_financeira: 'Geral', status: 'Pendente', forma_pagamento: 'Dinheiro', descricao: '', centro_de_custo: '', recorrencia: 'unica', recorrencia_meses: 1 })
            fetchLancamentos()
        } catch (err) {
            console.error('Error saving entry:', err)
            alert('Erro ao salvar lançamento')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este lançamento?')) return
        try {
            const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id)
            if (error) throw error
            fetchLancamentos()
        } catch (err) {
            console.error('Error deleting:', err)
            alert('Erro ao excluir')
        }
    }

    const handleDuplicate = async (lancamento: FinanceiroLancamento) => {
        try {
            const { id, created_at, ...duplicateData } = lancamento
            const { error } = await supabase.from('financeiro_lancamentos').insert([{
                ...duplicateData,
                status: 'Pendente',
                data_pagamento: null,
                descricao: `${duplicateData.descricao} (Cópia)`
            }])
            if (error) throw error
            fetchLancamentos()
        } catch (err) {
            console.error('Error duplicating:', err)
            alert('Erro ao duplicar')
        }
    }

    const handleToggleStatus = async (lancamento: FinanceiroLancamento) => {
        const isPaying = lancamento.status !== 'Pago'
        try {
            const { error } = await supabase
                .from('financeiro_lancamentos')
                .update({
                    status: isPaying ? 'Pago' : 'Pendente',
                    data_pagamento: isPaying ? new Date().toISOString().split('T')[0] : null
                })
                .eq('id', lancamento.id)
            if (error) throw error
            fetchLancamentos()
        } catch (err) {
            console.error('Error toggling status:', err)
        }
    }

    const handleEdit = (lancamento: FinanceiroLancamento) => {
        setEditingEntry(lancamento)
        setNewEntry({
            tipo: lancamento.tipo,
            valor: String(lancamento.valor),
            data_vencimento: lancamento.data_vencimento,
            categoria_financeira: lancamento.categoria_financeira || 'Geral',
            status: lancamento.status,
            forma_pagamento: lancamento.forma_pagamento || 'Dinheiro',
            descricao: lancamento.descricao || '',
            centro_de_custo: (lancamento as any).centro_de_custo || '',
            recorrencia: 'unica',
            recorrencia_meses: 1
        })
        setIsModalOpen(true)
    }

    const filteredLancamentos = lancamentos.filter(l => {
        const termLower = searchTerm.toLowerCase().trim();
        const matchesSearch = !searchTerm ||
            l.descricao?.toLowerCase().includes(termLower) ||
            l.categoria_financeira?.toLowerCase().includes(termLower);

        const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
        const matchesTipo = filterTipo === 'all' || l.tipo === filterTipo;
        const matchesCategoria = filterCategoria === 'all' || l.categoria_financeira === filterCategoria;

        const dateVenc = new Date(l.data_vencimento).getTime();
        const matchesStartDate = !startDate || dateVenc >= new Date(startDate + 'T00:00:00').getTime();
        const matchesEndDate = !endDate || dateVenc <= new Date(endDate + 'T23:59:59').getTime();

        return matchesSearch && matchesStatus && matchesTipo && matchesCategoria && matchesStartDate && matchesEndDate;
    })

    const receitasTotal = filteredLancamentos
        .filter(l => l.tipo === 'Receita')
        .reduce((acc, l) => acc + (l.valor || 0), 0)

    const despesasTotal = filteredLancamentos
        .filter(l => l.tipo === 'Despesa')
        .reduce((acc, l) => acc + (l.valor || 0), 0)

    const saldoTotal = receitasTotal - despesasTotal

    // Prepare chart data (group by month)
    const chartData = lancamentos.reduce((acc: any[], current) => {
        const month = new Date(current.data_vencimento + 'T12:00:00').toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
        const existing = acc.find(item => item.name === month)
        if (existing) {
            if (current.tipo === 'Receita') existing.receita += current.valor
            else existing.despesa += current.valor
        } else {
            acc.push({ name: month, receita: current.tipo === 'Receita' ? current.valor : 0, despesa: current.tipo === 'Despesa' ? current.valor : 0 })
        }
        return acc
    }, []).slice(-8)

    // DRE simplificado
    const receita_bruta = lancamentos.filter(l => l.tipo === 'Receita').reduce((a, l) => a + l.valor, 0)
    const despesas_total = lancamentos.filter(l => l.tipo === 'Despesa').reduce((a, l) => a + l.valor, 0)
    const resultado_liquido = receita_bruta - despesas_total
    const dreCategories = lancamentos.filter(l => l.tipo === 'Despesa').reduce((acc: any, l) => {
        const cat = l.categoria_financeira || 'Geral'
        acc[cat] = (acc[cat] || 0) + l.valor
        return acc
    }, {})

    // Previsão 30 dias
    const hoje = new Date()
    const em30Dias = new Date(); em30Dias.setDate(em30Dias.getDate() + 30)
    const hoje_str = hoje.toISOString().split('T')[0]
    const em30_str = em30Dias.toISOString().split('T')[0]
    const previsao = lancamentos.filter(l => l.status === 'Pendente' && l.data_vencimento >= hoje_str && l.data_vencimento <= em30_str)
    const previsao_receitas = previsao.filter(l => l.tipo === 'Receita').reduce((a, l) => a + l.valor, 0)
    const previsao_despesas = previsao.filter(l => l.tipo === 'Despesa').reduce((a, l) => a + l.valor, 0)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
                    <p className="text-foreground mt-1">Gerencie suas contas a pagar, receber e fluxo de caixa.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50 flex-wrap gap-1">
                        <Button variant={activeTab === "lancamentos" ? "secondary" : "ghost"} size="sm" className="gap-2 h-8" onClick={() => setActiveTab("lancamentos")}>
                            <List className="w-4 h-4" /> Lançamentos
                        </Button>
                        <Button variant={activeTab === "fluxo" ? "secondary" : "ghost"} size="sm" className="gap-2 h-8" onClick={() => setActiveTab("fluxo")}>
                            <BarChart3 className="w-4 h-4" /> Fluxo de Caixa
                        </Button>
                        <Button variant={activeTab === "dre" ? "secondary" : "ghost"} size="sm" className="gap-2 h-8" onClick={() => setActiveTab("dre")}>
                            <FileBarChart2 className="w-4 h-4" /> DRE
                        </Button>
                        <Button variant={activeTab === "previsao" ? "secondary" : "ghost"} size="sm" className="gap-2 h-8" onClick={() => setActiveTab("previsao")}>
                            <CalendarClock className="w-4 h-4" /> Previsão 30 dias
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
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground" />
                                <Input
                                    placeholder="Buscar por descrição, categoria..."
                                    className="pl-9 bg-background"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant={isFilterOpen ? "secondary" : "outline"} className="gap-2" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                                    <Filter className="w-4 h-4" />
                                    Filtros
                                </Button>
                            </div>
                        </div>

                        {isFilterOpen && (
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 p-4 bg-muted/30 rounded-lg border animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Início</Label>
                                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fim</Label>
                                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</Label>
                                    <Select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                                        <option value="all">Receitas e Despesas</option>
                                        <option value="Receita">Apenas Receitas</option>
                                        <option value="Despesa">Apenas Despesas</option>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                    <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                        <option value="all">Todos os Status</option>
                                        <option value="Pago">Pago / Recebido</option>
                                        <option value="Pendente">Aguardando</option>
                                        <option value="Atrasado">Em Atraso</option>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Categoria</Label>
                                    <Select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
                                        <option value="all">Todas as Categorias</option>
                                        {Array.from(new Set(lancamentos.map(l => l.categoria_financeira || "Geral"))).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </Select>
                                </div>
                            </div>
                        )}
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
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={`h-8 px-2 text-xs gap-1 ${lancamento.status === 'Pago' ? 'text-blue-500 hover:text-blue-600' : 'text-emerald-500 hover:text-emerald-600'}`}
                                                        onClick={() => handleToggleStatus(lancamento)}
                                                        title={lancamento.status === 'Pago' ? "Reverter" : "Dar Baixa"}
                                                    >
                                                        {lancamento.status === 'Pago' ? 'Reverter' : 'Baixar'}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground" onClick={() => handleDuplicate(lancamento)} title="Duplicar">
                                                        <Plus className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleEdit(lancamento)} title="Editar">
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(lancamento.id)} title="Excluir">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            ) : activeTab === "fluxo" ? (
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
            ) : activeTab === "dre" ? (
                <Card>
                    <CardHeader><CardTitle>DRE — Demonstrativo de Resultado</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-w-lg">
                            <div className="flex justify-between py-2 border-b font-bold text-emerald-500">
                                <span>Receita Bruta</span>
                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receita_bruta)}</span>
                            </div>
                            {Object.entries(dreCategories).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, val]) => (
                                <div key={cat} className="flex justify-between py-1.5 text-sm border-b border-border/50">
                                    <span className="text-muted-foreground pl-4">(-) {cat}</span>
                                    <span className="text-rose-500 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val as number)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-b font-bold text-rose-500">
                                <span>Total de Despesas</span>
                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesas_total)}</span>
                            </div>
                            <div className={`flex justify-between py-3 font-black text-lg ${resultado_liquido >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <span>Resultado Líquido</span>
                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado_liquido)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : activeTab === "previsao" ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-emerald-500/20 bg-emerald-500/5">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">A Receber (30 dias)</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-emerald-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previsao_receitas)}</div></CardContent>
                        </Card>
                        <Card className="border-rose-500/20 bg-rose-500/5">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">A Pagar (30 dias)</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-rose-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previsao_despesas)}</div></CardContent>
                        </Card>
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo Previsto</CardTitle></CardHeader>
                            <CardContent><div className={`text-2xl font-bold ${(previsao_receitas - previsao_despesas) >= 0 ? 'text-primary' : 'text-rose-500'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previsao_receitas - previsao_despesas)}</div></CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Vencimentos Pendentes (próximos 30 dias)</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {previsao.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum vencimento nos próximos 30 dias.</TableCell></TableRow>
                                    ) : [...previsao].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell className="text-xs font-medium">{new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell className="text-sm">{l.descricao || '—'}</TableCell>
                                            <TableCell>{l.tipo === 'Receita' ? <Badge variant="default" className="text-[10px]">Receita</Badge> : <Badge variant="destructive" className="text-[10px]">Despesa</Badge>}</TableCell>
                                            <TableCell className="text-xs">{l.categoria_financeira || 'Geral'}</TableCell>
                                            <TableCell className={`text-right font-bold ${l.tipo === 'Receita' ? 'text-emerald-500' : 'text-rose-500'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(l.valor)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : null
            }

            {/* NEW ENTRY MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingEntry(null)
                    setNewEntry({ tipo: 'Receita', valor: '', data_vencimento: new Date().toISOString().split('T')[0], categoria_financeira: 'Geral', status: 'Pendente', forma_pagamento: 'Dinheiro', descricao: '', centro_de_custo: '', recorrencia: 'unica', recorrencia_meses: 1 })
                }}
                title={editingEntry ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
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
                            <Select value={newEntry.status} onChange={e => setNewEntry({ ...newEntry, status: e.target.value as any })}>
                                <option value="Pendente">Pendente</option>
                                <option value="Pago">Pago / Recebido</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Forma de Pagamento</Label>
                            <Select value={newEntry.forma_pagamento} onChange={e => setNewEntry({ ...newEntry, forma_pagamento: e.target.value })}>
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Pix">PIX</option>
                                <option value="Cartão Crédito">Cartão Crédito</option>
                                <option value="Cartão Débito">Cartão Débito</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Haver Cliente">Haver Cliente</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Centro de Custo (Opcional)</Label>
                        <Input placeholder="Ex: Operacional, Administrativo, Vendas..." value={newEntry.centro_de_custo} onChange={e => setNewEntry({ ...newEntry, centro_de_custo: e.target.value })} />
                    </div>

                    {!editingEntry && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5"><RepeatIcon className="w-3.5 h-3.5" />Recorrência</Label>
                                <Select value={newEntry.recorrencia} onChange={e => setNewEntry({ ...newEntry, recorrencia: e.target.value })}>
                                    <option value="unica">Única vez</option>
                                    <option value="semanal">Semanal</option>
                                    <option value="quinzenal">Quinzenal</option>
                                    <option value="mensal">Mensal</option>
                                </Select>
                            </div>
                            {newEntry.recorrencia !== 'unica' && (
                                <div className="space-y-2">
                                    <Label>Nº de Parcelas/Repetições</Label>
                                    <Input type="number" min={2} max={60} value={newEntry.recorrencia_meses} onChange={e => setNewEntry({ ...newEntry, recorrencia_meses: parseInt(e.target.value) || 1 })} />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Salvando..." : editingEntry ? "Salvar Alterações" : newEntry.recorrencia !== 'unica' ? `Criar ${newEntry.recorrencia_meses} lançamentos` : "Confirmar Lançamento"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    )
}
