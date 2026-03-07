import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Search, Filter, Trash2, Printer, Plus, X, UserPlus, PackagePlus, DollarSign, ShoppingCart, Truck, Package, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { fmtDate, fmtDateTime, formatNumPedido } from "@/lib/format"

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
    atendente_id?: string
    vendedor_id?: string
    clientes?: { id: string, nome: string, documento?: string, email?: string, telefone?: string, endereco?: string, saldo_haver?: number }
    atendentes?: { id: string, nome: string }
    vendedor?: { id: string, nome: string }
    vendas_itens?: { produtos: { id?: string, nome: string, sku?: string } }[]
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
    const [printAfterSave, setPrintAfterSave] = useState(false)
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Filtros
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("Pendente")
    const [filterClienteId, setFilterClienteId] = useState<string>("all")
    const [filterVendedorId, setFilterVendedorId] = useState<string>("all")
    const [cartCount, setCartCount] = useState(0)
    const [hasIndicacao, setHasIndicacao] = useState(false)
    const [indicadorId, setIndicadorId] = useState("")
    const [configEmpresa, setConfigEmpresa] = useState<any>(null)

    // resources for new sale
    const [clientes, setClientes] = useState<any[]>([])
    const [atendentes, setAtendentes] = useState<any[]>([])
    const [produtos, setProdutos] = useState<any[]>([])

    // Handlers
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

    const handleAddItem = () => {
        setVendaItems([...vendaItems, { produto_id: '', quantidade: 1, preco_unitario: 0, desconto: 0, subtotal: 0, _search: '' }])
    }

    const handleRemoveItem = (index: number) => {
        setVendaItems(vendaItems.filter((_, i) => i !== index))
    }

    // Quick Creation Modals State
    const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false)
    const [isNovoProdutoModalOpen, setIsNovoProdutoModalOpen] = useState(false)

    // Form states for quick creation
    const [novoClienteForm, setNovoClienteForm] = useState({ nome: '', telefone: '', documento: '' })
    const [novoProdutoForm, setNovoProdutoForm] = useState({ nome: '', preco: 0, estoque_atual: 0 })

    // New Sale Form State
    const [vendaItems, setVendaItems] = useState<any[]>([{ produto_id: '', quantidade: 1, preco_unitario: 0, desconto: 0, subtotal: 0, _search: '' }])
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
        recebedor_nome: '',
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
        status: 'Pago' as const,
        criar_entrega: false,
        entrega: { rua: '', numero: '', bairro: '', contato: '', recebedor_nome: '', cidade: '', estado: '', cep: '' },
        pagamentos: [{ id: Math.random().toString(36).substr(2, 9), forma: 'Dinheiro', valor: 0, parcelas: 1, primeiro_vencimento: new Date().toISOString().split('T')[0], intervalo: 30 }]
    })

    const fetchVendas = async () => {
        setLoading(true)
        try {
            const { data: vData, error: vError } = await supabase
                .from('vendas')
                .select('*, clientes!cliente_id(*), atendentes!atendente_id(nome), vendedor:atendentes!vendedor_id(nome)')
                .order('data_venda', { ascending: false })

            if (vError) throw vError

            const rows = vData || []
            const vendaIds = rows.map(v => v.id)

            if (vendaIds.length > 0) {
                const { data: itemsRes } = await supabase.from('vendas_itens').select('*, produtos!produto_id(nome, sku)').in('venda_id', vendaIds)
                const itemsMap: Record<string, any[]> = {}
                itemsRes?.forEach(i => {
                    if (!itemsMap[i.venda_id]) itemsMap[i.venda_id] = []
                    itemsMap[i.venda_id].push({ ...i, produtos: (i as any).produtos || (i as any).produto || {} })
                })

                setVendas(rows.map(v => ({
                    ...v,
                    vendas_itens: itemsMap[v.id] || []
                })))
            } else {
                setVendas([])
            }
        } catch (err: any) {
            console.error('Error fetching vendas:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchResources = async () => {
        const { data: c } = await supabase.from('clientes').select('*').order('nome')
        const { data: a } = await supabase.from('atendentes').select('*').order('nome')
        const { data: p } = await supabase.from('produtos').select('*').order('nome')
        if (c) setClientes(c)
        if (a) setAtendentes(a)
        if (p) setProdutos(p)
    }

    const fetchCartCount = async () => {
        if (!atendente) return
        const { count } = await supabase.from('carrinho_itens').select('*', { count: 'exact', head: true }).eq('atendente_id', atendente.id)
        setCartCount(count || 0)
    }

    const handleImportFromCart = async () => {
        if (!atendente) return alert("Faça login para importar seu carrinho")
        setLoading(true)
        try {
            const { data: cartItems, error } = await supabase
                .from('carrinho_itens')
                .select('*, produtos!produto_id(nome, preco, sku)')
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

            // Auto open modal
            setIsNovoPedidoModalOpen(true)

            if (confirm("Deseja limpar seu carrinho de reserva após importar?")) {
                await supabase.from('carrinho_itens').delete().eq('atendente_id', atendente.id)
                fetchCartCount()
            }
        } catch (err: any) {
            alert("Erro ao importar: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVendas()
        fetchResources()
        fetchCartCount()
        supabase.from('configuracoes_empresa').select('*').maybeSingle().then(({ data }) => setCompany(data))
    }, [])

    const handleOpenNovoPedido = () => {
        setEditingVendaId(null)
        setVendaForm({
            cliente_id: '',
            atendente_id: atendente?.id || '',
            status: 'Pendente',
            forma_pagamento: 'Dinheiro'
        })
        setVendaItems([{ produto_id: '', quantidade: 1, preco_unitario: 0, subtotal: 0, _search: '' }])
        setShowDeliveryForm(false)
        setIsNovoPedidoModalOpen(true)
    }

    const startEditVenda = async (venda: Venda) => {
        setEditingVendaId(venda.id)
        setVendaForm({
            cliente_id: venda.cliente_id || '',
            atendente_id: (venda as any).atendente_id || '',
            status: venda.status,
            forma_pagamento: venda.forma_pagamento || 'Dinheiro'
        })

        const { data: itens } = await supabase.from('vendas_itens').select('*, produtos!produto_id(nome, sku)').eq('venda_id', venda.id)
        if (itens) {
            setVendaItems(itens.map(i => ({ ...i, _search: ((i as any).produtos || (i as any).produto)?.nome || '' })))
        }

        const { data: entrega } = await supabase.from('entregas').select('*').eq('venda_id', venda.id).maybeSingle()
        if (entrega) {
            setShowDeliveryForm(true)
            setVendaDelivery({
                contato: entrega.cliente_contato || '',
                recebedor_nome: entrega.recebedor_nome || '',
                rua: entrega.rua || '',
                numero: entrega.numero || '',
                bairro: entrega.bairro || '',
                cidade: entrega.cidade || '',
                estado: entrega.estado || '',
                cep: entrega.cep || ''
            })
        } else {
            setShowDeliveryForm(false)
        }
        setIsNovoPedidoModalOpen(true)
    }

    const startFinalizarVenda = async (venda: Venda) => {
        setVendaParaFinalizar(venda)
        const { data: entregaExt } = await supabase.from('entregas').select('*').eq('venda_id', venda.id).maybeSingle()

        setFinalizarForm({
            status: 'Pago',
            criar_entrega: !!entregaExt,
            entrega: {
                contato: entregaExt?.cliente_contato || venda.clientes?.telefone || '',
                recebedor_nome: entregaExt?.recebedor_nome || venda.clientes?.nome || '',
                rua: entregaExt?.rua || venda.clientes?.endereco?.split(',')[0] || '',
                numero: entregaExt?.numero || '',
                bairro: entregaExt?.bairro || '',
                cidade: entregaExt?.cidade || '',
                estado: entregaExt?.estado || '',
                cep: entregaExt?.cep || ''
            },
            pagamentos: [{ id: Math.random().toString(36).substr(2, 9), forma: venda.forma_pagamento || 'Dinheiro', valor: venda.total, parcelas: 1, primeiro_vencimento: new Date().toISOString().split('T')[0], intervalo: 30 }]
        })
        setIsFinalizarModalOpen(true)
    }

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...vendaItems]
        newItems[index][field] = value
        if (field === 'produto_id') {
            const prod = produtos.find(p => String(p.id) === String(value))
            if (prod) {
                newItems[index].preco_unitario = prod.preco
                newItems[index].quantidade = newItems[index].quantidade || 1
                newItems[index].desconto = newItems[index].desconto || 0
                newItems[index].subtotal = (prod.preco * newItems[index].quantidade) - newItems[index].desconto
            }
        }
        if (field === 'quantidade' || field === 'preco_unitario' || field === 'desconto') {
            const qty = newItems[index].quantidade || 0
            const unit = newItems[index].preco_unitario || 0
            const desc = newItems[index].desconto || 0
            newItems[index].subtotal = (qty * unit) - desc
        }
        setVendaItems(newItems)
    }

    const calculateTotal = () => vendaItems.reduce((acc, item) => acc + (item.subtotal || 0), 0)

    const handleCreateVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            if (vendaItems.some(i => !i.produto_id)) {
                throw new Error('Selecione um produto para cada item do pedido.')
            }
            const total = calculateTotal()
            let vendaId = editingVendaId

            if (editingVendaId) {
                await supabase.from('vendas').update({
                    cliente_id: vendaForm.cliente_id || null,
                    atendente_id: vendaForm.atendente_id || atendente?.id || null,
                    total,
                    status: vendaForm.status,
                    forma_pagamento: vendaForm.forma_pagamento,
                    indicador_id: hasIndicacao ? indicadorId : null,
                }).eq('id', editingVendaId)
                await supabase.from('vendas_itens').delete().eq('venda_id', editingVendaId)
            } else {
                const { data: venda, error: vErr } = await supabase.from('vendas').insert({
                    cliente_id: vendaForm.cliente_id || null,
                    atendente_id: vendaForm.atendente_id || atendente?.id || null,
                    vendedor_id: vendaForm.atendente_id || atendente?.id || null,
                    total,
                    status: vendaForm.status,
                    forma_pagamento: vendaForm.forma_pagamento,
                    indicador_id: hasIndicacao ? indicadorId : null,
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
                desconto: item.desconto || 0,
                subtotal: item.subtotal
            }))
            await supabase.from('vendas_itens').insert(itensToInsert)

            if (showDeliveryForm) {
                await supabase.from('entregas').upsert({
                    venda_id: vendaId,
                    cliente_nome: clientes.find(c => c.id === vendaForm.cliente_id)?.nome || 'Consumidor',
                    cliente_contato: vendaDelivery.contato,
                    recebedor_nome: vendaDelivery.recebedor_nome,
                    rua: vendaDelivery.rua,
                    numero: vendaDelivery.numero,
                    bairro: vendaDelivery.bairro,
                    cidade: vendaDelivery.cidade,
                    estado: vendaDelivery.estado,
                    cep: vendaDelivery.cep,
                    status: 'Preparando',
                    status_pagamento: vendaForm.status === 'Pendente' ? 'A Receber' : 'Pago'
                }, { onConflict: 'venda_id' })
            }

            setIsNovoPedidoModalOpen(false)
            fetchVendas()
            if (printAfterSave) {
                handleOpenReceipt(vendaId!)
                setPrintAfterSave(false)
            }
        } catch (err: any) {
            alert('Erro: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleFinalizarVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!vendaParaFinalizar) return
        const totalPagamentos = finalizarForm.pagamentos.reduce((acc, p) => acc + p.valor, 0)
        if (Math.abs(totalPagamentos - vendaParaFinalizar.total) > 0.01) {
            return alert(`Total pagamentos (R$ ${totalPagamentos.toFixed(2)}) incorreto.`)
        }

        setSubmitting(true)
        try {
            const { error: updateError } = await supabase
                .from('vendas')
                .update({ status: finalizarForm.status, forma_pagamento: finalizarForm.pagamentos[0].forma })
                .eq('id', vendaParaFinalizar.id)
            if (updateError) throw updateError

            for (const pg of finalizarForm.pagamentos) {
                const valorParcela = pg.valor / pg.parcelas
                for (let i = 0; i < pg.parcelas; i++) {
                    const venc = new Date(pg.primeiro_vencimento)
                    venc.setDate(venc.getDate() + (i * pg.intervalo))
                    const st = (pg.forma !== 'Boleto' && pg.forma !== 'Cheque' && finalizarForm.status === 'Pago') ? 'Pago' : 'Pendente'

                    if (pg.forma === 'Haver Cliente' && vendaParaFinalizar.cliente_id) {
                        const { data: c } = await supabase.from('clientes').select('saldo_haver').eq('id', vendaParaFinalizar.cliente_id).single()
                        if (c) await supabase.from('clientes').update({ saldo_haver: (c.saldo_haver || 0) - valorParcela }).eq('id', vendaParaFinalizar.cliente_id)
                    }

                    const { error: insertError } = await supabase.from('financeiro_lancamentos').insert([{
                        tipo: 'Receita',
                        valor: valorParcela,
                        data_vencimento: venc.toISOString().split('T')[0],
                        data_pagamento: st === 'Pago' ? new Date().toISOString().split('T')[0] : null,
                        status: st,
                        forma_pagamento: pg.forma,
                        venda_id: vendaParaFinalizar.id,
                        descricao: `Venda #${formatNumPedido(vendaParaFinalizar.numero_pedido)} - ${pg.forma} ${i + 1}/${pg.parcelas}`
                    }])
                    if (insertError) throw insertError
                }
            }

            if (finalizarForm.criar_entrega) {
                const { error: entregaError } = await supabase.from('entregas').upsert({
                    venda_id: vendaParaFinalizar.id,
                    cliente_nome: vendaParaFinalizar.clientes?.nome,
                    ...finalizarForm.entrega,
                    status: 'Preparando'
                }, { onConflict: 'venda_id' })
                if (entregaError) throw entregaError
            }

            setIsFinalizarModalOpen(false)
            fetchVendas()
            if (printAfterSave) {
                handleOpenReceipt(vendaParaFinalizar.id)
                setPrintAfterSave(false)
            }
        } catch (err: any) {
            const msg = err?.message || err?.error_description || (typeof err === 'string' ? err : 'Erro ao finalizar venda. Tente novamente.')
            alert(msg)
        } finally { setSubmitting(false) }
    }

    const handleOpenReceipt = async (id: string) => {
        const { data: v } = await supabase.from('vendas').select('*, clientes!cliente_id(*), atendentes!atendente_id(nome)').eq('id', id).single()
        const { data: it } = await supabase.from('vendas_itens').select('*, produtos!produto_id(nome, sku)').eq('venda_id', id)
        const { data: en } = await supabase.from('entregas').select('*').eq('venda_id', id).maybeSingle()
        setSelectedVendaForReceipt({ ...v, itens: (it || []).map(i => ({ ...i, produtos: (i as any).produtos || (i as any).produto || {} })), entrega: en })
        setIsReceiptModalOpen(true)
    }

    const filteredVendas = vendas.filter(v => {
        const pedidoStr = (v.numero_pedido || "").toString()
        const clienteNome = (v.clientes?.nome || "").toLowerCase()
        const search = searchTerm.toLowerCase()

        const matchSearch = pedidoStr.includes(searchTerm) || clienteNome.includes(search)
        const matchStatus = v.status === 'Pendente' // Only pending sales here

        let matchDate = true
        if (startDate) {
            matchDate = matchDate && new Date(v.data_venda) >= new Date(startDate)
        }
        if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            matchDate = matchDate && new Date(v.data_venda) <= end
        }

        return matchSearch && matchStatus && matchDate
    })

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

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-black italic tracking-tighter flex items-center gap-2">
                    <ShoppingCart className="w-8 h-8 text-primary" /> VENDAS E PEDIDOS
                </h1>
                <div className="flex gap-2">
                    {cartCount > 0 && (
                        <Button variant="outline" onClick={handleImportFromCart} className="border-orange-500 text-orange-600 hover:bg-orange-50 relative">
                            <ShoppingCart className="w-5 h-5 mr-1" /> Carrinho
                            <Badge className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-orange-600">{cartCount}</Badge>
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setIsFilterOpen(!isFilterOpen)} className={isFilterOpen ? "bg-primary text-white" : ""}>
                        <Filter className="w-4 h-4 mr-2" /> Filtros
                    </Button>
                    <Button onClick={handleOpenNovoPedido} className="bg-primary hover:bg-primary/90 font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Novo Pedido
                    </Button>
                </div>
            </div>

            {isFilterOpen && (
                <Card className="border-primary/20 bg-primary/5 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase opacity-70">Status</Label>
                                <select
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">Todos os Status</option>
                                    <option value="Pendente">Pendentes / Reservas</option>
                                    <option value="Pago">Pagos / Finalizados</option>
                                    <option value="Entregue">Entregues</option>
                                    <option value="Cancelado">Cancelados</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase opacity-70">Data Inicial</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase opacity-70">Data Final</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    className="w-full text-xs"
                                    onClick={() => {
                                        setFilterStatus("Pendente")
                                        setStartDate("")
                                        setEndDate("")
                                        setSearchTerm("")
                                    }}
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-10 h-11 text-lg" placeholder="Buscar por pedido ou cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === filteredVendas.length && filteredVendas.length > 0} /></TableHead>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="max-w-[200px]">Produtos</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Atendente</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10">Carregando...</TableCell></TableRow>
                            ) : filteredVendas.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10">Nenhuma venda encontrada.</TableCell></TableRow>
                            ) : filteredVendas.map((v) => (
                                <TableRow key={v.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(v.id)} onChange={() => toggleSelect(v.id)} /></TableCell>
                                    <TableCell className="font-mono font-bold">#{formatNumPedido(v.numero_pedido)}</TableCell>
                                    <TableCell className="text-xs">{fmtDateTime(v.data_venda)}</TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm">{v.clientes?.nome || 'Consumidor Final'}</div>
                                        <div className="text-[10px] text-muted-foreground">{v.clientes?.documento || '---'}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-xs" title={v.vendas_itens?.map((i: any) => (i.produtos || i.produto)?.nome).filter(Boolean).join(', ')}>
                                        {v.vendas_itens?.length ? v.vendas_itens.map((i: any) => (i.produtos || i.produto)?.nome).filter(Boolean).join(', ') || '—' : '—'}
                                    </TableCell>
                                    <TableCell className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.total)}</TableCell>
                                    <TableCell className="text-[10px] italic">{v.atendentes?.nome || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant={v.status === 'Pago' || v.status === 'Entregue' ? 'default' : v.status === 'Cancelado' ? 'destructive' : 'outline'} className={v.status === 'Pago' || v.status === 'Entregue' ? "bg-emerald-500 hover:bg-emerald-600" : ""}>{v.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenReceipt(v.id)} title="Imprimir Recibo"><Printer className="w-4 h-4" /></Button>
                                            {v.status === 'Pendente' && <Button variant="ghost" size="icon" onClick={() => startFinalizarVenda(v)} className="text-emerald-600" title="Finalizar"><DollarSign className="w-4 h-4" /></Button>}
                                            <Button variant="ghost" size="icon" onClick={() => startEditVenda(v)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => supabase.from('vendas').delete().eq('id', v.id).then(() => fetchVendas())} className="text-destructive" title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* MODAL NOVO PEDIDO / EDITAR */}
            <Modal isOpen={isNovoPedidoModalOpen} onClose={() => setIsNovoPedidoModalOpen(false)} title={editingVendaId ? "Editar Pedido" : "Novo Pedido de Venda"} className="max-w-6xl">
                <form onSubmit={handleCreateVenda} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center justify-between"><h3 className="font-black text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Itens do Pedido</h3><Button type="button" variant="outline" size="sm" onClick={handleAddItem}><Plus className="w-4 h-4 mr-2" /> Add Produto</Button></div>
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                {vendaItems.map((item, idx) => (
                                    <div key={idx} className="p-4 border rounded-xl bg-background shadow-sm space-y-4 relative group">
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex gap-1">
                                                <select className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm font-medium" value={item.produto_id} onChange={e => handleItemChange(idx, 'produto_id', e.target.value)}>
                                                    <option value="">Selecione um produto...</option>
                                                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - R$ {p.preco}</option>)}
                                                </select>
                                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 border-dashed" onClick={() => setIsNovoProdutoModalOpen(true)} title="Cadastrar novo produto na hora"><Plus className="w-4 h-4" /></Button>
                                            </div>
                                            <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveItem(idx)} className="h-10 w-10 shrink-0 shadow-lg" title="Remover item"><Trash2 className="w-5 h-5" /></Button>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-start">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Quantidade</Label>
                                                <Input type="number" className="h-11 text-xl font-bold bg-muted/30 border-2 focus:border-primary" value={item.quantidade} onChange={e => handleItemChange(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Desconto (R$)</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                                    <Input type="number" className="h-11 pl-9 text-xl font-bold border-2 focus:border-emerald-500" placeholder="0,00" value={item.desconto} onChange={e => handleItemChange(idx, 'desconto', parseFloat(e.target.value) || 0)} />
                                                </div>
                                                <div className="text-[10px] font-bold text-muted-foreground italic px-1">Tabela: R$ {item.preco_unitario.toFixed(2)} / un</div>
                                            </div>
                                            <div className="col-span-2 md:col-span-1 flex flex-col items-end justify-center h-full pt-1">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Subtotal do Item</Label>
                                                <div className="text-2xl font-black text-primary p-2 bg-primary/5 rounded-lg border border-primary/10">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {vendaItems.length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-50 italic">Nenhum item adicionado ao pedido.</div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6 bg-muted/30 p-4 rounded-lg border">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex justify-between">Cliente <Button type="button" variant="link" size="sm" onClick={() => setIsNovoClienteModalOpen(true)} className="h-auto p-0 text-xs">+ cadastrar</Button></Label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={vendaForm.cliente_id} onChange={e => setVendaForm({ ...vendaForm, cliente_id: e.target.value })}>
                                        <option value="">Consumidor Final</option>
                                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Atendente / Vendedor</Label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={vendaForm.atendente_id} onChange={e => setVendaForm({ ...vendaForm, atendente_id: e.target.value })}>
                                        {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Forma de Pagamento (Padrão)</Label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background font-bold text-emerald-700" value={vendaForm.forma_pagamento} onChange={e => setVendaForm({ ...vendaForm, forma_pagamento: e.target.value })}>
                                        <option value="Dinheiro">Dinheiro</option>
                                        <option value="Pix">PIX</option>
                                        <option value="Cartão Crédito">Cartão Crédito</option>
                                        <option value="Cartão Débito">Cartão Débito</option>
                                        <option value="Boleto">Boleto</option>
                                        <option value="Haver Cliente">Haver Cliente</option>
                                    </select>
                                </div>
                                <div className="space-y-4 border rounded-lg p-3 bg-background/50">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="hasIndicacao" checked={hasIndicacao} onChange={e => setHasIndicacao(e.target.checked)} />
                                        <Label htmlFor="hasIndicacao" className="font-bold cursor-pointer">Venda por Indicação?</Label>
                                    </div>
                                    {hasIndicacao && (
                                        <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                                            <Label className="text-xs">Quem indicou?</Label>
                                            <select className="w-full h-9 px-2 rounded-md border text-sm" value={indicadorId} onChange={e => setIndicadorId(e.target.value)}>
                                                <option value="">Selecione o indicador...</option>
                                                {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                                <optgroup label="Clientes Indicadores">
                                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                </optgroup>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-primary text-white rounded-lg text-center"><div className="text-xs uppercase font-bold opacity-80">Total do Pedido</div><div className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</div></div>
                                <div className="space-y-4 border-t pt-4">
                                    <div className="flex items-center gap-2"><input type="checkbox" id="delivery" checked={showDeliveryForm} onChange={e => setShowDeliveryForm(e.target.checked)} /><Label htmlFor="delivery" className="font-bold cursor-pointer text-orange-600 flex items-center gap-1"><Truck className="w-4 h-4" /> Venda para Entrega?</Label></div>
                                    {showDeliveryForm && (
                                        <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                                            <div className="col-span-2 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">Nome de quem recebe</Label>
                                                <Input placeholder="Ex: Maria Souza" value={vendaDelivery.recebedor_nome} onChange={e => setVendaDelivery({ ...vendaDelivery, recebedor_nome: e.target.value })} />
                                            </div>
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">Telefone Contato</Label>
                                                <Input placeholder="(00) 00000-0000" value={vendaDelivery.contato} onChange={e => setVendaDelivery({ ...vendaDelivery, contato: e.target.value })} />
                                            </div>
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">CEP</Label>
                                                <Input placeholder="00000-000" value={vendaDelivery.cep} onChange={e => setVendaDelivery({ ...vendaDelivery, cep: e.target.value })} />
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">Rua / Logradouro</Label>
                                                <Input placeholder="Av. Principal, Rua das Flores..." value={vendaDelivery.rua} onChange={e => setVendaDelivery({ ...vendaDelivery, rua: e.target.value })} />
                                            </div>
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">Número</Label>
                                                <Input placeholder="123 ou S/N" value={vendaDelivery.numero} onChange={e => setVendaDelivery({ ...vendaDelivery, numero: e.target.value })} />
                                            </div>
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] uppercase opacity-70">Bairro</Label>
                                                <Input placeholder="Centro" value={vendaDelivery.bairro} onChange={e => setVendaDelivery({ ...vendaDelivery, bairro: e.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t">
                        <Button type="button" variant="ghost" onClick={() => setIsNovoPedidoModalOpen(false)}>Descartar</Button>
                        <div className="flex gap-2">
                            <Button type="submit" onClick={() => setPrintAfterSave(true)} variant="outline" className="border-primary text-primary hover:bg-primary/10"><Printer className="w-4 h-4 mr-2" /> Salvar e Imprimir</Button>
                            <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? 'Gravando...' : 'Confirmar Pedido'}</Button>
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
                                <Button variant={printFormat === 'a4' ? 'default' : 'outline'} size="sm" onClick={() => setPrintFormat('a4')}>Papel A4</Button>
                                <Button variant={printFormat === 'a5' ? 'default' : 'outline'} size="sm" onClick={() => setPrintFormat('a5')}>Papel A5</Button>
                                <Button variant={printFormat === 'cupom' ? 'default' : 'outline'} size="sm" onClick={() => setPrintFormat('cupom')}>Cupom (80mm)</Button>
                            </div>
                            <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 font-bold"><Printer className="w-4 h-4 mr-2" /> Imprimir Agora</Button>
                        </div>
                        <div className="bg-slate-50 p-4 md:p-8 overflow-auto max-h-[75vh] rounded-lg border shadow-inner">
                            <style>{`
                                .print-container { 
                                    background: white; 
                                    color: black; 
                                    margin: 0 auto; 
                                    font-family: 'Inter', sans-serif;
                                    line-height: 1.2;
                                }
                                .prnt-a4 { width: 210mm; min-height: 297mm; padding: 10mm; }
                                .prnt-a5 { width: 148mm; min-height: 210mm; padding: 8mm; }
                                .prnt-cupom { 
                                    width: 80mm; 
                                    padding: 4mm; 
                                    font-family: Arial, sans-serif; 
                                    font-size: 11px; 
                                    line-height: 1.4;
                                }
                                
                                /* A4/A5 Specific */
                                .a4-header { border: 1px solid #000; padding: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
                                .a4-client-box { border: 1px solid #000; padding: 10px; margin-bottom: 10px; font-size: 12px; }
                                .a4-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                .a4-table th { border-bottom: 2px solid #000; padding: 5px; text-align: left; font-size: 11px; text-transform: uppercase; }
                                .a4-table td { border-bottom: 1px solid #eee; padding: 8px 5px; font-size: 11px; }
                                .a4-footer { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #eee; pt-4; }
                                
                                /* Cupom Specific */
                                .cupom-dashed { border-top: 1px dashed #000; margin: 5px 0; }
                                .cupom-double { border-top: 3px double #000; margin: 5px 0; }
                                .cupom-header { text-align: center; font-size: 12px; margin-bottom: 10px; }
                                .cupom-table { width: 100%; font-size: 10px; border-collapse: collapse; }
                                .cupom-table th { border-bottom: 1px dashed #000; text-align: left; padding: 2px 0; }
                                .cupom-table td { padding: 2px 0; }
                                .cupom-total { border-top: 3px double #000; border-bottom: 3px double #000; padding: 5px 0; margin: 10px 0; font-size: 14px; font-weight: bold; }

                                @media print { 
                                    .no-print { display: none !important; } 
                                    body { background: white !important; }
                                    .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
                                    .max-h-[75vh] { max-height: none !important; overflow: visible !important; }
                                    .bg-slate-50 { background: white !important; }
                                }
                            `}</style>

                            <div className={`print-container prnt-${printFormat}`}>
                                {printFormat === 'cupom' ? (
                                    /* LAYOUT CUPOM TÉRMICO */
                                    <div className="cupom-content">
                                        <div className="cupom-header">
                                            <p>{company?.logradouro || 'Av. Marcelino Pires'}, {company?.numero || '5235'}</p>
                                            <p>{company?.bairro || 'vila Ubiratã'} - {company?.cidade || 'Dourados'}/{company?.estado || 'MS'}</p>
                                            <p>TEL: {company?.telefone || '(67) 3424-3068 / (67) 9 9910-0220'}</p>
                                            <p>Vendedor: {selectedVendaForReceipt.atendentes?.nome || 'N/A'}</p>
                                        </div>

                                        <div className="cupom-double"></div>
                                        <div className="text-center font-black text-lg py-1">PEDIDO Nº {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</div>
                                        <div className="cupom-double"></div>

                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span>Data: {fmtDate(selectedVendaForReceipt.data_venda)}</span>
                                            <span>Entrega: {fmtDate(selectedVendaForReceipt.data_venda)}</span>
                                        </div>

                                        <div className="text-[11px] mb-1">
                                            <strong>Cliente:</strong> {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR'}
                                        </div>
                                        <div className="text-[11px] mb-2">
                                            <strong>Telefone:</strong> {selectedVendaForReceipt.clientes?.telefone || '---'}
                                        </div>

                                        {selectedVendaForReceipt.entrega && (
                                            <div className="border border-black p-1 text-[10px]">
                                                <div className="text-center font-bold border-bottom border-black mb-1"><u>ENTREGA</u></div>
                                                <div><strong>Recebedor:</strong> {selectedVendaForReceipt.entrega.recebedor_nome}</div>
                                                <div><strong>Telefone:</strong> {selectedVendaForReceipt.entrega.contato}</div>
                                                <div><strong>End:</strong> {selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero}</div>
                                                <div><strong>Bairro:</strong> {selectedVendaForReceipt.entrega.bairro}</div>
                                                <div><strong>Cidade:</strong> {selectedVendaForReceipt.entrega.cidade}</div>
                                                <div className="border border-black text-center font-bold my-1 flex justify-center items-center gap-1 py-0.5">
                                                    <span>💰 COBRAR NA ENTREGA</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="cupom-dashed"></div>
                                        <div className="text-center font-bold text-[11px]">PRODUTOS</div>
                                        <div className="cupom-dashed"></div>

                                        <table className="cupom-table">
                                            <thead>
                                                <tr>
                                                    <th className="text-left">Nome</th>
                                                    <th className="text-center">Qtd</th>
                                                    <th className="text-right">Unit</th>
                                                    <th className="text-right">Sub</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedVendaForReceipt.itens.map((i: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td>{(i.produtos || i.produto)?.nome || `Produto #${i.produto_id || idx + 1}`}</td>
                                                        <td className="text-center">{i.quantidade}</td>
                                                        <td className="text-right">{new Intl.NumberFormat('pt-BR').format(i.preco_unitario)}</td>
                                                        <td className="text-right">{new Intl.NumberFormat('pt-BR').format(i.subtotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="cupom-double"></div>
                                        <div className="text-center font-bold text-[11px]">PAGAMENTO</div>
                                        <div className="cupom-double"></div>

                                        <div className="cupom-total flex justify-between">
                                            <span>Total do Pedido:</span>
                                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                        </div>

                                        <div className="cupom-dashed"></div>
                                        <div className="flex justify-between text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="font-bold">Emissão</span>
                                                <span>{fmtDate(selectedVendaForReceipt.data_venda)}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="font-bold">Vencimento</span>
                                                <span>{fmtDate(selectedVendaForReceipt.data_venda)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-8 text-center text-[9px]">
                                            *** Este ticket não é documento fiscal ***
                                        </div>
                                    </div>
                                ) : (
                                    /* LAYOUT A4 / A5 */
                                    <div className="a4-content">
                                        <div className="a4-header">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 border-2 border-black flex items-center justify-center rounded-lg">
                                                    <ShoppingCart className="w-10 h-10" />
                                                </div>
                                                <div>
                                                    <h1 className="text-2xl font-black uppercase leading-tight">{company?.nome_fantasia || 'Dourados Auto Peças'}</h1>
                                                    <p className="text-xs opacity-70 italic">{company?.mensagem_rodape || 'Slogan ou descrição do seu negócio'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black">PEDIDO DE VENDA {formatNumPedido(selectedVendaForReceipt.numero_pedido)}</div>
                                                <div className="text-[10px] opacity-60">Página 1 de 1</div>
                                                <div className="text-[10px] opacity-60">{fmtDateTime(new Date().toISOString())}</div>
                                            </div>
                                        </div>

                                        <div className="text-right text-[11px] font-bold mb-2 uppercase">Emissão {fmtDate(selectedVendaForReceipt.data_venda)}</div>

                                        <div className="a4-client-box">
                                            <div className="grid grid-cols-2 gap-y-1">
                                                <div className="col-span-2"><strong>Cliente:</strong> {selectedVendaForReceipt.clientes?.documento || '000.000.000-00'} - {selectedVendaForReceipt.clientes?.nome || 'CONSUMIDOR FINAL'}</div>
                                                <div><u><strong>Endereço:</strong></u> {selectedVendaForReceipt.clientes?.logradouro ? `${selectedVendaForReceipt.clientes.logradouro}, ${selectedVendaForReceipt.clientes.numero}` : 'Não informado'}</div>
                                                <div className="col-span-2 grid grid-cols-2 mt-1">
                                                    <div><strong>Telefone:</strong> {selectedVendaForReceipt.clientes?.telefone || '---'}</div>
                                                    <div><strong>E-mail:</strong> {selectedVendaForReceipt.clientes?.email || '---'}</div>
                                                </div>
                                                <div className="col-span-2 border-t pt-2 mt-2 flex justify-between">
                                                    <div><strong>Natureza da operação:</strong> 5101 - Venda de mercadoria</div>
                                                    <div><strong>Vendedor:</strong> {selectedVendaForReceipt.atendentes?.nome || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <table className="a4-table">
                                            <thead>
                                                <tr>
                                                    <th className="w-8 text-center">#</th>
                                                    <th className="text-left">ITEM / DESCRIÇÃO</th>
                                                    <th className="text-center">SKU</th>
                                                    <th className="text-center">QTD</th>
                                                    <th className="text-right">VL UN</th>
                                                    <th className="text-right">SUBTOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedVendaForReceipt.itens.map((i: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="text-center opacity-60">{idx + 1}</td>
                                                        <td className="font-bold">{(i.produtos || i.produto)?.nome || `Produto #${i.produto_id || idx + 1}`}</td>
                                                        <td className="text-center opacity-60">{(i.produtos || i.produto)?.sku || '---'}</td>
                                                        <td className="text-center font-bold">{i.quantidade}</td>
                                                        <td className="text-right">{new Intl.NumberFormat('pt-BR').format(i.preco_unitario)}</td>
                                                        <td className="text-right font-black">{new Intl.NumberFormat('pt-BR').format(i.subtotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="grid grid-cols-2 gap-10 mt-10">
                                            <div className="border-t-2 border-black pt-2">
                                                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">COBRANÇA</div>
                                                <div className="text-sm font-black">Forma de pagamento: {selectedVendaForReceipt.forma_pagamento || 'Dinheiro'}</div>
                                                <div className="text-[10px] opacity-60">Status: {selectedVendaForReceipt.status}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-[10px] uppercase font-bold text-muted-foreground border-b border-black w-full text-right pb-1 mb-2">TOTAIS</div>
                                                <div className="flex justify-between w-full text-sm">
                                                    <span>Subtotal dos produtos</span>
                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                                </div>
                                                <div className="flex justify-between w-full text-sm">
                                                    <span>Frete / Outros</span>
                                                    <span>R$ 0,00</span>
                                                </div>
                                                <div className="flex justify-between w-full border-t-2 border-black pt-2 mt-2 font-black text-xl">
                                                    <span>VALOR TOTAL</span>
                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8 border-t border-dotted pt-4">
                                            {selectedVendaForReceipt.entrega && (
                                                <div className="border-4 border-black p-4 mb-6 bg-slate-50">
                                                    <div className="flex justify-between items-center mb-2 border-b-2 border-black pb-1">
                                                        <h2 className="text-xl font-black uppercase underline">DADOS COMPLETOS DE ENTREGA</h2>
                                                        <div className={`px-4 py-1 border-4 border-black font-black text-xl ${selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                                            {selectedVendaForReceipt.status === 'Pago' || selectedVendaForReceipt.status === 'Entregue' ? 'PAGO / CONFERIDO' : 'A RECEBER NO ATO'}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
                                                        <div><span className="font-bold uppercase text-[10px] block">Recebedor:</span> <span className="text-lg font-black">{selectedVendaForReceipt.entrega.recebedor_nome || selectedVendaForReceipt.clientes?.nome}</span></div>
                                                        <div><span className="font-bold uppercase text-[10px] block">Contato:</span> <span className="text-lg font-black">{selectedVendaForReceipt.entrega.contato || selectedVendaForReceipt.clientes?.telefone}</span></div>
                                                        <div className="col-span-2 border-t border-black pt-1">
                                                            <span className="font-bold uppercase text-[10px] block">Endereço de Entrega:</span>
                                                            <span className="text-lg font-black">{selectedVendaForReceipt.entrega.rua}, {selectedVendaForReceipt.entrega.numero} - {selectedVendaForReceipt.entrega.bairro} ({selectedVendaForReceipt.entrega.cidade}/{selectedVendaForReceipt.entrega.estado})</span>
                                                        </div>
                                                        <div className="col-span-2 bg-black h-1 my-1"></div>
                                                        <div className="col-span-2 text-center font-black italic text-lg uppercase">
                                                            *** ATENÇÃO ENTREGADOR: CONFERIR PRODUTOS E VALORES ANTES DE DEIXAR O LOCAL ***
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-[10px] font-bold italic tracking-widest opacity-60 uppercase underline underline-offset-4 decoration-1 decoration-dotted">OBRIGADO PELA PREFERÊNCIA!</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL FINALIZAR VENDA */}
            <Modal isOpen={isFinalizarModalOpen} onClose={() => setIsFinalizarModalOpen(false)} title="Finalizar Pagamento" className="max-w-md">
                <form onSubmit={handleFinalizarVenda} className="space-y-4">
                    <div className="p-4 bg-muted/30 border rounded-lg text-center"><div className="text-xs uppercase opacity-70">Total a Receber</div><div className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendaParaFinalizar?.total || 0)}</div>{finalizarForm.pagamentos[0]?.forma === 'Dinheiro' && <p className="text-xs text-amber-600 mt-2">Pagamento em dinheiro exige caixa do dia aberto.</p>}</div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><Label className="font-bold">Formas de Pagamento</Label><Button type="button" variant="outline" size="sm" onClick={() => setFinalizarForm({ ...finalizarForm, pagamentos: [...finalizarForm.pagamentos, { id: Math.random().toString(36).substr(2, 9), forma: 'Pix', valor: 0, parcelas: 1, primeiro_vencimento: new Date().toISOString().split('T')[0], intervalo: 30 }] })}><Plus className="w-3 h-3 hmr-1" /> Add</Button></div>
                        {finalizarForm.pagamentos.map((pg, idx) => (
                            <div key={pg.id} className="p-3 border rounded-lg bg-muted/20 space-y-2 relative group">
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="h-9 px-2 rounded-md border text-xs bg-background" value={pg.forma} onChange={e => { const n = [...finalizarForm.pagamentos]; n[idx].forma = e.target.value; setFinalizarForm({ ...finalizarForm, pagamentos: n }) }}>
                                        <option value="Dinheiro">Dinheiro</option><option value="Pix">PIX</option><option value="Cartão Crédito">Cartão Crédito</option><option value="Cartão Débito">Cartão Débito</option><option value="Boleto">Boleto</option><option value="Haver Cliente">Haver Cliente</option>
                                    </select>
                                    <Input type="number" step="0.01" className="h-9 font-bold" value={pg.valor} onChange={e => { const n = [...finalizarForm.pagamentos]; n[idx].valor = parseFloat(e.target.value) || 0; setFinalizarForm({ ...finalizarForm, pagamentos: n }) }} />
                                </div>
                                {(pg.forma === 'Boleto' || pg.forma === 'Cartão Crédito' || pg.forma === 'Cartão Débito') && (
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                                        <div className="space-y-1"><Label className="text-[10px]">Parcelas</Label><Input type="number" className="h-8 text-xs" value={pg.parcelas} onChange={e => { const n = [...finalizarForm.pagamentos]; n[idx].parcelas = parseInt(e.target.value) || 1; setFinalizarForm({ ...finalizarForm, pagamentos: n }) }} /></div>
                                        <div className="space-y-1"><Label className="text-[10px]">Vencimento</Label><Input type="date" className="h-8 text-xs" value={pg.primeiro_vencimento} onChange={e => { const n = [...finalizarForm.pagamentos]; n[idx].primeiro_vencimento = e.target.value; setFinalizarForm({ ...finalizarForm, pagamentos: n }) }} /></div>
                                    </div>
                                )}
                                {finalizarForm.pagamentos.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100" onClick={() => setFinalizarForm({ ...finalizarForm, pagamentos: finalizarForm.pagamentos.filter((_, i) => i !== idx) })}><Trash2 className="w-3 h-3" /></Button>}
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2 border-t pt-4">
                        <Label>Status Final</Label>
                        <select className="w-full h-10 px-3 rounded-md border" value={finalizarForm.status} onChange={e => setFinalizarForm({ ...finalizarForm, status: e.target.value as any })}>
                            <option value="Pago">Pago / Caixa</option>
                            <option value="Entregue">Pago e Entregue</option>
                            <option value="Pendente">Reservar (Pendente)</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t"><Button type="button" variant="outline" onClick={() => setIsFinalizarModalOpen(false)}>Cancelar</Button><Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">{submitting ? 'Salvando...' : 'Finalizar Venda'}</Button></div>
                </form>
            </Modal>

            {/* QUICK MODALS */}
            <Modal isOpen={isNovoClienteModalOpen} onClose={() => setIsNovoClienteModalOpen(false)} title="Quick Cliente">
                <form onSubmit={handleCreateNovoCliente} className="space-y-4">
                    <Input placeholder="Nome" value={novoClienteForm.nome} onChange={e => setNovoClienteForm({ ...novoClienteForm, nome: e.target.value })} required />
                    <Input placeholder="Documento" value={novoClienteForm.documento} onChange={e => setNovoClienteForm({ ...novoClienteForm, documento: e.target.value })} />
                    <Input placeholder="Telefone" value={novoClienteForm.telefone} onChange={e => setNovoClienteForm({ ...novoClienteForm, telefone: e.target.value })} />
                    <Button type="submit" className="w-full" disabled={submitting}>Salvar</Button>
                </form>
            </Modal>

            <Modal isOpen={isNovoProdutoModalOpen} onClose={() => setIsNovoProdutoModalOpen(false)} title="Quick Produto">
                <form onSubmit={(e) => handleCreateNovoProduto(e, vendaItems.length - 1)} className="space-y-4">
                    <Input placeholder="Nome Produto" value={novoProdutoForm.nome} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, nome: e.target.value })} required />
                    <Input type="number" placeholder="Preço" value={novoProdutoForm.preco || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, preco: parseFloat(e.target.value) || 0 })} required />
                    <Button type="submit" className="w-full" disabled={submitting}>Salvar</Button>
                </form>
            </Modal>
        </div>
    )
}
