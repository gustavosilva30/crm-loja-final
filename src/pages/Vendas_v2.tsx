import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Search, Filter, Trash2, Printer, Plus, X, UserPlus, PackagePlus, DollarSign, ShoppingCart } from "lucide-react"
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
    forma_pagamento?: string
    created_at: string
    clientes?: { id: string, nome: string, documento?: string, email?: string, telefone?: string, endereco?: string }
    atendentes?: { nome: string }
    vendas_itens?: { produtos: { nome: string } }[]
}

export function Vendas() {
    const [searchTerm, setSearchTerm] = useState("")
    const [vendas, setVendas] = useState<Venda[]>([])
    const [loading, setLoading] = useState(true)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Modals State
    const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedVendaForReceipt, setSelectedVendaForReceipt] = useState<any>(null)
    const [company, setCompany] = useState<any>(null)

    // resources for new sale
    const [clientes, setClientes] = useState<any[]>([])
    const [atendentes, setAtendentes] = useState<any[]>([])
    const [produtos, setProdutos] = useState<any[]>([])
    const [filterStatus, setFilterStatus] = useState<string>("Pendente")

    // Quick Creation Modals State
    const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false)
    const [isNovoProdutoModalOpen, setIsNovoProdutoModalOpen] = useState(false)

    // Form states for quick creation
    const [novoClienteForm, setNovoClienteForm] = useState({ nome: '', telefone: '', documento: '' })
    const [novoProdutoForm, setNovoProdutoForm] = useState({ nome: '', preco: 0, estoque_atual: 0 })

    // New Sale Form State
    const [vendaItems, setVendaItems] = useState<any[]>([{ produto_id: '', quantidade: 1, preco_unitario: 0, subtotal: 0 }])
    const [vendaForm, setVendaForm] = useState({
        cliente_id: '',
        atendente_id: '',
        status: 'Pendente' as const,
        forma_pagamento: 'Dinheiro'
    })

    const [isFinalizarModalOpen, setIsFinalizarModalOpen] = useState(false)
    const [vendaParaFinalizar, setVendaParaFinalizar] = useState<any>(null)
    const [finalizarForm, setFinalizarForm] = useState({
        forma_pagamento: 'Dinheiro',
        status: 'Pago' as const
    })

    const fetchVendas = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`*, clientes ( id, nome, documento, email, telefone, endereco ), atendentes ( nome ), vendas_itens ( produtos ( nome ) )`)
                .order('data_venda', { ascending: false })

            if (error) {
                // Fallback if atendentes join fails
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('vendas')
                    .select(`*, clientes ( id, nome, documento, email, telefone, endereco ), vendas_itens ( produtos ( nome ) )`)
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
        const { data: c } = await supabase.from('clientes').select('*').order('nome')
        const { data: a } = await supabase.from('atendentes').select('*').order('nome')
        const { data: p } = await supabase.from('produtos').select('*').gt('estoque_atual', 0).order('nome')
        if (c) setClientes(c)
        if (a) setAtendentes(a)
        if (p) setProdutos(p)
    }

    useEffect(() => {
        fetchVendas()
        fetchResources()
        supabase.from('configuracoes_empresa').select('*').maybeSingle().then(({ data }) => setCompany(data))
    }, [])

    const handleCancelVenda = async (id: string) => {
        if (!confirm('Deseja realmente EXCLUIR esta venda? Isso devolverá os produtos ao estoque e estornará pagamentos automaticamente.')) return;
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

    const handleAddItem = () => {
        setVendaItems([...vendaItems, { produto_id: '', quantidade: 1, preco_unitario: 0, subtotal: 0, _search: '' }])
    }

    const handleRemoveItem = (index: number) => {
        setVendaItems(vendaItems.filter((_, i) => i !== index))
    }

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...vendaItems]
        newItems[index][field] = value
        if (field === 'produto_id') {
            const prod = produtos.find(p => p.id === value)
            if (prod) {
                newItems[index].preco_unitario = prod.preco
                newItems[index].subtotal = prod.preco * newItems[index].quantidade
            }
        }
        if (field === 'quantidade' || field === 'preco_unitario') {
            newItems[index].subtotal = newItems[index].quantidade * newItems[index].preco_unitario
        }
        setVendaItems(newItems)
    }

    const calculateTotal = () => vendaItems.reduce((acc, item) => acc + item.subtotal, 0)

    const handleCreateVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!vendaForm.cliente_id && !confirm('Vender sem cliente?')) return
        setSubmitting(true)
        try {
            const total = calculateTotal()
            const { data: venda, error: vErr } = await supabase.from('vendas').insert({
                cliente_id: vendaForm.cliente_id || null,
                atendente_id: vendaForm.atendente_id || null,
                total,
                status: vendaForm.status,
                forma_pagamento: vendaForm.forma_pagamento,
                data_venda: new Date().toISOString()
            }).select().single()

            if (vErr) throw vErr

            const itensToInsert = vendaItems.map(item => ({
                venda_id: venda.id,
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                subtotal: item.subtotal
            }))

            const { error: iErr } = await supabase.from('vendas_itens').insert(itensToInsert)
            if (iErr) throw iErr

            alert('Venda realizada com sucesso!')
            setIsNovoPedidoModalOpen(false)
            setVendaItems([{ produto_id: '', quantidade: 1, preco_unitario: 0, subtotal: 0, _search: '' }])
            fetchVendas()
        } catch (err: any) {
            alert('Erro ao criar venda: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateNovoCliente = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { data, error } = await supabase.from('clientes').insert(novoClienteForm).select().single()
            if (error) throw error
            await fetchResources()
            setVendaForm({ ...vendaForm, cliente_id: data.id })
            setIsNovoClienteModalOpen(false)
            setNovoClienteForm({ nome: '', telefone: '', documento: '' })
        } catch (err: any) { alert('Erro: ' + err.message) }
        finally { setSubmitting(false) }
    }

    const handleCreateNovoProduto = async (e: React.FormEvent, index: number) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { data, error } = await supabase.from('produtos').insert({
                ...novoProdutoForm,
                preco: novoProdutoForm.preco,
                sku: `AUTO-${Date.now().toString().slice(-6)}`
            }).select().single()
            if (error) throw error
            await fetchResources()
            handleItemChange(index, 'produto_id', data.id)
            setIsNovoProdutoModalOpen(false)
            setNovoProdutoForm({ nome: '', preco: 0, estoque_atual: 0 })
        } catch (err: any) { alert('Erro: ' + err.message) }
        finally { setSubmitting(false) }
    }

    const handleFinalizarVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!vendaParaFinalizar) return
        setSubmitting(true)
        try {
            const { error } = await supabase.from('vendas').update({
                status: finalizarForm.status,
                forma_pagamento: finalizarForm.forma_pagamento
            }).eq('id', vendaParaFinalizar.id)

            if (error) throw error

            // Se estiver sendo fechada para Pago ou entregue, garantir que lance no financeiro se for venda direta
            if (finalizarForm.status === 'Pago') {
                await supabase.from('financeiro_lancamentos').insert([{
                    tipo: 'Receita',
                    valor: vendaParaFinalizar.total,
                    data_vencimento: new Date().toISOString().split('T')[0],
                    data_pagamento: new Date().toISOString().split('T')[0],
                    status: 'Pago',
                    forma_pagamento: finalizarForm.forma_pagamento,
                    venda_id: vendaParaFinalizar.id,
                    descricao: `Venda #${formatNumPedido(vendaParaFinalizar.numero_pedido)}`
                }])
            }

            alert('Venda finalizada com sucesso!')
            setIsFinalizarModalOpen(false)
            fetchVendas()
        } catch (err: any) {
            alert('Erro ao finalizar venda: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleOpenReceipt = async (vendaId: string) => {
        setLoading(true)
        try {
            const { data: venda } = await supabase.from('vendas').select(`*, clientes(*), atendentes(nome)`).eq('id', vendaId).single()
            const { data: itens } = await supabase.from('vendas_itens').select(`*, produtos(nome, sku)`).eq('venda_id', vendaId)
            setSelectedVendaForReceipt({ ...venda, itens: itens || [] })
            setIsReceiptModalOpen(true)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || (v.clientes?.nome?.toLowerCase() || '').includes(termLower) || String(v.numero_pedido).includes(termLower);
        const matchesStatus = String(v.status).toLowerCase() === 'pendente';
        return matchesSearch && matchesStatus;
    })

    const formatNumPedido = (num?: number) => num ? String(num).padStart(6, '0') : '------'

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendas Pendentes ({filteredVendas.length})</h1>
                    <p className="text-muted-foreground mt-1">Gerencie suas vendas em aberto.</p>
                </div>
                <Button onClick={() => setIsNovoPedidoModalOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4" /> Nova Venda
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar venda..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="gap-2" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                                <Filter className="w-4 h-4" /> Filtros
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
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
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
                            ) : filteredVendas.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center">Nenhuma venda pendente.</TableCell></TableRow>
                            ) : filteredVendas.map((venda) => (
                                <TableRow key={venda.id}>
                                    <TableCell className="font-mono">#{formatNumPedido(venda.numero_pedido)}</TableCell>
                                    <TableCell>{venda.clientes?.nome || 'Consumidor Final'}</TableCell>
                                    <TableCell className="text-xs">{venda.atendentes?.nome || '-'}</TableCell>
                                    <TableCell className="max-w-[200px] truncate text-[13px] font-medium" title={venda.vendas_itens?.map((i: any) => i.produtos?.nome).join(', ')}>
                                        {venda.vendas_itens?.map((i: any) => i.produtos?.nome).join(', ') || '-'}
                                    </TableCell>
                                    <TableCell className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total)}</TableCell>
                                    <TableCell><Badge variant="outline">{venda.status}</Badge></TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenReceipt(venda.id)} title="Imprimir"><Printer className="w-4 h-4" /></Button>
                                        <Button variant="outline" size="sm" className="h-8 gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20" onClick={() => { setVendaParaFinalizar(venda); setFinalizarForm({ ...finalizarForm, forma_pagamento: venda.forma_pagamento || 'Dinheiro' }); setIsFinalizarModalOpen(true); }}><DollarSign className="w-3 h-3" /> Fechar</Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleCancelVenda(venda.id)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* MODAL NOVA VENDA */}
            <Modal isOpen={isNovoPedidoModalOpen} onClose={() => setIsNovoPedidoModalOpen(false)} title="Nova Venda" className="max-w-4xl">
                <form onSubmit={handleCreateVenda} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Cliente</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1 text-primary"
                                    onClick={() => setIsNovoClienteModalOpen(true)}
                                >
                                    <UserPlus className="w-3 h-3" /> Novo Cliente
                                </Button>
                            </div>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                value={vendaForm.cliente_id}
                                onChange={e => setVendaForm({ ...vendaForm, cliente_id: e.target.value })}
                            >
                                <option value="" className="bg-background text-foreground">Consumidor Final</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id} className="bg-background text-foreground">
                                        {c.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Vendedor (Atendente)</Label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                value={vendaForm.atendente_id}
                                onChange={e => setVendaForm({ ...vendaForm, atendente_id: e.target.value })}
                            >
                                <option value="" className="bg-background text-foreground">Selecione o Vendedor...</option>
                                {atendentes.map(a => (
                                    <option key={a.id} value={a.id} className="bg-background text-foreground">
                                        {a.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Forma de Pagamento</Label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                value={vendaForm.forma_pagamento}
                                onChange={e => setVendaForm({ ...vendaForm, forma_pagamento: e.target.value })}
                            >
                                <option value="Dinheiro" className="bg-background text-foreground">Dinheiro</option>
                                <option value="Pix" className="bg-background text-foreground">PIX</option>
                                <option value="Cartão Crédito" className="bg-background text-foreground">Cartão de Crédito</option>
                                <option value="Cartão Débito" className="bg-background text-foreground">Cartão de Débito</option>
                                <option value="Haver Cliente" className="bg-background text-foreground">Haver Cliente</option>
                                <option value="Boleto" className="bg-background text-foreground">Boleto</option>
                                <option value="Cheque" className="bg-background text-foreground">Cheque</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-lg font-bold">Itens do Pedido</Label>
                            <Button type="button" size="sm" onClick={handleAddItem} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Item</Button>
                        </div>
                        {vendaItems.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-3 items-end border-b pb-4">
                                <div className="col-span-12 md:col-span-5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground italic">Pesquisar Produto (SKU ou Nome)</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 p-0 text-[10px] gap-1 text-primary hover:bg-transparent"
                                            onClick={() => setIsNovoProdutoModalOpen(true)}
                                        >
                                            <PackagePlus className="w-3.5 h-3.5" /> Novo
                                        </Button>
                                    </div>

                                    {!item.produto_id ? (
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="Digite partes do nome ou SKU..."
                                                className="pl-10 h-10 text-sm border-2 focus-visible:ring-primary shadow-sm"
                                                autoFocus
                                                value={item._search || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const newItems = [...vendaItems];
                                                    newItems[idx]._search = val;
                                                    setVendaItems(newItems);
                                                }}
                                            />
                                            {item._search && item._search.length >= 2 && (
                                                <div className="absolute z-[100] w-[140%] mt-1 bg-background border-2 rounded-xl shadow-2xl max-h-72 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in duration-200">
                                                    {produtos
                                                        .filter(p => {
                                                            const s = item._search.toLowerCase().split(' ').filter(x => x.length > 0);
                                                            const pName = p.nome.toLowerCase();
                                                            const pSku = (p.sku || '').toLowerCase();
                                                            // Match ALL parts of the search string (intelligent partial match)
                                                            return s.every(part => pName.includes(part) || pSku.includes(part));
                                                        })
                                                        .map(p => (
                                                            <div
                                                                key={p.id}
                                                                className="px-4 py-3 text-sm hover:bg-primary/10 cursor-pointer border-b last:border-0 flex justify-between items-center transition-colors group"
                                                                onClick={() => {
                                                                    handleItemChange(idx, 'produto_id', p.id);
                                                                    const newItems = [...vendaItems];
                                                                    newItems[idx]._search = '';
                                                                    setVendaItems(newItems);
                                                                }}
                                                            >
                                                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                                    <span className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.nome}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono uppercase tracking-wider">SKU: {p.sku || 'N/A'}</span>
                                                                        <span className={`text-[10px] font-bold ${p.estoque_atual <= 5 ? 'text-destructive' : 'text-emerald-500'}`}>
                                                                            📦 {p.estoque_atual} un
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="ml-4 text-right">
                                                                    <span className="font-black text-primary text-base">
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    }
                                                    {produtos.filter(p => {
                                                        const s = item._search.toLowerCase().split(' ').filter(x => x.length > 0);
                                                        const pName = p.nome.toLowerCase();
                                                        const pSku = (p.sku || '').toLowerCase();
                                                        return s.every(part => pName.includes(part) || pSku.includes(part));
                                                    }).length === 0 && (
                                                            <div className="px-4 py-8 text-sm text-center text-muted-foreground flex flex-col items-center gap-2">
                                                                <ShoppingCart className="w-8 h-8 opacity-20" />
                                                                <p className="italic">Nenhum produto encontrado com "{item._search}"</p>
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-3 border-2 rounded-xl bg-primary/5 border-primary/20 shadow-inner group">
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-black truncate text-primary uppercase tracking-tight">
                                                    {produtos.find(p => p.id === item.produto_id)?.nome}
                                                </p>
                                                <p className="text-[10px] font-mono text-muted-foreground">
                                                    SKU: {produtos.find(p => p.id === item.produto_id)?.sku || '---'}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-[11px] font-bold border-primary/30 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                                onClick={() => handleItemChange(idx, 'produto_id', '')}
                                            >
                                                Mudar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-4 md:col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase">Qtd</Label>
                                    <Input type="number" min="1" value={item.quantidade} onChange={e => handleItemChange(idx, 'quantidade', parseInt(e.target.value))} required />
                                </div>
                                <div className="col-span-4 md:col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase">Preço</Label>
                                    <Input type="number" step="0.01" value={item.preco_unitario} onChange={e => handleItemChange(idx, 'preco_unitario', parseFloat(e.target.value))} required />
                                </div>
                                <div className="col-span-3 md:col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase">Subtotal</Label>
                                    <div className="h-9 flex items-center font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}</div>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveItem(idx)} disabled={vendaItems.length === 1}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-2xl font-black">TOTAL: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setIsNovoPedidoModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Finalizar Pedido'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* MODAL RECIBO */}
            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Pedido" className="max-w-4xl">
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        <div className="flex justify-end"><Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button></div>
                        <div id="printable-receipt" className="p-8 border bg-white text-black">
                            <h2 className="text-xl font-bold">Pedido #{formatNumPedido(selectedVendaForReceipt.numero_pedido)}</h2>
                            <p>Cliente: {selectedVendaForReceipt.clientes?.nome || '---'}</p>
                            <p>Forma: {selectedVendaForReceipt.forma_pagamento}</p>
                            <div className="my-4 border-t pt-4">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b text-left"><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
                                    <tbody>
                                        {selectedVendaForReceipt.itens?.map((i: any, idx: number) => (
                                            <tr key={idx}><td>{i.produtos?.nome}</td><td>{i.quantidade}</td><td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.preco_unitario)}</td><td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i.subtotal)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <h3 className="text-right text-lg font-bold">TOTAL: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</h3>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL NOVO CLIENTE RÁPIDO */}
            <Modal isOpen={isNovoClienteModalOpen} onClose={() => setIsNovoClienteModalOpen(false)} title="Cadastrar Cliente Rápido" className="max-w-md">
                <form onSubmit={handleCreateNovoCliente} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input required value={novoClienteForm.nome} onChange={e => setNovoClienteForm({ ...novoClienteForm, nome: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input value={novoClienteForm.telefone} onChange={e => setNovoClienteForm({ ...novoClienteForm, telefone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>CPF/CNPJ</Label>
                            <Input value={novoClienteForm.documento} onChange={e => setNovoClienteForm({ ...novoClienteForm, documento: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsNovoClienteModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>Salvar e Selecionar</Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL NOVO PRODUTO RÁPIDO */}
            <Modal isOpen={isNovoProdutoModalOpen} onClose={() => setIsNovoProdutoModalOpen(false)} title="Cadastrar Produto Rápido" className="max-w-md">
                <form onSubmit={(e) => handleCreateNovoProduto(e, vendaItems.length - 1)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome do Produto</Label>
                        <Input required value={novoProdutoForm.nome} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, nome: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Preço de Venda</Label>
                            <Input type="number" step="0.01" required value={novoProdutoForm.preco || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, preco: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Estoque Inicial</Label>
                            <Input type="number" required value={novoProdutoForm.estoque_atual || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, estoque_atual: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">O SKU será gerado automaticamente.</p>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsNovoProdutoModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>Salvar e Selecionar</Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL FINALIZAR VENDA */}
            <Modal isOpen={isFinalizarModalOpen} onClose={() => setIsFinalizarModalOpen(false)} title="Finalizar e Receber Venda" className="max-w-md">
                <form onSubmit={handleFinalizarVenda} className="space-y-4">
                    <div className="p-4 bg-muted/30 border rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pedido:</span>
                            <span className="font-mono font-bold">#{formatNumPedido(vendaParaFinalizar?.numero_pedido)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cliente:</span>
                            <span className="font-bold">{vendaParaFinalizar?.clientes?.nome || 'Consumidor Final'}</span>
                        </div>
                        <div className="flex justify-between text-lg pt-2 border-t">
                            <span className="font-black">TOTAL:</span>
                            <span className="font-black text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendaParaFinalizar?.total || 0)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Como o cliente pagou?</Label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                value={finalizarForm.forma_pagamento}
                                onChange={e => setFinalizarForm({ ...finalizarForm, forma_pagamento: e.target.value })}
                            >
                                <option value="Dinheiro" className="bg-background text-foreground">Dinheiro</option>
                                <option value="Pix" className="bg-background text-foreground">PIX</option>
                                <option value="Cartão Crédito" className="bg-background text-foreground">Cartão de Crédito</option>
                                <option value="Cartão Débito" className="bg-background text-foreground">Cartão de Débito</option>
                                <option value="Haver Cliente" className="bg-background text-foreground">Haver Cliente (Fiado)</option>
                                <option value="Boleto" className="bg-background text-foreground">Boleto</option>
                                <option value="Cheque" className="bg-background text-foreground">Cheque</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status Final</Label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                value={finalizarForm.status}
                                onChange={e => setFinalizarForm({ ...finalizarForm, status: e.target.value as any })}
                            >
                                <option value="Pago">Marcada como Paga</option>
                                <option value="Entregue">Paga e Entregue</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsFinalizarModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? 'Processando...' : 'Confirmar Pagamento'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
