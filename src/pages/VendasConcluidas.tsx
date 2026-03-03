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
import { Search, Filter, MoreHorizontal, ShoppingCart, TrendingUp, Trash2, Printer, Truck, Pencil } from "lucide-react"
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

        const styles = `
            @page { 
                margin: 0;
                size: ${printFormat === 'a4' ? 'A4' : printFormat === 'a5' ? 'A5' : '80mm auto'};
            }
            body { 
                font-family: 'Inter', system-ui, sans-serif; 
                margin: 0; 
                padding: 0;
                color: #000;
                background: #fff;
            }
            .receipt-container { 
                width: ${printFormat === 'cupom' ? '80mm' : printFormat === 'a5' ? '148mm' : '210mm'};
                padding: ${printFormat === 'cupom' ? '6mm' : '15mm'};
                margin: 0 auto;
                background: white;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; border-bottom: 2px solid #000; padding: 5px; font-size: 11px; text-transform: uppercase; }
            td { padding: 5px; border-bottom: 1px dotted #ccc; font-size: 12px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-black { font-weight: 900; }
            .font-bold { font-weight: 700; }
            .uppercase { text-transform: uppercase; }
            .border-b-2 { border-bottom: 2px solid #000; }
            .mb-6 { margin-bottom: 24px; }
            .text-2xl { font-size: 24px; }
            .text-lg { font-size: 18px; }
            .ticket-double-line { border-top: 3px double #000; margin: 5px 0; }
            @media print {
                body { background: none; }
                .receipt-container { box-shadow: none; }
            }
        `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Recibo #${formatNumPedido(selectedVendaForReceipt.numero_pedido)}</title>
                    <style>${styles}</style>
                </head>
                <body>
                    <div class="receipt-container">
                        ${printContent.innerHTML}
                    </div>
                </body>
            </html>
        `)
        printWindow.document.close()
        // Pequeno delay para garantir que renderizou
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 500)
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

            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Recibo de Venda" className="max-w-4xl">
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Label className="text-xs font-bold uppercase text-slate-500">Formato de Impressão:</Label>
                                <div className="flex bg-white border rounded-md p-1">
                                    <button
                                        className={`px-3 py-1 text-xs font-bold rounded ${printFormat === 'a4' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                        onClick={() => setPrintFormat('a4')}
                                    >
                                        A4 (Normal)
                                    </button>
                                    <button
                                        className={`px-3 py-1 text-xs font-bold rounded ${printFormat === 'a5' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                        onClick={() => setPrintFormat('a5')}
                                    >
                                        A5 (Meia Folha)
                                    </button>
                                    <button
                                        className={`px-3 py-1 text-xs font-bold rounded ${printFormat === 'cupom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                        onClick={() => setPrintFormat('cupom')}
                                    >
                                        Cupom (Térmica)
                                    </button>
                                </div>
                            </div>
                            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
                                <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
                            </Button>
                        </div>

                        <div id="printable-receipt" className={`bg-white text-black border shadow-sm mx-auto ${printFormat === 'cupom' ? 'w-[300px] p-2' : printFormat === 'a5' ? 'w-[560px] p-6' : 'w-full p-8'}`}>
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

                            {/* SEÇÃO DE ENTREGA (SE HOUVER) */}
                            {selectedVendaForReceipt.entrega && (
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center gap-4 mb-6">
                                    <Truck className="w-8 h-8 text-slate-400 opacity-50" />
                                    <div className="space-y-1">
                                        <Label className="text-[9px] uppercase font-black text-slate-500">Dados para Entrega</Label>
                                        <p className="text-xs font-bold uppercase">{selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero}</p>
                                        <p className="text-[10px] text-slate-500">{selectedVendaForReceipt.entrega.bairro} - {selectedVendaForReceipt.entrega.cidade}/{selectedVendaForReceipt.entrega.estado}</p>
                                        <p className="text-[10px] font-bold">CONTATO: {selectedVendaForReceipt.entrega.contato}</p>
                                    </div>
                                </div>
                            )}

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
