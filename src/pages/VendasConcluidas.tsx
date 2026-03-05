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
import { Search, Filter, MoreHorizontal, ShoppingCart, TrendingUp, Trash2, Printer, Truck, Pencil, Package, DollarSign } from "lucide-react"
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
    vendedor?: { nome: string }
    atendente?: { nome: string }
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
    const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom' | 'cupom58'>('a4')
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredVendas.length && filteredVendas.length > 0) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredVendas.map(v => v.id))
        }
    }

    const handleBulkCancel = async () => {
        if (!confirm(`Tem certeza que deseja cancelar ${selectedIds.length} pedidos concluídos?`)) return
        setSubmitting(true)
        try {
            for (const id of selectedIds) {
                await supabase.from('vendas').update({ status: 'Cancelado' }).eq('id', id)
            }
            alert('Pedidos cancelados com sucesso.')
            setSelectedIds([])
            fetchVendas()
        } catch (err: any) {
            alert('Erro ao cancelar pedidos: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const fetchVendas = async () => {
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`
                    *,
                    clientes ( id, nome, documento, email, telefone, endereco ),
                    vendas_itens ( produto_id, quantidade, preco_unitario, subtotal, produtos ( nome ) )
                `)
                .order('data_venda', { ascending: false })

            if (error) throw error

            const rows = data || []
            const atendenteIds = [...new Set([
                ...rows.map((v: any) => v.atendente_id),
                ...rows.map((v: any) => v.vendedor_id)
            ].filter(Boolean))]

            let atMap: Record<string, string> = {}
            if (atendenteIds.length > 0) {
                const { data: ats } = await supabase
                    .from('atendentes')
                    .select('id, nome')
                    .in('id', atendenteIds)
                if (ats) ats.forEach((a: any) => { atMap[a.id] = a.nome })
            }

            setVendas(rows.map((v: any) => ({
                ...v,
                atendentes: v.atendente_id ? { nome: atMap[v.atendente_id] || '' } : null,
                vendedor: v.vendedor_id ? { nome: atMap[v.vendedor_id] || '' } : null,
            })))
        } catch (err) {
            console.error('Error fetching vendas:', err)
            setVendas([])
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
        const venda = vendas.find(v => v.id === id);
        if (!venda) return;

        if (!confirm('Deseja realmente CANCELAR esta venda? Isso devolverá os produtos ao estoque e ESTORNARÁ pagamentos (Saldo Caixa ou Haver Cliente).')) return;

        setSubmitting(true);
        try {
            // 1. Estorno Financeiro
            if (venda.status === 'Pago' || venda.status === 'Entregue') {
                if (venda.forma_pagamento === 'Dinheiro') {
                    const confirmCaixa = confirm('Deseja retirar o valor do Saldo de Caixa?');
                    if (confirmCaixa) {
                        await supabase.from('financeiro_lancamentos').insert([{
                            tipo: 'Despesa',
                            valor: venda.total,
                            data_vencimento: new Date().toISOString().split('T')[0],
                            data_pagamento: new Date().toISOString().split('T')[0],
                            status: 'Pago',
                            forma_pagamento: 'Dinheiro',
                            venda_id: venda.id,
                            descricao: `ESTORNO: Venda #${formatNumPedido(venda.numero_pedido)} CANCELADA`
                        }]);
                    }
                } else if (venda.forma_pagamento === 'Haver Cliente' && venda.cliente_id) {
                    const { data: cliente } = await supabase.from('clientes').select('saldo_haver').eq('id', venda.cliente_id).single();
                    if (cliente) {
                        await supabase.from('clientes').update({ saldo_haver: (cliente.saldo_haver || 0) + venda.total }).eq('id', venda.cliente_id);
                    }
                }
            }

            // 2. Atualizar Status para Cancelado
            const { error } = await supabase.from('vendas').update({ status: 'Cancelado' }).eq('id', id);
            if (error) throw error;

            fetchVendas();
            alert('Venda cancelada e valores estornados com sucesso.');
        } catch (e: any) {
            alert('Erro ao cancelar: ' + e.message);
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
                .select(`*, clientes (id, nome, documento, email, telefone, endereco), atendentes:atendente_id (nome), vendedor:vendedor_id (nome)`)
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



    const formatNumPedido = (num?: number) => num ? String(num).padStart(6, '0') : '------'

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase().trim();
        const numPedidoStr = v.numero_pedido ? String(v.numero_pedido).padStart(6, '0') : '';
        const matchesSearch = !termLower ||
            numPedidoStr.includes(termLower) ||
            (v.clientes?.nome?.toLowerCase() || '').includes(termLower) ||
            (v.atendentes?.nome?.toLowerCase() || '').includes(termLower) ||
            (v.vendedor?.nome?.toLowerCase() || '').includes(termLower) ||
            (v.atendente?.nome?.toLowerCase() || '').includes(termLower) ||
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
                        <div className="flex items-center gap-2">
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-2 mr-4 bg-muted p-1 px-2 rounded-md border text-sm font-medium animate-in fade-in slide-in-from-left-2">
                                    <span className="text-xs text-muted-foreground">{selectedIds.length} selecionados</span>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={handleBulkCancel}>
                                        <Trash2 className="w-3 h-3 mr-1" /> Cancelar
                                    </Button>
                                </div>
                            )}
                            <Button variant="outline" className="gap-2" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                                <Filter className="w-4 h-4" /> Filtros
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isFilterOpen && (
                        <div className="grid grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-muted/20">
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="todos">Todos (exceto pendentes)</option>
                                <option value="Pago">Pago</option>
                                <option value="Enviado">Enviado</option>
                                <option value="Entregue">Entregue</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                            <Input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} />
                            <Input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} />
                            <Button variant="ghost" onClick={() => { setFilterStatus("todos"); setFilterDataInicio(""); setFilterDataFim(""); }}>Limpar</Button>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        checked={filteredVendas.length > 0 && selectedIds.length === filteredVendas.length}
                                        onChange={toggleSelectAll}
                                    />
                                </TableHead>
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
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center">Carregando...</TableCell></TableRow>
                            ) : filteredVendas.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center">Nenhuma venda encontrada.</TableCell></TableRow>
                            ) : filteredVendas.map((venda) => (
                                <TableRow key={venda.id} className={selectedIds.includes(venda.id) ? 'bg-muted/50' : ''}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                            checked={selectedIds.includes(venda.id)}
                                            onChange={() => toggleSelect(venda.id)}
                                        />
                                    </TableCell>
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
                                        <Button variant="ghost" size="icon" className="text-blue-500" onClick={() => navigate(`/vendas?edit=${venda.id}`)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                                        {venda.status !== 'Cancelado' && (
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleCancelVenda(venda.id)} title="Cancelar"><TrendingUp className="w-4 h-4 rotate-180" /></Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Impressão de Venda" className="max-w-4xl">
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg no-print">
                            <div className="flex gap-2">
                                <Button
                                    variant={printFormat === 'a4' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPrintFormat('a4')}
                                    className="h-8"
                                >
                                    Papel A4
                                </Button>
                                <Button
                                    variant={printFormat === 'a5' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPrintFormat('a5')}
                                    className="h-8"
                                >
                                    Papel A5
                                </Button>
                                <Button
                                    variant={printFormat === 'cupom' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPrintFormat('cupom')}
                                    className="h-8"
                                >
                                    Cupom (80mm)
                                </Button>
                                <Button
                                    variant={printFormat === 'cupom58' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPrintFormat('cupom58')}
                                    className="h-8"
                                >
                                    Cupom (58mm)
                                </Button>
                            </div>
                            <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90">
                                <Printer className="w-4 h-4 mr-2" /> Imprimir Agora
                            </Button>
                        </div>

                        <div className="bg-slate-100 p-8 overflow-auto max-h-[70vh] rounded-lg border border-slate-200">
                            <style>{`
                                 @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
 
                                 .print-preview-container { 
                                     background-color: #ffffff !important; 
                                     color: #000000 !important;
                                     margin-left: auto;
                                     margin-right: auto;
                                     box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                                     overflow: visible;
                                     min-height: 100px;
                                 }
 
                                 /* Reset Geral para Impressão */
                                 @media print {
                                     @page { margin: 0; size: auto; }
                                     * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                                     body * { visibility: hidden !important; }
                                     .print-preview-container, .print-preview-container * { visibility: visible !important; }
                                     
                                     .print-preview-container { 
                                         position: fixed !important;
                                         left: 0 !important;
                                         top: 0 !important;
                                         width: 100% !important;
                                         height: 100% !important;
                                         margin: 0 !important;
                                         padding: 0 !important;
                                         background: white !important;
                                         z-index: 99999 !important;
                                         display: flex !important;
                                         flex-direction: column !important;
                                         align-items: center !important;
                                         visibility: visible !important;
                                     }
                                     
                                     .no-print { display: none !important; }
                                 }

                                 /* Contêineres de Formato com Escalonamento Fluido */
                                 .a4 { 
                                     width: 210mm; 
                                     min-height: 297mm; 
                                     padding: 15mm; 
                                     font-size: 11pt;
                                     --base-font: 11pt;
                                 }
                                 .a5 { 
                                     width: 148mm; 
                                     min-height: 210mm; 
                                     padding: 8mm; 
                                     font-size: 9pt;
                                     --base-font: 9pt;
                                 }
                                 .cupom { 
                                     width: 80mm; 
                                     padding: 4mm; 
                                     font-size: 10pt;
                                     --base-font: 10pt;
                                     font-family: 'Courier Prime', monospace;
                                 }
                                 .cupom58 { 
                                     width: 58mm; 
                                     padding: 2mm; 
                                     font-size: 8pt;
                                     --base-font: 8pt;
                                     font-family: 'Courier Prime', monospace;
                                 }

                                 .a4, .a5, .cupom, .cupom58 {
                                     font-family: 'Inter', sans-serif;
                                     background: white;
                                     margin: 0 auto;
                                     color: #000;
                                     box-sizing: border-box;
                                 }

                                 /* Estilos Responsivos Compartilhados */
                                 .formal-header { 
                                     border: 1px solid #000; 
                                     padding: 10px; 
                                     display: flex; 
                                     align-items: center; 
                                     justify-content: space-between; 
                                     margin-bottom: 15px; 
                                 }
                                 .formal-table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                                 .formal-table th { 
                                     text-align: left; 
                                     font-size: calc(var(--base-font) * 0.85); 
                                     border-bottom: 2px solid #000; 
                                     padding: 5px 2px;
                                     text-transform: uppercase; 
                                 }
                                 .formal-table td { 
                                     padding: 6px 2px; 
                                     font-size: var(--base-font); 
                                     border-bottom: 1px dotted #ccc; 
                                 }
                                 .formal-section { border-top: 2px solid #000; margin-top: 15px; padding-top: 5px; }
                                 .formal-label { font-size: calc(var(--base-font) * 0.75); font-weight: bold; text-transform: uppercase; }
                                 
                                 /* Estilos específicos para Cupom */
                                 .ticket-line { border-top: 1px dashed #000; margin: 4px 0; }
                                 .ticket-double-line { border-top: 3px double #000; margin: 6px 0; }
                                 .ticket-header { text-align: center; margin-bottom: 10px; }
                                 .ticket-title { font-weight: 800; text-align: center; text-transform: uppercase; margin: 8px 0; font-size: 1.2em; }
                                 .ticket-content { width: 100%; }
                             `}</style>

                            <div className={`print-preview-container ${printFormat}`}>
                                {printFormat.includes('cupom') ? (
                                    /* LAYOUT TICKET TÉRMICO */
                                    <div className="ticket-content">
                                        <div className="ticket-header">
                                            <p className="font-bold text-lg">{company?.nome_fantasia || 'LOJA'}</p>
                                            <p>CNPJ: {company?.cnpj || '00.000.000/0000-00'}</p>
                                            <p>{company?.logradouro}, {company?.numero}</p>
                                            <p>{company?.bairro} - {company?.cidade}/{company?.estado}</p>
                                            <p>TEL: {company?.telefone || '(00) 0000-0000'}</p>
                                            <p>Vendedor: {selectedVendaForReceipt.atendentes?.nome || 'N/A'}</p>
                                        </div>

                                        <div className="ticket-double-line" />
                                        <div className="ticket-title">VENDA Nº {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</div>
                                        <div className="ticket-double-line" />

                                        <div className="grid grid-cols-2 text-[11px] mb-2">
                                            <div>Data: {new Date(selectedVendaForReceipt.data_venda).toLocaleDateString()}</div>
                                            {selectedVendaForReceipt.entrega && <div className="text-right">Entrega: ATIVA</div>}
                                        </div>

                                        <div className="space-y-0.5 mb-2 text-black">
                                            <p><span className="font-bold">Cliente:</span> {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR'}</p>
                                            <p><span className="font-bold">Telefone:</span> {selectedVendaForReceipt.clientes?.telefone || '---'}</p>

                                            {selectedVendaForReceipt.entrega && (
                                                <div className="mt-2 pt-1 border-t border-black" style={{ backgroundColor: '#f9f9f9' }}>
                                                    <p className="font-bold text-center underline mb-1">ENTREGA</p>
                                                    <p className="text-black"><span className="font-bold">End:</span> {selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero}</p>
                                                    <p className="text-black"><span className="font-bold">Bairro:</span> {selectedVendaForReceipt.entrega.bairro}</p>
                                                    <p className="text-black"><span className="font-bold">Cidade:</span> {selectedVendaForReceipt.entrega.cidade}</p>
                                                    <p className="font-bold text-center mt-1 border border-black uppercase text-[12px] bg-white text-black">
                                                        {selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? '✅ JÁ ESTÁ PAGO' : '💰 COBRAR NA ENTREGA'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="ticket-line" />
                                        <div className="text-center font-bold">PRODUTOS</div>
                                        <div className="ticket-line" />

                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="text-left border-b border-black">
                                                    <th>Nome</th>
                                                    <th className="text-right">Qtd</th>
                                                    <th className="text-right">Unit</th>
                                                    <th className="text-right">Sub</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedVendaForReceipt.itens?.map((i: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="py-1">{i.produtos?.nome}</td>
                                                        <td className="text-right">{i.quantidade}</td>
                                                        <td className="text-right">{(i.preco_unitario || (i.subtotal / i.quantidade)).toFixed(2)}</td>
                                                        <td className="text-right font-bold">{i.subtotal.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="ticket-double-line" />
                                        <div className="text-center font-bold">PAGAMENTO</div>
                                        <div className="ticket-double-line" />

                                        <div className="flex justify-between font-bold text-lg py-1">
                                            <span>Total da Venda:</span>
                                            <span>R$ {selectedVendaForReceipt.total.toFixed(2)}</span>
                                        </div>

                                        <div className="ticket-line" />
                                        <div className="grid grid-cols-2 text-[10px]">
                                            <div><span className="font-bold">Data</span><br />{new Intl.DateTimeFormat('pt-BR').format(new Date(selectedVendaForReceipt.data_venda))}</div>
                                            <div><span className="font-bold">Forma</span><br />{selectedVendaForReceipt.forma_pagamento}</div>
                                        </div>

                                        <div className="mt-8 text-center text-[10px]">
                                            <p>*** Este ticket não é documento fiscal ***</p>
                                            <div className="mt-10 border-t border-black w-3/4 mx-auto pt-1">Assinatura do cliente</div>
                                            <p className="mt-6 italic opacity-50 text-[8px]">{company?.nome_fantasia} - CRM</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* LAYOUT FORMAL A4/A5 */
                                    <div className="formal-content">
                                        <div className="formal-header">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 border border-black rounded-lg flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-black" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-xl leading-none text-black">{company?.nome_fantasia || 'SUA EMPRESA'}</p>
                                                    <p className="text-[10px] text-black italic">Comprovante de Venda</p>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-lg font-black uppercase text-black">RECIBO DE VENDA {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</p>
                                            </div>
                                            <div className="text-right text-[10px] space-y-0.5 text-black">
                                                <p>Página 1 de 1</p>
                                                <p>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>

                                        <div className="text-right text-[11px] font-bold mb-2">
                                            Emissão {new Date(selectedVendaForReceipt.data_venda).toLocaleDateString('pt-BR')}
                                        </div>

                                        <div className="border border-black p-3 space-y-1 text-black">
                                            <p className="text-sm">
                                                <span className="font-bold">Cliente:</span> {selectedVendaForReceipt.clientes?.documento || '---'} - {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR FINAL'}
                                            </p>
                                            <p className="text-[11px]">
                                                <span className="font-bold underline">Endereço:</span> {selectedVendaForReceipt.clientes?.endereco || 'Não informado'}
                                            </p>
                                            <div className="flex gap-10 text-[11px]">
                                                <p><span className="font-bold">Telefone:</span> {selectedVendaForReceipt.clientes?.telefone || '---'}</p>
                                                <p><span className="font-bold">E-mail:</span> {selectedVendaForReceipt.clientes?.email || '---'}</p>
                                            </div>

                                            {selectedVendaForReceipt.entrega && (
                                                <div className="mt-2 border-2 border-black p-2 bg-gray-50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="font-black text-xs underline">DADOS COMPLETOS PARA ENTREGA</p>
                                                        <p className={`font-black px-2 py-0.5 border-2 border-black ${selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? 'bg-white' : 'bg-black text-white'}`}>
                                                            {selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? 'CONFERIDO / PAGO' : 'COBRAR NO ATO'}
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-2 text-[11px] gap-x-4">
                                                        <p><span className="font-bold">Rua:</span> {selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero}</p>
                                                        <p><span className="font-bold">Bairro:</span> {selectedVendaForReceipt.entrega.bairro}</p>
                                                        <p><span className="font-bold">Cidade:</span> {selectedVendaForReceipt.entrega.cidade}/{selectedVendaForReceipt.entrega.estado}</p>
                                                        <p><span className="font-bold">CEP:</span> {selectedVendaForReceipt.entrega.cep}</p>
                                                        <p className="col-span-2 mt-1"><span className="font-bold">Contato Adicional:</span> {selectedVendaForReceipt.entrega.contato || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 text-[11px] pt-2 border-t mt-2">
                                                <p><span className="font-bold">Natureza da operação:</span> Venda de mercadoria</p>
                                                <p className="text-right"><span className="font-bold">Vendedor:</span> {selectedVendaForReceipt.atendentes?.nome || 'N/A'}</p>
                                            </div>
                                        </div>

                                        <table className="formal-table">
                                            <colgroup>
                                                <col style={{ width: '5%' }} />
                                                <col style={{ width: '45%' }} />
                                                <col style={{ width: '15%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '15%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Item / Descrição</th>
                                                    <th>SKU</th>
                                                    <th className="text-center">Qtd</th>
                                                    <th className="text-right">Vl un</th>
                                                    <th className="text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedVendaForReceipt.itens?.map((i: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="text-center">{idx + 1}</td>
                                                        <td>{i.produtos?.nome}</td>
                                                        <td className="font-mono text-[9px]">{i.produtos?.sku}</td>
                                                        <td className="text-center">{i.quantidade}</td>
                                                        <td className="text-right">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.preco_unitario || (i.subtotal / i.quantidade))}</td>
                                                        <td className="text-right font-bold">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.subtotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="grid grid-cols-2 gap-10 mt-6">
                                            <div className="space-y-4">
                                                <div className="formal-section">
                                                    <p className="formal-label">Cobrança</p>
                                                    <p className="text-sm font-bold">Forma de pagamento: {selectedVendaForReceipt.forma_pagamento}</p>
                                                    <p className="text-[10px]">Status: {selectedVendaForReceipt.status}</p>
                                                </div>
                                                <div className="formal-section">
                                                    <p className="formal-label">Status Financeiro</p>
                                                    <p className={`text-sm font-black mt-1 p-1 border border-black text-center ${selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? 'bg-white' : 'bg-black text-white'}`}>
                                                        {selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? '✅ PEDIDO PAGO' : '⚠️ AGUARDANDO PAGAMENTO'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="formal-section text-right">
                                                    <p className="formal-label">Totais</p>
                                                    <div className="flex justify-between text-sm py-1 text-black">
                                                        <span>Subtotal dos produtos</span>
                                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm py-1 text-black">
                                                        <span>Frete / Outros</span>
                                                        <span>R$ 0,00</span>
                                                    </div>
                                                    <div className="flex justify-between text-lg font-black border-t-2 border-black pt-2 mt-2 text-black">
                                                        <span>VALOR TOTAL</span>
                                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-12 pt-4 border-t border-dashed text-center">
                                            <p className="text-[10px] opacity-70 italic uppercase tracking-widest">{company?.mensagem_rodape || 'OBRIGADO PELA PREFERÊNCIA!'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
