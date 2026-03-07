import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Target, TrendingUp, Plus, Pencil, ChevronLeft, ChevronRight } from "lucide-react"

import { fmt } from "@/lib/format"

const pct = (a: number, b: number) => b > 0 ? Math.min(100, (a / b) * 100).toFixed(1) : '0.0'

function getMesAno(offset = 0) {
    const d = new Date()
    d.setMonth(d.getMonth() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMesAno(mesAno: string) {
    const [y, m] = mesAno.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

export function MetasVendedores() {
    const [metas, setMetas] = useState<any[]>([])
    const [atendentes, setAtendentes] = useState<any[]>([])
    const [vendas, setVendas] = useState<any[]>([])
    const [mesAno, setMesAno] = useState(getMesAno(0))
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMeta, setEditingMeta] = useState<any>(null)
    const [form, setForm] = useState({ atendente_id: '', meta_valor: '', comissao_percentual: '' })

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [y, m] = mesAno.split('-')
        const startDate = `${mesAno}-01`
        const endDate = `${mesAno}-31`

        const [metasRes, ateRes, vendasRes] = await Promise.all([
            supabase.from('metas_vendedores').select('*, atendentes(nome)').eq('mes_ano', mesAno),
            supabase.from('atendentes').select('id, nome'),
            supabase.from('vendas')
                .select('total, status, atendente_id')
                .gte('data_venda', startDate)
                .lte('data_venda', endDate + 'T23:59:59')
                .neq('status', 'Cancelado')
        ])
        setMetas(metasRes.data || [])
        setAtendentes(ateRes.data || [])
        setVendas(vendasRes.data || [])
        setLoading(false)
    }, [mesAno])

    useEffect(() => { fetchData() }, [fetchData])

    const getVendasAtendente = (atendenteId: string) => {
        return vendas.filter(v => v.atendente_id === atendenteId).reduce((a, v) => a + (v.total || 0), 0)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload = {
            atendente_id: form.atendente_id,
            mes_ano: mesAno,
            meta_valor: parseFloat(form.meta_valor),
            comissao_percentual: parseFloat(form.comissao_percentual) || 0
        }
        if (editingMeta) {
            await supabase.from('metas_vendedores').update(payload).eq('id', editingMeta.id)
        } else {
            await supabase.from('metas_vendedores').upsert([payload], { onConflict: 'atendente_id,mes_ano' })
        }
        setIsModalOpen(false)
        setEditingMeta(null)
        setForm({ atendente_id: '', meta_valor: '', comissao_percentual: '' })
        fetchData()
    }

    const handleEdit = (meta: any) => {
        setEditingMeta(meta)
        setForm({
            atendente_id: meta.atendente_id,
            meta_valor: String(meta.meta_valor),
            comissao_percentual: String(meta.comissao_percentual)
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta meta?')) return
        await supabase.from('metas_vendedores').delete().eq('id', id)
        fetchData()
    }

    const handlePrevMonth = () => setMesAno(getMesAno(-1))
    const handleNextMonth = () => setMesAno(getMesAno(1))

    // Soma geral
    const totalVendas = vendas.reduce((a, v) => a + (v.total || 0), 0)
    const totalMeta = metas.reduce((a, m) => a + (m.meta_valor || 0), 0)
    const totalComissao = metas.reduce((a, m) => {
        const vendasAte = getVendasAtendente(m.atendente_id)
        return a + vendasAte * ((m.comissao_percentual || 0) / 100)
    }, 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Metas & Comissões</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe o desempenho dos vendedores.</p>
                </div>
                <Button className="gap-2" onClick={() => { setEditingMeta(null); setForm({ atendente_id: '', meta_valor: '', comissao_percentual: '' }); setIsModalOpen(true) }}>
                    <Plus className="w-4 h-4" /> Definir Meta
                </Button>
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                <h2 className="text-lg font-semibold capitalize">{labelMesAno(mesAno)}</h2>
                <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Vendido</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-emerald-500">{fmt(totalVendas)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Meta Total do Mês</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{fmt(totalMeta)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissões a Pagar</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-500">{fmt(totalComissao)}</div></CardContent>
                </Card>
            </div>

            {/* Tabela */}
            <Card>
                <CardHeader><CardTitle className="text-base">Desempenho por Vendedor</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">{Array(3).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
                    ) : atendentes.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">Nenhum atendente cadastrado.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead className="text-right">Meta</TableHead>
                                    <TableHead className="text-right">Vendido</TableHead>
                                    <TableHead>Atingimento</TableHead>
                                    <TableHead className="text-right">Comissão %</TableHead>
                                    <TableHead className="text-right">Comissão R$</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {atendentes.map(ate => {
                                    const meta = metas.find(m => m.atendente_id === ate.id)
                                    const vendido = getVendasAtendente(ate.id)
                                    const metaValor = meta?.meta_valor || 0
                                    const comissaoPct = meta?.comissao_percentual || 0
                                    const comissaoValor = vendido * (comissaoPct / 100)
                                    const atingPct = parseFloat(pct(vendido, metaValor))
                                    return (
                                        <TableRow key={ate.id}>
                                            <TableCell className="font-semibold">{ate.nome}</TableCell>
                                            <TableCell className="text-right text-sm">{metaValor > 0 ? fmt(metaValor) : <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className={`text-right font-bold ${vendido > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>{fmt(vendido)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${atingPct >= 100 ? 'bg-emerald-500' : atingPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                            style={{ width: `${Math.min(atingPct, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-bold w-12 ${atingPct >= 100 ? 'text-emerald-500' : atingPct >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                        {metaValor > 0 ? `${atingPct}%` : '—'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-sm">{comissaoPct > 0 ? `${comissaoPct}%` : <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className="text-right font-bold text-amber-500">{comissaoValor > 0 ? fmt(comissaoValor) : <span className="text-muted-foreground">—</span>}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => meta ? handleEdit(meta) : setIsModalOpen(true)}>
                                                    {meta ? <Pencil className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingMeta(null) }} title={editingMeta ? "Editar Meta" : "Definir Meta"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Vendedor *</Label>
                        <Select required value={form.atendente_id} onChange={e => setForm({ ...form, atendente_id: e.target.value })}>
                            <option value="">Selecione o vendedor</option>
                            {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Meta de Vendas (R$) *</Label>
                            <Input required type="number" step="0.01" min="0" placeholder="0,00" value={form.meta_valor} onChange={e => setForm({ ...form, meta_valor: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Comissão (%)</Label>
                            <Input type="number" step="0.1" min="0" max="100" placeholder="0" value={form.comissao_percentual} onChange={e => setForm({ ...form, comissao_percentual: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Meta</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
