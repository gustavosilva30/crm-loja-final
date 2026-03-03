import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Search, Filter, MoreHorizontal, ShoppingCart, TrendingUp, Trash2, Printer, Truck } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Venda {
    id: string
    numero_pedido?: number
    cliente_id: string | null
    total: number
    status: 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado'
    origem_ml: boolean
    ml_order_id: string | null
    data_venda: string
    created_at: string
    total_pago?: number
    valor_aberto?: number
    clientes?: { nome: string, documento?: string, email?: string, telefone?: string, endereco?: string, saldo_haver?: number }
    atendentes?: { nome: string }
    vendas_itens?: { produtos: { nome: string } }[]
    forma_pagamento?: string
    atendente_id?: string
    itens?: any[]
}

export function VendasConcluidas() {
    const [searchTerm, setSearchTerm] = useState("")
    const [vendas, setVendas] = useState<Venda[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const [filterStatus, setFilterStatus] = useState<string>("todos")
    const [filterOrigem, setFilterOrigem] = useState<string>("todos")
    const [filterDataInicio, setFilterDataInicio] = useState<string>("")
    const [filterDataFim, setFilterDataFim] = useState<string>("")
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedVendaForReceipt, setSelectedVendaForReceipt] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)

    const [clientes, setClientes] = useState<any[]>([])
    const [transportadoras, setTransportadoras] = useState<any[]>([])
    const [company, setCompany] = useState<any>(null)
    const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom'>('a4')

    const fetchVendas = async () => {
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`
                    *, 
                    clientes ( id, nome, documento, email, telefone, endereco ),
                    atendentes ( nome ),
                    vendas_itens ( produtos ( nome ) )
                `)
                .order('data_venda', { ascending: false })

            if (error) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('vendas')
                    .select(`
                        *,
                        clientes ( id, nome, documento, email, telefone, endereco ),
                        vendas_itens ( produtos ( nome ) )
                    `)
                    .order('data_venda', { ascending: false })
                if (fallbackError) throw fallbackError
                setVendas(fallbackData || [])
            } else {
                setVendas(data || [])
            }
        } catch (err) {
            console.error('Error fetching vendas:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchResources = async () => {
        const { data: clients } = await supabase.from('clientes').select('id, nome, endereco, telefone, saldo_haver')
        const { data: carriers } = await supabase.from('transportadoras').select('id, nome')
        const { data: comp } = await supabase.from('configuracoes_empresa').select('*').maybeSingle()

        if (clients) setClientes(clients)
        if (carriers) setTransportadoras(carriers)
        if (comp) setCompany(comp)
    }

    useEffect(() => {
        fetchVendas()
        fetchResources()
    }, [])

    const handleCancelVenda = async (id: string) => {
        if (!confirm('Deseja realmente EXCLUIR/CANCELAR esta venda? Isso devolverá os produtos ao estoque e estornará pagamentos automaticamente.')) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('vendas').delete().eq('id', id);
            if (error) throw error;
            fetchVendas();
            alert('Venda excluída e valores estornados com sucesso.');
        } catch (e: any) {
            alert('Erro ao excluir: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const handleOpenReceipt = async (vendaId: string) => {
        if (!vendaId) return
        setLoading(true)
        try {
            let venda: any = null
            const { data: v1, error: e1 } = await supabase
                .from('vendas')
                .select(`*, clientes (id, nome, documento, email, telefone, endereco), atendentes (nome)`)
                .eq('id', vendaId)
                .single()

            if (e1) {
                const { data: v2, error: e2 } = await supabase
                    .from('vendas')
                    .select(`*, clientes (id, nome, documento, email, telefone, endereco)`)
                    .eq('id', vendaId)
                    .single()
                if (e2) throw e2
                venda = v2
            } else {
                venda = v1
            }

            const { data: itens } = await supabase.from('vendas_itens').select(`*, produtos (nome, sku)`).eq('venda_id', vendaId)
            const { data: entrega } = await supabase.from('entregas').select(`*, transportadoras (nome)`).eq('venda_id', vendaId).maybeSingle()

            setSelectedVendaForReceipt({ ...venda, itens: itens || [], entrega: entrega || null })
            setIsReceiptModalOpen(true)
        } catch (err: any) {
            console.error('Error loading receipt:', err)
            alert('Não foi possível carregar o pedido.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        const printContent = document.getElementById('printable-receipt')
        if (!printContent) return window.print()
        const printWindow = window.open('', '_blank', 'width=900,height=700')
        if (!printWindow) return window.print()
        printWindow.document.write(`<html><head><title>Pedido</title><style>body{font-family:sans-serif;padding:20px;}</style></head><body>${printContent.innerHTML}</body></html>`)
        printWindow.document.close()
        printWindow.print()
    }

    const formatNumPedido = (num?: number) => num ? String(num).padStart(6, '0') : '------'

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase().trim();
        const numPedidoStr = v.numero_pedido ? String(v.numero_pedido).padStart(6, '0') : '';
        const matchesSearch = !termLower ||
            numPedidoStr.includes(termLower) ||
            (v.clientes?.nome?.toLowerCase() || '').includes(termLower) ||
            v.vendas_itens?.some(i => (i.produtos?.nome || '').toLowerCase().includes(termLower));
        const matchesStatus = filterStatus === "todos" ? String(v.status).toLowerCase() !== 'pendente' : v.status === filterStatus;
        const matchesOrigem = filterOrigem === "todos" ? true : filterOrigem === "ml" ? v.origem_ml : !v.origem_ml;

        let matchesPeriodo = true;
        if (filterDataInicio || filterDataFim) {
            const dataVenda = v.data_venda.split('T')[0];
            if (filterDataInicio && dataVenda < filterDataInicio) matchesPeriodo = false;
            if (filterDataFim && dataVenda > filterDataFim) matchesPeriodo = false;
        }
        return matchesSearch && matchesStatus && matchesOrigem && matchesPeriodo;
    })

    const faturamentoTotal = vendas.filter(v => v.status !== 'Cancelado').reduce((acc, v) => acc + (v.total || 0), 0)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Histórico de Vendas</h1>
                    <p className="text-muted-foreground mt-1">Vendas finalizadas, enviadas ou canceladas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoTotal)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Concluídos</CardTitle>
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredVendas.length} pedidos</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar venda..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Button variant="outline" className="gap-2" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                            <Filter className="w-4 h-4" /> Filtros
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isFilterOpen && (
                        <div className="grid grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-muted/20">
                            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="todos">Todos (exceto pendentes)</option>
                                <option value="Pago">Pago</option>
                                <option value="Enviado">Enviado</option>
                                <option value="Entregue">Entregue</option>
                                <option value="Cancelado">Cancelado</option>
                            </Select>
                            <Input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} />
                            <Input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} />
                            <Button variant="ghost" onClick={() => { setFilterStatus("todos"); setFilterDataInicio(""); setFilterDataFim(""); }}>Limpar</Button>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Produtos</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVendas.map((venda) => (
                                <TableRow key={venda.id}>
                                    <TableCell className="font-mono">#{formatNumPedido(venda.numero_pedido)}</TableCell>
                                    <TableCell>{venda.clientes?.nome || 'Consumidor Final'}</TableCell>
                                    <TableCell className="text-xs">{venda.atendentes?.nome || '-'}</TableCell>
                                    <TableCell className="max-w-[200px] truncate text-[13px] font-medium" title={venda.vendas_itens?.map((i: any) => i.produtos?.nome).join(', ')}>
                                        {venda.vendas_itens?.map((i: any) => i.produtos?.nome).join(', ') || '-'}
                                    </TableCell>
                                    <TableCell className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total)}</TableCell>
                                    <TableCell><Badge variant={venda.status === 'Cancelado' ? 'destructive' : 'default'}>{venda.status}</Badge></TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenReceipt(venda.id)} title="Imprimir"><Printer className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/vendas?edit=${venda.id}`)} title="Editar"><Search className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleCancelVenda(venda.id)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Recibo" className="max-w-4xl">
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        <div className="flex justify-end gap-2">
                            <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
                        </div>
                        <div id="printable-receipt" className="p-8 bg-white text-black border shadow-sm">
                            <div className="flex justify-between items-start border-b-2 border-slate-200 pb-4 mb-6">
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{company?.nome_fantasia || 'AUTO PEÇAS'}</h1>
                                    <p className="text-[10px] text-slate-500 font-mono leading-none">
                                        {company?.razao_social}<br />
                                        CNPJ: {company?.cnpj || '00.000.000/0000-00'}<br />
                                        {company?.logradouro}, {company?.numero} - {company?.bairro}<br />
                                        {company?.cidade}/{company?.estado}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="bg-slate-900 text-white px-3 py-1 font-black text-lg">RECIBO #{formatNumPedido(selectedVendaForReceipt.numero_pedido)}</span>
                                    <p className="text-[10px] mt-1 font-bold">{new Date(selectedVendaForReceipt.data_venda).toLocaleString('pt-BR')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 border border-slate-200 mb-6">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-black text-slate-400">Cliente</Label>
                                    <p className="text-sm font-bold">{selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR FINAL'}</p>
                                    <p className="text-[10px] text-slate-500">TEL: {selectedVendaForReceipt.clientes?.telefone || '---'}</p>
                                </div>
                                <div className="space-y-1 border-l border-slate-200 pl-4">
                                    <Label className="text-[9px] uppercase font-black text-slate-400">Venda</Label>
                                    <p className="text-sm font-bold">Pagamento: {selectedVendaForReceipt.forma_pagamento || '---'}</p>
                                    <p className="text-sm font-bold uppercase text-[10px]"><span className="text-slate-500">Status:</span> {selectedVendaForReceipt.status}</p>
                                </div>
                            </div>

                            <table className="w-full mb-6">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase font-black text-slate-400 border-b-2 border-slate-100">
                                        <th className="pb-2">Produto</th>
                                        <th className="pb-2 text-center">Qtd</th>
                                        <th className="pb-2 text-right">Unitário</th>
                                        <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedVendaForReceipt.itens.map((i: any, idx: number) => (
                                        <tr key={idx} className="text-sm">
                                            <td className="py-2">
                                                <span className="font-bold">{i.produtos?.nome}</span>
                                            </td>
                                            <td className="py-2 text-center font-bold">{i.quantidade}</td>
                                            <td className="py-2 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.preco_unitario || (i.subtotal / i.quantidade))}</td>
                                            <td className="py-2 text-right font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.subtotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="flex flex-col items-end gap-2 border-t-2 border-slate-200 pt-4">
                                <div className="flex gap-10 items-center">
                                    <span className="text-sm font-bold uppercase text-slate-400">Total</span>
                                    <span className="text-3xl font-black text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                </div>
                            </div>

                            <div className="mt-16 text-center">
                                <p className="text-[10px] text-slate-400 uppercase font-black italic tracking-widest">{company?.mensagem_rodape || 'Obrigado pela preferência!'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
