import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Wallet, Plus, Lock, Unlock, History, AlertCircle, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface CaixaRegistro {
    id: string
    data_registro: string
    valor_abertura: number
    valor_fechamento: number | null
    status: 'Aberto' | 'Fechado'
    observacoes: string | null
    created_at: string
}

export function Caixa() {
    const [registros, setRegistros] = useState<CaixaRegistro[]>([])
    const [loading, setLoading] = useState(true)
    const [isAberturaModalOpen, setIsAberturaModalOpen] = useState(false)
    const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [hoje, setHoje] = useState<CaixaRegistro | null>(null)
    const { atendente } = useAuthStore()
    const [movimentacoesHoje, setMovimentacoesHoje] = useState({ entradas: 0, saidas: 0 })

    // Form states
    const [valorAbertura, setValorAbertura] = useState("")
    const [valorFechamento, setValorFechamento] = useState("")
    const [valorMovimento, setValorMovimento] = useState("")
    const [tipoMovimento, setTipoMovimento] = useState<"Suprimento" | "Sangria">("Suprimento")
    const [isMovimentoModalOpen, setIsMovimentoModalOpen] = useState(false)
    const [observacoes, setObservacoes] = useState("")

    const fetchRegistros = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('caixa_registros')
                .select('*')
                .order('data_registro', { ascending: false })

            if (error) throw error
            setRegistros(data || [])

            // Verifica se tem caixa aberto hoje
            const todayStr = new Date().toISOString().split('T')[0]
            const recordHoje = data?.find(r => r.data_registro === todayStr)
            setHoje(recordHoje || null)

            if (recordHoje) {
                await fetchMovimentacoesDiarias(todayStr)
            }
        } catch (err) {
            console.error('Erro ao buscar registros de caixa:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchMovimentacoesDiarias = async (data: string) => {
        try {
            const { data: lancamentos, error } = await supabase
                .from('financeiro_lancamentos')
                .select('tipo, valor')
                .eq('forma_pagamento', 'Dinheiro')
                .gte('created_at', `${data}T00:00:00`)
                .lte('created_at', `${data}T23:59:59`)

            if (error) throw error

            const entradas = lancamentos?.filter(l => l.tipo === 'Receita').reduce((acc, l) => acc + l.valor, 0) || 0
            const saidas = lancamentos?.filter(l => l.tipo === 'Despesa').reduce((acc, l) => acc + l.valor, 0) || 0

            setMovimentacoesHoje({ entradas, saidas })
        } catch (err) {
            console.error('Erro ao buscar movimentações:', err)
        }
    }

    useEffect(() => {
        fetchRegistros()
    }, [])

    const handleAbrirCaixa = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const todayStr = new Date().toISOString().split('T')[0]
            const { error } = await supabase
                .from('caixa_registros')
                .insert([{
                    data_registro: todayStr,
                    valor_abertura: parseFloat(valorAbertura),
                    status: 'Aberto',
                    observacoes: observacoes,
                    atendente_id: atendente?.id
                }])

            if (error) throw error

            setIsAberturaModalOpen(false)
            setValorAbertura("")
            setObservacoes("")
            fetchRegistros()
        } catch (err: any) {
            console.error('Erro ao abrir caixa:', err)
            alert(err.message || 'Erro ao abrir caixa. Verifique se já existe um registro para hoje.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleFecharCaixa = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hoje) return

        setSubmitting(true)
        try {
            const currentTotal = hoje.valor_abertura + movimentacoesHoje.entradas - movimentacoesHoje.saidas
            const { error } = await supabase
                .from('caixa_registros')
                .update({
                    valor_fechamento: parseFloat(valorFechamento),
                    status: 'Fechado',
                    observacoes: observacoes ? `${hoje.observacoes || ""}\nFechamento (Total Sistema: ${currentTotal}): ${observacoes}` : hoje.observacoes
                })
                .eq('id', hoje.id)

            if (error) throw error

            setIsFechamentoModalOpen(false)
            setValorFechamento("")
            setObservacoes("")
            fetchRegistros()
        } catch (err: any) {
            console.error('Erro ao fechar caixa:', err)
            alert(err.message || 'Erro ao fechar caixa.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleMovimentoCaixa = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('financeiro_lancamentos')
                .insert([{
                    tipo: tipoMovimento === 'Suprimento' ? 'Receita' : 'Despesa',
                    valor: parseFloat(valorMovimento),
                    data_vencimento: new Date().toISOString().split('T')[0],
                    data_pagamento: new Date().toISOString().split('T')[0],
                    status: 'Pago',
                    forma_pagamento: 'Dinheiro',
                    descricao: `${tipoMovimento} de Caixa: ${observacoes}`,
                    categoria_financeira: 'Caixa',
                    atendente_id: atendente?.id
                }])

            if (error) throw error

            setIsMovimentoModalOpen(false)
            setValorMovimento("")
            setObservacoes("")
            fetchRegistros()
        } catch (err) {
            console.error('Erro ao registrar movimento:', err)
            alert('Erro ao registrar movimento de caixa.')
        } finally {
            setSubmitting(false)
        }
    }

    const saldoAtual = hoje ? (hoje.valor_abertura + movimentacoesHoje.entradas - movimentacoesHoje.saidas) : 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Controle de Caixa</h1>
                    <p className="text-muted-foreground mt-1">Gerencie a abertura, fechamento e movimentações do dia.</p>
                </div>
                {!hoje ? (
                    <Button className="gap-2" onClick={() => setIsAberturaModalOpen(true)}>
                        <Unlock className="w-4 h-4" />
                        Abrir Caixa de Hoje
                    </Button>
                ) : hoje.status === 'Aberto' ? (
                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10" onClick={() => { setTipoMovimento('Suprimento'); setIsMovimentoModalOpen(true); }}>
                            <Plus className="w-4 h-4" /> Suprimento
                        </Button>
                        <Button variant="outline" className="gap-2 border-rose-500/50 text-rose-500 hover:bg-rose-500/10" onClick={() => { setTipoMovimento('Sangria'); setIsMovimentoModalOpen(true); }}>
                            <ArrowDownRight className="w-4 h-4" /> Sangria
                        </Button>
                        <Button variant="destructive" className="gap-2" onClick={() => {
                            setValorFechamento(saldoAtual.toString())
                            setIsFechamentoModalOpen(true)
                        }}>
                            <Lock className="w-4 h-4" />
                            Fechar Caixa
                        </Button>
                    </div>
                ) : (
                    <Badge variant="outline" className="px-4 py-2 text-sm font-semibold gap-2">
                        <Lock className="w-4 h-4" /> Caixa Fechado
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(0,255,157,0.05)]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
                        <Wallet className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoAtual)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Dinheiro disponível agora
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Abertura + Entradas</CardTitle>
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((hoje?.valor_abertura || 0) + movimentacoesHoje.entradas)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Soma de todo aporte</p>
                    </CardContent>
                </Card>

                <Card className="bg-rose-500/5 border-rose-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
                        <ArrowDownRight className="w-4 h-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(movimentacoesHoje.saidas)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Pagamentos e sangrias</p>
                    </CardContent>
                </Card>

                <Card className="bg-muted/5 border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                        <History className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold uppercase tracking-tight">
                            {hoje ? hoje.status : "Fechado"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {hoje ? `Desde ${format(new Date(hoje.created_at), "HH:mm")}` : "---"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-muted-foreground" />
                        <CardTitle>Histórico de Registros</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            Carregando histórico...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Abertura</TableHead>
                                    <TableHead>Fechamento</TableHead>
                                    <TableHead>Diferença</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Observações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registros.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Nenhum registro encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : registros.map((reg) => {
                                    const diferenca = reg.valor_fechamento ? reg.valor_fechamento - reg.valor_abertura : null
                                    return (
                                        <TableRow key={reg.id}>
                                            <TableCell className="font-medium">
                                                {format(new Date(reg.data_registro + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                                            </TableCell>
                                            <TableCell className="text-emerald-500 font-medium">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reg.valor_abertura)}
                                            </TableCell>
                                            <TableCell className="text-rose-500 font-medium">
                                                {reg.valor_fechamento ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reg.valor_fechamento) : "-"}
                                            </TableCell>
                                            <TableCell className={diferenca !== null ? (diferenca >= 0 ? "text-primary font-bold" : "text-rose-500 font-bold") : ""}>
                                                {diferenca !== null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(diferenca) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={reg.status === 'Aberto' ? 'default' : 'secondary'}>
                                                    {reg.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground text-wrap">
                                                {reg.observacoes || "-"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* MODAL MOVIMENTO (SANGRIA / SUPRIMENTO) */}
            <Modal
                isOpen={isMovimentoModalOpen}
                onClose={() => setIsMovimentoModalOpen(false)}
                title={`Registrar ${tipoMovimento}`}
            >
                <form onSubmit={handleMovimentoCaixa} className="space-y-4">
                    <div className={`p-3 border rounded-lg flex gap-3 text-sm ${tipoMovimento === 'Suprimento' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>
                            {tipoMovimento === 'Suprimento'
                                ? 'Use suprimento para adicionar troco ou reforço de caixa.'
                                : 'Use sangria para retiradas de valores do caixa para depósito ou pagamentos.'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Valor do(a) {tipoMovimento} (R$)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0,00"
                                className="pl-9"
                                value={valorMovimento}
                                onChange={e => setValorMovimento(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Motivo / Observação</Label>
                        <Input
                            required
                            placeholder="Ex: Troco inicial, Depósito bancário..."
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsMovimentoModalOpen(false)}>Cancelar</Button>
                        <Button
                            className={tipoMovimento === 'Suprimento' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? "Salvando..." : `Confirmar ${tipoMovimento}`}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL ABERTURA */}
            <Modal
                isOpen={isAberturaModalOpen}
                onClose={() => setIsAberturaModalOpen(false)}
                title="Abertura de Caixa"
            >
                <form onSubmit={handleAbrirCaixa} className="space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-amber-500 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>Informe o valor em dinheiro presente no caixa no momento da abertura.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Valor de Abertura (R$)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0,00"
                                className="pl-9"
                                value={valorAbertura}
                                onChange={e => setValorAbertura(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações (Opcional)</Label>
                        <Input
                            placeholder="Notas sobre o estado do caixa..."
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsAberturaModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Abrindo..." : "Confirmar Abertura"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL FECHAMENTO */}
            <Modal
                isOpen={isFechamentoModalOpen}
                onClose={() => setIsFechamentoModalOpen(false)}
                title="Fechamento de Caixa"
            >
                <form onSubmit={handleFecharCaixa} className="space-y-4">
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex gap-3 text-primary text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>O valor de abertura hoje foi <strong>{hoje ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hoje.valor_abertura) : ""}</strong>. Informe o valor total final.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Valor de Fechamento (R$)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0,00"
                                className="pl-9"
                                value={valorFechamento}
                                onChange={e => setValorFechamento(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações de Fechamento (Opcional)</Label>
                        <Input
                            placeholder="Diferenças, sangrias ou notas do dia..."
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsFechamentoModalOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" type="submit" disabled={submitting}>
                            {submitting ? "Fechando..." : "Confirmar Fechamento"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
