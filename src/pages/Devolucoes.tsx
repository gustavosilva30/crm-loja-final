import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, RotateCcw, Pencil, Trash2, RefreshCw } from "lucide-react"
import { fmt, fmtDate } from "@/lib/format"

const STATUS_VARIANT: Record<string, any> = {
    Pendente: 'outline',
    Aprovado: 'default',
    Concluido: 'success',
    Recusado: 'destructive'
}

export function Devolucoes() {
    const { atendente } = useAuthStore()
    const [devolucoes, setDevolucoes] = useState<any[]>([])
    const [vendas, setVendas] = useState<any[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)
    const [filterStatus, setFilterStatus] = useState('todos')

    const [form, setForm] = useState({
        venda_id: '',
        cliente_id: '',
        motivo: '',
        tipo: 'DEVOLUCAO',
        status: 'Pendente',
        valor_reembolso: '',
        observacoes: ''
    })

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [devRes, vendasRes, cliRes] = await Promise.all([
            supabase.from('devolucoes').select('*, vendas(numero_pedido, total), clientes(nome), atendentes(nome)').order('created_at', { ascending: false }),
            supabase.from('vendas').select('id, numero_pedido, total, cliente_id, clientes!cliente_id(nome)').neq('status', 'Cancelado').order('data_venda', { ascending: false }).limit(100),
            supabase.from('clientes').select('id, nome')
        ])
        setDevolucoes(devRes.data || [])
        setVendas(vendasRes.data || [])
        setClientes(cliRes.data || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleVendaChange = (vendaId: string) => {
        const venda = vendas.find(v => v.id === vendaId)
        setForm({
            ...form,
            venda_id: vendaId,
            cliente_id: venda?.cliente_id || '',
            valor_reembolso: String(venda?.total || '')
        })
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const payload = {
                ...form,
                valor_reembolso: parseFloat(form.valor_reembolso) || 0,
                atendente_id: atendente?.id
            }
            if (editingItem) {
                await supabase.from('devolucoes').update(payload).eq('id', editingItem.id)
            } else {
                await supabase.from('devolucoes').insert([payload])
            }
            setIsModalOpen(false)
            setEditingItem(null)
            resetForm()
            fetchData()
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (item: any) => {
        setEditingItem(item)
        setForm({
            venda_id: item.venda_id || '',
            cliente_id: item.cliente_id || '',
            motivo: item.motivo || '',
            tipo: item.tipo,
            status: item.status,
            valor_reembolso: String(item.valor_reembolso || ''),
            observacoes: item.observacoes || ''
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta devolução?')) return
        await supabase.from('devolucoes').delete().eq('id', id)
        fetchData()
    }

    const handleUpdateStatus = async (id: string, status: string) => {
        await supabase.from('devolucoes').update({ status }).eq('id', id)
        fetchData()
    }

    const resetForm = () => setForm({ venda_id: '', cliente_id: '', motivo: '', tipo: 'DEVOLUCAO', status: 'Pendente', valor_reembolso: '', observacoes: '' })

    const filtered = devolucoes.filter(d => {
        const matchSearch = !search ||
            d.clientes?.nome?.toLowerCase().includes(search.toLowerCase()) ||
            d.motivo?.toLowerCase().includes(search.toLowerCase()) ||
            (d.vendas?.numero_pedido && String(d.vendas.numero_pedido).includes(search))
        const matchStatus = filterStatus === 'todos' || d.status === filterStatus
        return matchSearch && matchStatus
    })

    // KPIs
    const totalPendentes = devolucoes.filter(d => d.status === 'Pendente').length
    const totalAprovados = devolucoes.filter(d => d.status === 'Aprovado').length
    const totalReembolso = devolucoes.filter(d => d.status === 'Aprovado' || d.status === 'Concluido').reduce((a, d) => a + (d.valor_reembolso || 0), 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Devoluções & Trocas</h1>
                    <p className="text-muted-foreground mt-1">Gerencie solicitações de devolução e troca de produtos.</p>
                </div>
                <Button className="gap-2" onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true) }}>
                    <Plus className="w-4 h-4" /> Nova Devolução
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold text-amber-500">{totalPendentes}</div></CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aprovadas</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold text-blue-500">{totalAprovados}</div></CardContent>
                </Card>
                <Card className="border-rose-500/20 bg-rose-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Reembolsado</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-rose-500">{fmt(totalReembolso)}</div></CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Buscar por cliente, motivo, pedido..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select className="w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="todos">Todos os status</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Concluido">Concluído</option>
                    <option value="Recusado">Recusado</option>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Motivo</TableHead>
                                <TableHead className="text-right">Reembolso</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        <p>Nenhuma devolução encontrada.</p>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map(d => (
                                <TableRow key={d.id}>
                                    <TableCell className="font-mono font-bold text-primary text-sm">
                                        {d.vendas?.numero_pedido ? `#${String(d.vendas.numero_pedido).padStart(6, '0')}` : '—'}
                                    </TableCell>
                                    <TableCell className="font-medium">{d.clientes?.nome || '—'}</TableCell>
                                    <TableCell className="text-xs">{fmtDate(d.created_at)}</TableCell>
                                    <TableCell>
                                        <Badge variant={d.tipo === 'DEVOLUCAO' ? 'destructive' : 'default'} className="text-[10px]">
                                            {d.tipo === 'DEVOLUCAO' ? 'Devolução' : 'Troca'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate">{d.motivo}</TableCell>
                                    <TableCell className="text-right font-bold text-rose-500">{fmt(d.valor_reembolso || 0)}</TableCell>
                                    <TableCell>
                                        <Select
                                            value={d.status}
                                            onChange={e => handleUpdateStatus(d.id, e.target.value)}
                                            className="h-7 text-xs w-28 border-0 bg-muted/30"
                                        >
                                            <option value="Pendente">Pendente</option>
                                            <option value="Aprovado">Aprovado</option>
                                            <option value="Concluido">Concluído</option>
                                            <option value="Recusado">Recusado</option>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(d)}><Pencil className="w-4 h-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); resetForm() }} title={editingItem ? "Editar Devolução" : "Registrar Devolução / Troca"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                <option value="DEVOLUCAO">Devolução</option>
                                <option value="TROCA">Troca</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="Pendente">Pendente</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Concluido">Concluído</option>
                                <option value="Recusado">Recusado</option>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Pedido Original (opcional)</Label>
                        <Select value={form.venda_id} onChange={e => handleVendaChange(e.target.value)}>
                            <option value="">Selecionar pedido...</option>
                            {vendas.map(v => (
                                <option key={v.id} value={v.id}>
                                    #{String(v.numero_pedido || 0).padStart(6, '0')} — {(v.clientes as any)?.nome || 'Consumidor'} — {fmt(v.total)}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Cliente (opcional)</Label>
                        <Select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                            <option value="">Sem cliente vinculado</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Motivo *</Label>
                        <Input required placeholder="Produto com defeito, peça errada..." value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Valor do Reembolso (R$)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.valor_reembolso} onChange={e => setForm({ ...form, valor_reembolso: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <textarea
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20"
                            value={form.observacoes}
                            onChange={e => setForm({ ...form, observacoes: e.target.value })}
                            placeholder="Detalhes adicionais..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" type="button" onClick={() => { setIsModalOpen(false); resetForm() }}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>{submitting ? 'Salvando...' : editingItem ? 'Salvar' : 'Registrar'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
