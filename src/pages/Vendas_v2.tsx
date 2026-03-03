import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Search, Filter, Trash2, Printer, Plus, X, UserPlus, PackagePlus, DollarSign, ShoppingCart, Truck, Import, Package } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"

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
    const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom' | 'cupom58'>('a4')
    const [submitting, setSubmitting] = useState(false)

    // Modals State
    const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedVendaForReceipt, setSelectedVendaForReceipt] = useState<any>(null)
    const [company, setCompany] = useState<any>(null)
    const [searchParams] = useSearchParams()
    const { atendente } = useAuthStore()

    useEffect(() => {
        const editId = searchParams.get('edit')
        if (editId && vendas.length > 0) {
            const venda = vendas.find((v: any) => v.id === editId)
            if (venda) startEditVenda(venda)
        }
    }, [searchParams, vendas])

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
        status: 'Pendente' as 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado',
        forma_pagamento: 'Dinheiro'
    })

    const [editingVendaId, setEditingVendaId] = useState<string | null>(null)
    const [showDeliveryForm, setShowDeliveryForm] = useState(false)
    const [vendaDelivery, setVendaDelivery] = useState({
        contato: '',
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: ''
    })

    const [isFinalizarModalOpen, setIsFinalizarModalOpen] = useState(false)
    const [vendaParaFinalizar, setVendaParaFinalizar] = useState<any>(null)
    const [finalizarForm, setFinalizarForm] = useState({
        forma_pagamento: 'Dinheiro',
        status: 'Pago' as const,
        criar_entrega: false,
        entrega: { rua: '', numero: '', bairro: '', contato: '', cidade: '', estado: '', cep: '' }
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

    const handleAddItem = () => {
        setVendaItems([...vendaItems, { produto_id: '', quantidade: 1, preco_unitario: 0, subtotal: 0, _search: '' }])
    }

    const startEditVenda = async (venda: Venda) => {
        setEditingVendaId(venda.id)
        setVendaForm({
            cliente_id: venda.cliente_id || '',
            atendente_id: (venda as any).atendente_id || '',
            status: venda.status,
            forma_pagamento: venda.forma_pagamento || 'Dinheiro'
        })

        // Fetch items
        const { data: itens } = await supabase.from('vendas_itens').select('*').eq('venda_id', venda.id)
        if (itens) {
            setVendaItems(itens.map(i => ({
                ...i,
                _search: ''
            })))
        }

        // Fetch delivery if exists
        const { data: entrega } = await supabase.from('entregas').select('*').eq('venda_id', venda.id).maybeSingle()
        if (entrega) {
            setShowDeliveryForm(true)
            setVendaDelivery({
                contato: entrega.cliente_contato || '',
                rua: entrega.rua || '',
                numero: entrega.numero || '',
                bairro: entrega.bairro || '',
                cidade: entrega.cidade || '',
                estado: entrega.estado || '',
                cep: entrega.cep || ''
            })
        } else {
            setShowDeliveryForm(false)
            setVendaDelivery({ contato: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' })
        }

        setIsNovoPedidoModalOpen(true)
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

    const handleImportFromCart = async () => {
        if (!atendente) return alert("Faça login para importar seu carrinho")
        setLoading(true)
        try {
            const { data: cartItems, error } = await supabase
                .from('carrinho_itens')
                .select('*, produtos(nome, preco, sku)')
                .eq('atendente_id', atendente.id)

            if (error) throw error
            if (!cartItems || cartItems.length === 0) return alert("Seu carrinho está vazio!")

            const importedItems = cartItems.map(item => ({
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                subtotal: item.quantidade * item.preco_unitario,
                _search: (item.produtos as any).nome
            }))

            setVendaItems(importedItems)
            setVendaForm({ ...vendaForm, atendente_id: atendente.id })

            // Pergunta se deseja limpar o carrinho do banco após importar
            if (confirm("Deseja limpar seu carrinho de reserva após importar? (Isso manterá o estoque baixado na venda final)")) {
                // Ao deletar do carrinho, a trigger DEVOLVERIA o estoque.
                // Mas na venda vamos salvar os itens. Para não dar erro de estoque duplo, 
                // o ideal é que a venda finalize e a trigger da venda não baixe de novo se vier do carrinho.
                // Por simplicidade aqui: vamos deletar o carrinho (estoque volta) e a venda ao salvar baixa de novo.
                await supabase.from('carrinho_itens').delete().eq('atendente_id', atendente.id)
            }
        } catch (err: any) {
            alert("Erro ao importar: " + err.message)
        } finally {
            setLoading(true)
            fetchVendas()
        }
    }

    const handleCreateVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!vendaForm.cliente_id && !confirm('Vender sem cliente?')) return
        setSubmitting(true)
        try {
            const total = calculateTotal()
            let vendaId = editingVendaId

            if (editingVendaId) {
                const { error: uvErr } = await supabase.from('vendas').update({
                    cliente_id: vendaForm.cliente_id || null,
                    atendente_id: vendaForm.atendente_id || atendente?.id || null,
                    total,
                    status: vendaForm.status,
                    forma_pagamento: vendaForm.forma_pagamento,
                }).eq('id', editingVendaId)
                if (uvErr) throw uvErr

                // Delete old items
                const { error: diErr } = await supabase.from('vendas_itens').delete().eq('venda_id', editingVendaId)
                if (diErr) throw diErr
            } else {
                const { data: venda, error: vErr } = await supabase.from('vendas').insert({
                    cliente_id: vendaForm.cliente_id || null,
                    atendente_id: vendaForm.atendente_id || atendente?.id || null,
                    total,
                    status: vendaForm.status,
                    forma_pagamento: vendaForm.forma_pagamento,
                    data_venda: new Date().toISOString()
                }).select().single()

                if (vErr) throw vErr
                vendaId = venda.id
            }

            const itensToInsert = vendaItems.map(item => ({
                venda_id: vendaId,
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                subtotal: item.subtotal
            }))
            const { error: iErr } = await supabase.from('vendas_itens').insert(itensToInsert)
            if (iErr) throw iErr

            // 3. Salvar Entrega se solicitado
            if (showDeliveryForm) {
                // Upsert entrega
                const deliveryObj = {
                    venda_id: vendaId,
                    cliente_nome: clientes.find(c => c.id === vendaForm.cliente_id)?.nome || 'Consumidor Final',
                    cliente_contato: vendaDelivery.contato,
                    rua: vendaDelivery.rua,
                    numero: vendaDelivery.numero,
                    bairro: vendaDelivery.bairro,
                    cidade: vendaDelivery.cidade,
                    estado: vendaDelivery.estado,
                    cep: vendaDelivery.cep,
                    status: 'Preparando',
                    status_pagamento: vendaForm.status === 'Pago' ? 'Pago' : 'Pendente'
                }

                if (editingVendaId) {
                    const { data: exEntrega } = await supabase.from('entregas').select('id').eq('venda_id', editingVendaId).maybeSingle()
                    if (exEntrega) {
                        await supabase.from('entregas').update(deliveryObj).eq('id', exEntrega.id)
                    } else {
                        await supabase.from('entregas').insert([deliveryObj])
                    }
                } else {
                    await supabase.from('entregas').insert([deliveryObj])
                }
            } else if (editingVendaId) {
                // Se desmarcou a entrega ao editar, removemos
                await supabase.from('entregas').delete().eq('venda_id', editingVendaId)
            }

            alert(editingVendaId ? 'Venda atualizada com sucesso!' : 'Venda realizada com sucesso!')
            setIsNovoPedidoModalOpen(false)
            setEditingVendaId(null)
            setShowDeliveryForm(false)
            setVendaDelivery({ contato: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '' })
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
            // 0. Se for Haver Cliente, valida se o cliente tem limite (opcional, pode ser só informativo)
            if (finalizarForm.forma_pagamento === 'Haver Cliente' && vendaParaFinalizar.cliente_id) {
                const { data: cliente } = await supabase.from('clientes').select('saldo_haver, limite_credito').eq('id', vendaParaFinalizar.cliente_id).single();
                if (cliente && (cliente.saldo_haver || 0) < vendaParaFinalizar.total) {
                    // Lógica de "Haver": Se o cliente paga com haver, ele "gasta" o saldo. Se for fiado, o saldo fica negativo.
                    // Aqui vamos descontar do saldo
                    await supabase.from('clientes').update({ saldo_haver: (cliente.saldo_haver || 0) - vendaParaFinalizar.total }).eq('id', vendaParaFinalizar.cliente_id);
                }
            }

            const { error } = await supabase.from('vendas').update({
                status: finalizarForm.status,
                forma_pagamento: finalizarForm.forma_pagamento
            }).eq('id', vendaParaFinalizar.id)

            if (error) throw error

            // Se for Dinheiro, lança no financeiro (opção para sair do caixa)
            if (finalizarForm.status === 'Pago' || finalizarForm.status === 'Entregue') {
                if (finalizarForm.forma_pagamento !== 'Haver Cliente') {
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
            }

            // Se selecionou entrega, cria a entrega
            if (finalizarForm.criar_entrega) {
                await supabase.from('entregas').insert([{
                    venda_id: vendaParaFinalizar.id,
                    cliente_nome: vendaParaFinalizar.clientes?.nome || 'Cliente',
                    cliente_contato: finalizarForm.entrega.contato,
                    rua: finalizarForm.entrega.rua,
                    bairro: finalizarForm.entrega.bairro,
                    numero: finalizarForm.entrega.numero,
                    cidade: finalizarForm.entrega.cidade,
                    estado: finalizarForm.entrega.estado,
                    cep: finalizarForm.entrega.cep,
                    status: 'Preparando',
                    status_pagamento: 'Pago'
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
            const { data: entrega } = await supabase.from('entregas').select('*').eq('venda_id', vendaId).maybeSingle()
            setSelectedVendaForReceipt({ ...venda, itens: itens || [], entrega })
            setIsReceiptModalOpen(true)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase().trim();
        const matchesSearch = !searchTerm ||
            (v.clientes?.nome?.toLowerCase() || '').includes(termLower) ||
            String(v.numero_pedido).includes(termLower) ||
            v.vendas_itens?.some(i => (i.produtos?.nome || '').toLowerCase().includes(termLower));
        const matchesStatus = String(v.status).toLowerCase() === 'pendente';
        return matchesSearch && matchesStatus;
    })

    const formatNumPedido = (num?: number) => num ? String(num) : '------'

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
                                        <Button variant="ghost" size="icon" onClick={() => startEditVenda(venda)} title="Editar"><Search className="w-4 h-4" /></Button>
                                        <Button variant="outline" size="sm" className="h-8 gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20" onClick={() => { setVendaParaFinalizar(venda); setFinalizarForm({ ...finalizarForm, forma_pagamento: venda.forma_pagamento || 'Dinheiro' }); setIsFinalizarModalOpen(true); }}><DollarSign className="w-3 h-3" /> Fechar</Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleCancelVenda(venda.id)} title="Cancelar"><X className="w-4 h-4" /></Button>
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

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl cursor-pointer hover:bg-indigo-500/10 transition-colors" onClick={() => setShowDeliveryForm(!showDeliveryForm)}>
                            <Truck className={`w-5 h-5 ${showDeliveryForm ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                            <div className="flex-1">
                                <Label className="font-black cursor-pointer">Enviar para Entrega?</Label>
                                <p className="text-[10px] text-muted-foreground">Clique para preencher o endereço do cliente</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={showDeliveryForm}
                                onChange={e => setShowDeliveryForm(e.target.checked)}
                                className="w-5 h-5 accent-indigo-600"
                            />
                        </div>

                        {showDeliveryForm && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 border rounded-xl animate-in fade-in slide-in-from-top-2">
                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Contato/WhatsApp</Label>
                                    <Input
                                        placeholder="(00) 00000-0000"
                                        value={vendaDelivery.contato}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, contato: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Logradouro (Rua/Av)</Label>
                                    <Input
                                        placeholder="Ex: Rua das Flores"
                                        value={vendaDelivery.rua}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, rua: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Número</Label>
                                    <Input
                                        placeholder="123"
                                        value={vendaDelivery.numero}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, numero: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Bairro</Label>
                                    <Input
                                        placeholder="Ex: Centro"
                                        value={vendaDelivery.bairro}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, bairro: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Cidade</Label>
                                    <Input
                                        placeholder="Cidade"
                                        value={vendaDelivery.cidade}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, cidade: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">UF</Label>
                                    <Input
                                        placeholder="UF"
                                        maxLength={2}
                                        className="uppercase"
                                        value={vendaDelivery.estado}
                                        onChange={e => setVendaDelivery({ ...vendaDelivery, estado: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
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
            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Impressão de Pedido" className="max-w-4xl">
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

                        <div className={`print-preview-container ${printFormat} bg-white text-black shadow-none border-0 mx-auto`}>
                            <style>{`
                                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');

                                .print-preview-container { font-family: 'Inter', sans-serif; }
                                .print-preview-container.cupom, .print-preview-container.cupom58 { font-family: 'Courier Prime', monospace; }

                                .print-preview-container.a4 { width: 210mm; min-height: 297mm; padding: 15mm; }
                                .print-preview-container.a5 { width: 148mm; min-height: 210mm; padding: 10mm; }
                                .print-preview-container.cupom { width: 80mm; font-size: 12px; padding: 4mm; }
                                .print-preview-container.cupom58 { width: 58mm; font-size: 10px; padding: 2mm; }

                                @media print {
                                    @page { margin: 0; size: auto; }
                                    html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
                                    body > * { display: none !important; }
                                    #root, #__next { display: block !important; }
                                    .print-preview-container { 
                                        display: block !important; 
                                        position: static !important;
                                        width: 100% !important;
                                        margin: 0 !important;
                                        border: none !important;
                                        background: white !important;
                                    }
                                    .a4 { width: 210mm !important; }
                                    .a5 { width: 148mm !important; }
                                    .cupom { width: 80mm !important; }
                                    .cupom58 { width: 58mm !important; }
                                    .no-print { display: none !important; }
                                }

                                /* Estilos Imagem 1 (A4/A5) */
                                .formal-header { border: 1px solid #000; padding: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
                                .formal-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                .formal-table th { text-align: left; font-size: 10px; border-bottom: 1px solid #000; padding: 5px; text-transform: uppercase; color: #000; }
                                .formal-table td { padding: 5px; font-size: 11px; border-bottom: 1px dotted #ccc; color: #000; }
                                .formal-section { border-top: 2px solid #000; margin-top: 15px; padding-top: 5px; }
                                .formal-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #000; }
                                
                                /* Estilos Imagem 2 (Cupom) */
                                .ticket-line { border-top: 1px dashed #000; margin: 5px 0; }
                                .ticket-double-line { border-top: 3px double #000; margin: 5px 0; }
                                .ticket-header { text-align: center; margin-bottom: 10px; color: #000; }
                                .ticket-title { font-weight: bold; text-align: center; text-transform: uppercase; margin: 10px 0; color: #000; }
                            `}</style>

                            {printFormat.includes('cupom') ? (
                                /* LAYOUT TICKET TÉRMICO (Imagem 2) */
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
                                    <div className="ticket-title">PEDIDO Nº {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</div>
                                    <div className="ticket-double-line" />

                                    <div className="grid grid-cols-2 text-[11px] mb-2">
                                        <div>Data: {new Date(selectedVendaForReceipt.data_venda).toLocaleDateString()}</div>
                                        {selectedVendaForReceipt.entrega && <div className="text-right">Entrega: {new Date().toLocaleDateString()}</div>}
                                    </div>

                                    <div className="space-y-0.5 mb-2 text-black">
                                        <p><span className="font-bold">Cliente:</span> {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR'}</p>
                                        <p><span className="font-bold">Telefone:</span> {selectedVendaForReceipt.clientes?.telefone || '---'}</p>

                                        {selectedVendaForReceipt.entrega && (
                                            <div className="mt-2 border border-black p-1 bg-gray-50">
                                                <p className="font-bold text-center underline mb-1">DADOS PARA ENTREGA</p>
                                                <p><span className="font-bold">Endereço:</span> {selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero}</p>
                                                <p><span className="font-bold">Bairro:</span> {selectedVendaForReceipt.entrega.bairro}</p>
                                                <p><span className="font-bold">Cidade:</span> {selectedVendaForReceipt.entrega.cidade}/{selectedVendaForReceipt.entrega.estado}</p>
                                                <p><span className="font-bold">Status:</span> {selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? '✅ JÁ ESTÁ PAGO' : '💰 A RECEBER'}</p>
                                            </div>
                                        )}
                                        {!selectedVendaForReceipt.entrega && (
                                            <p><span className="font-bold">Endereço:</span> {selectedVendaForReceipt.clientes?.endereco || '---'}</p>
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
                                                    <td className="text-right">{i.preco_unitario.toFixed(2)}</td>
                                                    <td className="text-right font-bold">{i.subtotal.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="ticket-double-line" />
                                    <div className="text-center font-bold">PAGAMENTO</div>
                                    <div className="ticket-double-line" />

                                    <div className="flex justify-between font-bold text-lg py-1">
                                        <span>Total do Pedido:</span>
                                        <span>R$ {selectedVendaForReceipt.total.toFixed(2)}</span>
                                    </div>

                                    <div className="ticket-line" />
                                    <div className="grid grid-cols-2 text-[10px]">
                                        <div><span className="font-bold">Vencimento</span><br />{new Intl.DateTimeFormat('pt-BR').format(new Date())}</div>
                                        <div><span className="font-bold">Forma</span><br />{selectedVendaForReceipt.forma_pagamento}</div>
                                    </div>

                                    <div className="mt-8 text-center text-[10px]">
                                        <p>*** Este ticket não é documento fiscal ***</p>
                                        <div className="mt-10 border-t border-black w-3/4 mx-auto pt-1">Assinatura do cliente</div>
                                        <p className="mt-6 italic opacity-50 text-[8px]">{company?.nome_fantasia} - CRM</p>
                                    </div>
                                </div>
                            ) : (
                                /* LAYOUT FORMAL A4/A5 (Imagem 1) */
                                <div className="formal-content">
                                    <div className="formal-header">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 border border-black rounded-lg flex items-center justify-center">
                                                <Package className="w-8 h-8 text-black" />
                                            </div>
                                            <div>
                                                <p className="font-black text-xl leading-none text-black">{company?.nome_fantasia || 'SUA EMPRESA'}</p>
                                                <p className="text-[10px] text-black italic">Slogan ou descrição do seu negócio</p>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black uppercase text-black">Pedido de venda {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</p>
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
                                            <span className="font-bold">Cliente:</span> {selectedVendaForReceipt.clientes?.documento || '000.000.000-00'} - {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR FINAL'}
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
                                            <p><span className="font-bold">Natureza da operação:</span> 5101 - Venda de mercadoria</p>
                                            <p className="text-right"><span className="font-bold">Vendedor:</span> {selectedVendaForReceipt.atendentes?.nome || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <table className="formal-table">
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
                                                    <td className="text-right">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.preco_unitario)}</td>
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
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border rounded-lg">
                            <input
                                type="checkbox"
                                id="criar_entrega"
                                checked={finalizarForm.criar_entrega}
                                onChange={e => setFinalizarForm({ ...finalizarForm, criar_entrega: e.target.checked })}
                                className="w-4 h-4 accent-primary"
                            />
                            <Label htmlFor="criar_entrega" className="font-bold cursor-pointer">Venda para Entrega?</Label>
                        </div>

                        {finalizarForm.criar_entrega && (
                            <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30 animate-in slide-in-from-top-2 duration-300">
                                <div className="col-span-2 space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Telefone/Contato</Label>
                                    <Input
                                        placeholder="(00) 00000-0000"
                                        value={finalizarForm.entrega.contato}
                                        onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, contato: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Rua/Logradouro</Label>
                                    <Input
                                        placeholder="Ex: Av. Brasil"
                                        value={finalizarForm.entrega.rua}
                                        onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, rua: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Número</Label>
                                    <Input
                                        placeholder="123"
                                        value={finalizarForm.entrega.numero}
                                        onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, numero: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Bairro</Label>
                                    <Input
                                        placeholder="Ex: Centro"
                                        value={finalizarForm.entrega.bairro}
                                        onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, bairro: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">Cidade/UF</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            placeholder="Cidade"
                                            className="flex-1"
                                            value={finalizarForm.entrega.cidade}
                                            onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, cidade: e.target.value } })}
                                        />
                                        <Input
                                            placeholder="UF"
                                            className="w-12 uppercase"
                                            maxLength={2}
                                            value={finalizarForm.entrega.estado}
                                            onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, estado: e.target.value } })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-black">CEP</Label>
                                    <Input
                                        placeholder="00000-000"
                                        value={finalizarForm.entrega.cep}
                                        onChange={e => setFinalizarForm({ ...finalizarForm, entrega: { ...finalizarForm.entrega, cep: e.target.value } })}
                                    />
                                </div>
                            </div>
                        )}

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
