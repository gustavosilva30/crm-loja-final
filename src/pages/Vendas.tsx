import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, MoreHorizontal, ShoppingCart, TrendingUp, Trash2, Package, User, Truck, CheckCircle2, Printer, Download, Share2 } from "lucide-react"
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
    forma_pagamento?: string
    atendente_id?: string
    // itens carregados só no recibo
    itens?: any[]
}

interface ItemVenda {
    produto_id: string
    quantidade: number
    preco_unitario: number
    nome?: string // for UI display
    sku?: string // for UI display
}

export function Vendas() {
    const [searchTerm, setSearchTerm] = useState("")
    const [vendas, setVendas] = useState<Venda[]>([])
    const [loading, setLoading] = useState(true)

    const [activeTab, setActiveTab] = useState<"aberto" | "concluido">("aberto")
    const [filterStatus, setFilterStatus] = useState<string>("todos")
    const [filterOrigem, setFilterOrigem] = useState<string>("todos")
    const [filterDataInicio, setFilterDataInicio] = useState<string>("")
    const [filterDataFim, setFilterDataFim] = useState<string>("")
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    const [isVendaModalOpen, setIsVendaModalOpen] = useState(false)
    const [isEntregaModalOpen, setIsEntregaModalOpen] = useState(false)
    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
    const [isNovoProdutoModalOpen, setIsNovoProdutoModalOpen] = useState(false)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedVendaForReceipt, setSelectedVendaForReceipt] = useState<any>(null)
    const [submitting, setSubmitting] = useState(false)

    // Resources
    const [clientes, setClientes] = useState<{ id: string, nome: string, endereco: string, telefone: string }[]>([])
    const [produtos, setProdutos] = useState<{ id: string, nome: string, preco: number, sku: string }[]>([])
    const [transportadoras, setTransportadoras] = useState<{ id: string, nome: string }[]>([])
    const [atendentes, setAtendentes] = useState<any[]>([])
    const [company, setCompany] = useState<any>(null)

    // Venda Form State
    const [vendaForm, setVendaForm] = useState({
        cliente_id: '',
        atendente_id: '',
        status: 'Pendente' as Venda['status'],
        origem_ml: false,
        forma_pagamento: 'Dinheiro',
        desconto: 0
    })
    const [finalizeForm, setFinalizeForm] = useState({
        venda_id: '',
        forma_pagamento: 'Dinheiro',
        valor_pagar: 0,
        data_vencimento: new Date().toISOString().split('T')[0]
    })
    const [vendaItems, setVendaItems] = useState<ItemVenda[]>([])
    const [createdVendaId, setCreatedVendaId] = useState<string | null>(null)

    // Entrega Form State
    const [entregaForm, setEntregaForm] = useState({
        transportadora_id: '',
        codigo_rastreio: '',
        endereco_entrega: '',
        contato_entrega: '',
        status_pagamento: 'A Receber' as 'Pago' | 'A Receber'
    })

    // Print Format State
    const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom'>('a4')

    // Produto Form State
    const [novoProdutoForm, setNovoProdutoForm] = useState({
        sku: '',
        nome: '',
        preco: 0,
        custo: 0,
        estoque_atual: 0,
        estoque_minimo: 5
    })

    const fetchVendas = async () => {
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`
                    *, 
                    clientes ( id, nome, documento, email, telefone, endereco ),
                    atendentes ( nome )
                `)
                .order('data_venda', { ascending: false })

            if (error) {
                // Fallback: se falhar (ex: atendente_id ainda não existe), busca sem o join
                console.warn('Tentando query de fallback sem atendentes...', error.message)
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('vendas')
                    .select(`
                        *,
                        clientes ( id, nome, documento, email, telefone, endereco )
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
        const { data: products } = await supabase.from('produtos').select('id, nome, preco, sku')
        const { data: carriers } = await supabase.from('transportadoras').select('id, nome')
        const { data: staff } = await supabase.from('atendentes').select('id, nome')
        // Usa maybeSingle() para não lançar erro se a tabela estiver vazia
        const { data: comp } = await supabase.from('configuracoes_empresa').select('*').maybeSingle()

        if (clients) setClientes(clients)
        if (products) setProdutos(products)
        if (carriers) setTransportadoras(carriers)
        if (staff) setAtendentes(staff)
        if (comp) setCompany(comp)
    }

    useEffect(() => {
        fetchVendas()
        fetchResources()

        const savedCart = localStorage.getItem('crm_venda_cart')
        if (savedCart) {
            try {
                const items = JSON.parse(savedCart)
                if (items.length > 0) {
                    setVendaItems(items)
                    setIsVendaModalOpen(true)
                    localStorage.removeItem('crm_venda_cart')
                }
            } catch (e) { }
        }
    }, [])

    const addVendaItem = () => {
        setVendaItems([...vendaItems, { produto_id: '', quantidade: 1, preco_unitario: 0 }])
    }

    const removeVendaItem = (index: number) => {
        setVendaItems(vendaItems.filter((_, i) => i !== index))
    }

    const updateVendaItem = (index: number, field: keyof ItemVenda, value: any) => {
        const newItems = [...vendaItems]
        const item = { ...newItems[index] }

        if (field === 'produto_id') {
            const prod = produtos.find(p => p.id === value)
            if (prod) {
                item.produto_id = prod.id
                item.preco_unitario = prod.preco
                item.nome = prod.nome
                item.sku = prod.sku
            }
        } else {
            (item as any)[field] = value
        }

        newItems[index] = item
        setVendaItems(newItems)
    }

    const calculateTotal = () => {
        const sub = vendaItems.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0);
        return Math.max(0, sub - (vendaForm.desconto || 0));
    }

    const [productSearch, setProductSearch] = useState("")

    const filteredResourcesProdutos = produtos.filter(p =>
        p.nome.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
    )

    const handleCreateVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        if (vendaItems.length === 0) return alert('Adicione pelo menos um produto')

        setSubmitting(true)
        try {
            const total = calculateTotal()

            if (createdVendaId) {
                // Edit Mode
                const { error: updErr } = await supabase.from('vendas').update({
                    cliente_id: vendaForm.cliente_id || null,
                    total: total,
                    status: vendaForm.status,
                    origem_ml: vendaForm.origem_ml,
                    forma_pagamento: vendaForm.forma_pagamento,
                    atendente_id: vendaForm.atendente_id || null
                }).eq('id', createdVendaId);

                if (updErr) throw updErr;

                // Simple items replacement
                await supabase.from('vendas_itens').delete().eq('venda_id', createdVendaId);
                const itemsToInsert = vendaItems.map(item => ({
                    venda_id: createdVendaId,
                    produto_id: item.produto_id,
                    quantidade: item.quantidade,
                    preco_unitario: item.preco_unitario,
                    subtotal: item.quantidade * item.preco_unitario
                }));
                await supabase.from('vendas_itens').insert(itemsToInsert);

                setIsVendaModalOpen(false);
                setCreatedVendaId(null);
                fetchVendas();
                return;
            }

            // 1. Insert Venda — tenta com atendente_id, faz fallback sem ele se a coluna ainda não existir
            let vendaId: string | null = null

            const vendaPayloadFull = {
                cliente_id: vendaForm.cliente_id || null,
                total: total,
                status: vendaForm.status,
                origem_ml: vendaForm.origem_ml,
                forma_pagamento: vendaForm.forma_pagamento,
                atendente_id: vendaForm.atendente_id || null
            }

            const { data: vData, error: vError } = await supabase
                .from('vendas')
                .insert([vendaPayloadFull])
                .select('id')
                .single()

            if (vError) {
                // Se a coluna atendente_id não existe ainda, tenta sem ela
                const { data: vData2, error: vError2 } = await supabase
                    .from('vendas')
                    .insert([{
                        cliente_id: vendaForm.cliente_id || null,
                        total: total,
                        status: vendaForm.status,
                        origem_ml: vendaForm.origem_ml,
                        forma_pagamento: vendaForm.forma_pagamento,
                    }])
                    .select('id')
                    .single()
                if (vError2) throw vError2
                vendaId = vData2!.id
            } else {
                vendaId = vData!.id
            }

            if (!vendaId) throw new Error('Não foi possível criar a venda.')

            // 2. Insert Items
            const itemsToInsert = vendaItems.map(item => ({
                venda_id: vendaId,
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                subtotal: item.quantidade * item.preco_unitario
            }))

            const { error: itemsError } = await supabase
                .from('vendas_itens')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            setCreatedVendaId(vendaId)

            // Pre-fill delivery form if client selected
            if (vendaForm.cliente_id) {
                const client = clientes.find(c => c.id === vendaForm.cliente_id)
                if (client) {
                    setEntregaForm({
                        ...entregaForm,
                        endereco_entrega: client.endereco || '',
                        contato_entrega: client.telefone || ''
                    })
                }
            }

            fetchVendas()
            handleOpenReceipt(vendaId)
            // Instead of closing, we'll offer to go to delivery
        } catch (err) {
            console.error('Error:', err)
            alert('Erro ao processar venda')
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateEntrega = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!createdVendaId) return

        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('entregas')
                .insert([{
                    venda_id: createdVendaId,
                    transportadora_id: entregaForm.transportadora_id || null,
                    codigo_rastreio: entregaForm.codigo_rastreio || null,
                    endereco_entrega: entregaForm.endereco_entrega || null,
                    contato_entrega: entregaForm.contato_entrega || null,
                    status_pagamento: entregaForm.status_pagamento,
                    status: 'Preparando'
                }])

            if (error) throw error

            setIsEntregaModalOpen(false)
            setIsVendaModalOpen(false)
            setCreatedVendaId(null)
            alert('Venda e Entrega registradas com sucesso!')
        } catch (err) {
            console.error('Error:', err)
            alert('Erro ao registrar entrega')
        } finally {
            setSubmitting(false)
        }
    }

    const handleFinalizeVenda = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const venda = vendas.find(v => v.id === finalizeForm.venda_id);
            if (!venda) return;

            const valorPagar = finalizeForm.valor_pagar || 0;
            if (valorPagar <= 0) return alert("Informe um valor maior que zero");

            const novoTotalPago = (venda.total_pago || 0) + valorPagar;
            const novoValorAberto = Math.max(0, venda.total - novoTotalPago);
            const novoStatus = novoValorAberto <= 0 ? 'Pago' : 'Pendente';

            // 1. Update Venda
            const { error: updateErr } = await supabase.from('vendas')
                .update({
                    status: novoStatus,
                    total_pago: novoTotalPago,
                    valor_aberto: novoValorAberto,
                    forma_pagamento: finalizeForm.forma_pagamento // Última forma usada
                })
                .eq('id', finalizeForm.venda_id);

            if (updateErr) throw updateErr;

            // 2. Registra o pagamento no histórico
            const { error: payErr } = await supabase.from('vendas_pagamentos')
                .insert([{
                    venda_id: venda.id,
                    valor: valorPagar,
                    forma_pagamento: finalizeForm.forma_pagamento
                }]);

            if (payErr) throw payErr;

            // 3. Criar lançamento financeiro se for Dinheiro ou outros que entram no caixa
            const desc = `Pagamento Parcial Venda #${venda.id.substring(0, 8)} - ${finalizeForm.forma_pagamento}`;

            const isBoleto = finalizeForm.forma_pagamento === 'Boleto';
            const statusLancamento = isBoleto ? 'Pendente' : 'Pago';

            const { error: finError } = await supabase.from('financeiro_lancamentos')
                .insert([{
                    tipo: 'Receita',
                    valor: valorPagar,
                    data_vencimento: isBoleto ? finalizeForm.data_vencimento : new Date().toISOString().split('T')[0],
                    data_pagamento: isBoleto ? null : new Date().toISOString().split('T')[0],
                    status: statusLancamento,
                    venda_id: venda.id,
                    forma_pagamento: finalizeForm.forma_pagamento,
                    descricao: desc
                }]);

            if (finError) throw finError;

            // 4. Se for Haver Cliente, desconta do saldo do cliente
            if (finalizeForm.forma_pagamento === 'Haver Cliente' && venda.cliente_id) {
                const client = clientes.find(c => c.id === venda.cliente_id);
                if (client) {
                    const currentSaldo = (client as any).saldo_haver || 0;
                    const novoSaldo = currentSaldo - valorPagar;
                    await supabase.from('clientes').update({ saldo_haver: novoSaldo }).eq('id', client.id);
                }
            }

            setIsFinalizeModalOpen(false);
            fetchVendas();
            alert(`Pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorPagar)} registrado!`);
        } catch (err) {
            console.error('Error:', err)
            alert('Erro ao finalizar pagamento')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEditVenda = async (venda: Venda) => {
        setCreatedVendaId(venda.id);
        const { data: itens } = await supabase.from('vendas_itens').select('*').eq('venda_id', venda.id);

        setVendaForm({
            cliente_id: venda.cliente_id || '',
            status: venda.status,
            origem_ml: venda.origem_ml || false,
            forma_pagamento: (venda as any).forma_pagamento || 'Dinheiro',
            atendente_id: venda.atendente_id || '',
            desconto: 0 // Since we dont store discount separately, we keep it 0 on edit
        });

        if (itens) {
            const formatted = itens.map(i => {
                const p = produtos.find(prod => prod.id === i.produto_id);
                return {
                    produto_id: i.produto_id,
                    quantidade: i.quantidade,
                    preco_unitario: i.preco_unitario,
                    nome: p?.nome || '',
                    sku: p?.sku || ''
                }
            })
            setVendaItems(formatted);
        } else {
            setVendaItems([]);
        }

        setIsVendaModalOpen(true);
    }

    const handleCancelVenda = async (id: string) => {
        if (!confirm('Deseja realmente CANCELAR esta venda? Isso devolverá os produtos ao estoque e estornará pagamentos (Dinheiro/Haver).')) return;
        setSubmitting(true);
        try {
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

    const handleCreateNovoProduto = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            let skuValue = novoProdutoForm.sku.trim();
            // Optional: calculate sku if not provided manually
            if (!skuValue) {
                const numericSkus = produtos.map(p => parseInt(p.sku, 10)).filter(n => !isNaN(n));
                const nextSkuNum = numericSkus.length > 0 ? Math.max(...numericSkus) + 1 : 1;
                skuValue = nextSkuNum.toString();
            }

            const payload = {
                ...novoProdutoForm,
                sku: skuValue,
            };

            const { error } = await supabase.from('produtos').insert([payload]);
            if (error) throw error;

            await fetchResources();
            setIsNovoProdutoModalOpen(false);
            setNovoProdutoForm({ sku: '', nome: '', preco: 0, custo: 0, estoque_atual: 0, estoque_minimo: 5 });
            alert('Produto cadastrado e disponível para venda!');
        } catch (err: any) {
            console.error('Error creating product:', err);
            alert('Erro ao cadastrar produto: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    // Formata o número do pedido com zeros à esquerda: 000001
    const formatNumPedido = (num?: number) =>
        num ? String(num).padStart(6, '0') : '------'

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase().trim();
        const numPedidoStr = v.numero_pedido ? String(v.numero_pedido).padStart(6, '0') : '';
        const matchesSearch = !termLower ||
            numPedidoStr.includes(termLower) ||
            (v.clientes?.nome?.toLowerCase() || '').includes(termLower) ||
            (v.ml_order_id?.toLowerCase() || '').includes(termLower) ||
            v.id.toLowerCase().includes(termLower);

        const matchesTab = activeTab === "aberto"
            ? ['Pendente', 'Pago', 'Enviado'].includes(v.status)
            : ['Entregue', 'Cancelado'].includes(v.status);

        const matchesStatus = filterStatus === "todos" || v.status === filterStatus;

        const matchesOrigem = filterOrigem === "todos"
            ? true
            : filterOrigem === "ml" ? v.origem_ml : !v.origem_ml;

        let matchesPeriodo = true;
        if (filterDataInicio || filterDataFim) {
            const dataVenda = v.data_venda.split('T')[0]; // YYYY-MM-DD
            if (filterDataInicio && dataVenda < filterDataInicio) matchesPeriodo = false;
            if (filterDataFim && dataVenda > filterDataFim) matchesPeriodo = false;
        }

        return matchesSearch && matchesTab && matchesStatus && matchesOrigem && matchesPeriodo;
    })

    const faturamentoTotal = vendas
        .filter(v => v.status !== 'Cancelado')
        .reduce((acc, v) => acc + (v.total || 0), 0)

    const handleOpenReceipt = async (vendaId: string) => {
        if (!vendaId) return
        setLoading(true)
        try {
            // Tenta com atendentes join, faz fallback se coluna não existir
            let venda: any = null

            const { data: v1, error: e1 } = await supabase
                .from('vendas')
                .select(`
                    *,
                    clientes (id, nome, documento, email, telefone, endereco),
                    atendentes (nome)
                `)
                .eq('id', vendaId)
                .single()

            if (e1) {
                // Fallback sem atendentes
                const { data: v2, error: e2 } = await supabase
                    .from('vendas')
                    .select(`
                        *,
                        clientes (id, nome, documento, email, telefone, endereco)
                    `)
                    .eq('id', vendaId)
                    .single()
                if (e2) throw e2
                venda = v2
            } else {
                venda = v1
            }

            const { data: itens, error: iErr } = await supabase
                .from('vendas_itens')
                .select(`
                    *,
                    produtos (nome, sku)
                `)
                .eq('venda_id', vendaId)

            if (iErr) throw iErr

            const { data: entrega } = await supabase
                .from('entregas')
                .select(`
                    *,
                    transportadoras (nome)
                `)
                .eq('venda_id', vendaId)
                .maybeSingle()

            setSelectedVendaForReceipt({
                ...venda,
                itens: itens || [],
                entrega: entrega || null
            })
            setIsReceiptModalOpen(true)
        } catch (err: any) {
            console.error('Error loading receipt:', err)
            alert('Não foi possível carregar o pedido: ' + (err?.message || 'Erro desconhecido'))
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        const printContent = document.getElementById('printable-receipt')
        if (!printContent) return window.print()

        const printWindow = window.open('', '_blank', 'width=900,height=700')
        if (!printWindow) return window.print()

        printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido de Venda</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
    .receipt { padding: 24px; max-width: 900px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; }
    tbody tr { border-bottom: 1px solid #ccc; }
    thead tr { border-top: 2px solid #000; border-bottom: 2px solid #000; }
    .total-box { border-top: 2px solid #000; padding-top: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    ${printContent.innerHTML}
  </div>
  <script>
    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
  </script>
</body>
</html>`)
        printWindow.document.close()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe seus pedidos e canais de venda.</p>
                </div>
                <Button className="gap-2" onClick={() => {
                    setCreatedVendaId(null)

                    const savedCart = localStorage.getItem('crm_venda_cart')
                    if (savedCart) {
                        try {
                            const items = JSON.parse(savedCart)
                            if (items.length > 0) {
                                setVendaItems(items)
                                localStorage.removeItem('crm_venda_cart')
                            }
                        } catch (e) { setVendaItems([]) }
                    } else {
                        setVendaItems([])
                    }

                    setIsVendaModalOpen(true)
                }}>
                    <Plus className="w-4 h-4" />
                    Nova Venda
                </Button>
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
                        <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Quantidade de Pedidos</CardTitle>
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{vendas.length} pedidos</div>
                        <p className="text-xs text-muted-foreground mt-1">Total registrado</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50">
                                <Button
                                    variant={activeTab === "aberto" ? "secondary" : "ghost"}
                                    size="sm"
                                    className="gap-2 h-8 px-4"
                                    onClick={() => setActiveTab("aberto")}
                                >
                                    Fila de Pedidos (Abertos)
                                </Button>
                                <Button
                                    variant={activeTab === "concluido" ? "secondary" : "ghost"}
                                    size="sm"
                                    className="gap-2 h-8 px-4"
                                    onClick={() => setActiveTab("concluido")}
                                >
                                    Histórico (Entregue/Cancelado)
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar venda..."
                                        className="pl-9 h-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant={isFilterOpen ? "secondary" : "outline"}
                                    size="sm"
                                    className="gap-2 h-9"
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                >
                                    <Filter className="w-4 h-4" />
                                    Filtros
                                </Button>
                            </div>
                        </div>

                        {isFilterOpen && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/20 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                    <Select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="h-8 text-xs"
                                    >
                                        <option value="todos">Todos os Status</option>
                                        <option value="Pendente">Pendente</option>
                                        <option value="Pago">Pago</option>
                                        <option value="Enviado">Enviado</option>
                                        <option value="Entregue">Entregue</option>
                                        <option value="Cancelado">Cancelado</option>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Início</Label>
                                        <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={filterDataInicio}
                                            onChange={(e) => setFilterDataInicio(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Fim</Label>
                                        <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={filterDataFim}
                                            onChange={(e) => setFilterDataFim(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Origem</Label>
                                    <Select
                                        value={filterOrigem}
                                        onChange={(e) => setFilterOrigem(e.target.value)}
                                        className="h-8 text-xs"
                                    >
                                        <option value="todos">Todas Origens</option>
                                        <option value="ml">Mercado Livre</option>
                                        <option value="loja">Venda Balcão</option>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs h-8"
                                        onClick={() => {
                                            setFilterStatus("todos");
                                            setFilterOrigem("todos");
                                            setFilterDataInicio("");
                                            setFilterDataFim("");
                                        }}
                                    >
                                        Limpar Filtros
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            Carregando vendas...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[90px]">Pedido</TableHead>
                                    <TableHead>Data / Cliente</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Origem</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVendas.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Nenhuma venda encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredVendas.map((venda) => (
                                    <TableRow key={venda.id}>
                                        <TableCell>
                                            <span className="font-black font-mono text-primary text-sm tracking-wider">
                                                #{formatNumPedido(venda.numero_pedido)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-[10px] text-muted-foreground font-mono">{new Date(venda.data_venda).toLocaleDateString('pt-BR')}</div>
                                            <div className="font-medium text-sm">{venda.clientes?.nome || 'Consumidor Final'}</div>
                                        </TableCell>
                                        <TableCell className="font-bold">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total)}
                                        </TableCell>
                                        <TableCell>
                                            {venda.origem_ml ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="ml" className="text-[10px] uppercase font-bold tracking-tight">Mercado Livre</Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{venda.ml_order_id}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight text-primary border-primary/20">Venda Balcão</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    venda.status === 'Pago' || venda.status === 'Entregue' ? 'default' :
                                                        venda.status === 'Pendente' ? 'outline' : 'destructive'
                                                }
                                                className="text-[10px]"
                                            >
                                                {venda.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {venda.status === 'Pendente' && (
                                                    <Button variant="ghost" size="icon" title="Finalizar Venda" onClick={() => {
                                                        setFinalizeForm({ ...finalizeForm, venda_id: venda.id });
                                                        setIsFinalizeModalOpen(true);
                                                    }}>
                                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" title="Imprimir Pedido" onClick={() => handleOpenReceipt(venda.id)}>
                                                    <Printer className="w-4 h-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Agendar Entrega" onClick={() => {
                                                    setCreatedVendaId(venda.id)
                                                    setIsEntregaModalOpen(true)
                                                }}>
                                                    <Truck className="w-4 h-4 text-emerald-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEditVenda(venda)}>
                                                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                                {venda.status !== 'Cancelado' && (
                                                    <Button variant="ghost" size="icon" title="Cancelar Venda" onClick={() => handleCancelVenda(venda.id)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* NEW VENDA MODAL */}
            <Modal
                isOpen={isVendaModalOpen}
                onClose={() => setIsVendaModalOpen(false)}
                title="Registrar Nova Venda"
                className="max-w-5xl"
            >
                {!createdVendaId ? (
                    <form onSubmit={handleCreateVenda} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Select
                                    value={vendaForm.cliente_id}
                                    onChange={e => setVendaForm({ ...vendaForm, cliente_id: e.target.value })}
                                >
                                    <option value="">Consumidor Final</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status inicial</Label>
                                <Select
                                    value={vendaForm.status}
                                    onChange={e => setVendaForm({ ...vendaForm, status: e.target.value as any })}
                                >
                                    <option value="Pendente">Aguardando Pagamento</option>
                                    <option value="Pago">Pedido Pago</option>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Forma de Pagamento</Label>
                                <Select
                                    value={vendaForm.forma_pagamento}
                                    onChange={e => setVendaForm({ ...vendaForm, forma_pagamento: e.target.value })}
                                >
                                    <option value="Dinheiro">Dinheiro (Entra no Caixa)</option>
                                    <option value="Pix">PIX</option>
                                    <option value="Cartão Crédito">Cartão de Crédito</option>
                                    <option value="Cartão Débito">Cartão de Débito</option>
                                    <option value="Boleto">Boleto Bancário</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Haver Cliente">Haver Cliente (Gasto de Crédito)</option>
                                </Select>
                            </div>
                            <div className="space-y-2 flex items-end">
                                <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted/30 w-full cursor-pointer" onClick={() => setVendaForm({ ...vendaForm, origem_ml: !vendaForm.origem_ml })}>
                                    <input
                                        type="checkbox"
                                        checked={vendaForm.origem_ml}
                                        onChange={() => { }}
                                        className="w-4 h-4 text-primary"
                                    />
                                    <span className="ml-2 text-sm text-muted-foreground">Origem Mercado Livre</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Atendente / Vendedor</Label>
                                <Select
                                    value={vendaForm.atendente_id}
                                    onChange={e => setVendaForm({ ...vendaForm, atendente_id: e.target.value })}
                                >
                                    <option value="">Não selecionado</option>
                                    {atendentes.map(at => <option key={at.id} value={at.id}>{at.nome}</option>)}
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                            {/* Product Selection */}
                            <div className="space-y-4 flex flex-col h-full border-r pr-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Search className="w-4 h-4" /> Buscar Produtos
                                    </h3>
                                    <Button type="button" variant="outline" size="icon" className="h-6 w-6" title="Cadastrar Novo Produto" onClick={() => setIsNovoProdutoModalOpen(true)}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="SKU ou Descrição..."
                                        className="pl-9"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {filteredResourcesProdutos.map(p => (
                                        <div key={p.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors flex justify-between items-center group"
                                            onClick={() => {
                                                const existing = vendaItems.find(item => item.produto_id === p.id)
                                                if (existing) {
                                                    setVendaItems(vendaItems.map(item => item.produto_id === p.id ? { ...item, quantidade: item.quantidade + 1 } : item))
                                                } else {
                                                    setVendaItems([...vendaItems, { produto_id: p.id, nome: p.nome, sku: p.sku, quantidade: 1, preco_unitario: p.preco }])
                                                }
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-xs font-mono text-primary font-bold">{p.sku}</span>
                                                <span className="text-sm font-medium">{p.nome}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-emerald-600">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco)}
                                                </span>
                                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cart */}
                            <div className="space-y-4 flex flex-col h-full pl-2">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" /> Carrinho de Itens
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {vendaItems.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-30">
                                            <ShoppingCart className="w-12 h-12" />
                                            <p className="text-xs font-bold uppercase">Carrinho Vazio</p>
                                        </div>
                                    ) : (
                                        vendaItems.map((item, index) => (
                                            <div key={index} className="flex flex-col p-3 border border-primary/20 bg-primary/5 rounded-lg gap-2">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-primary italic">[{item.sku}]</span>
                                                        <span className="text-xs font-black leading-tight">{item.nome}</span>
                                                    </div>
                                                    <button type="button" onClick={() => removeVendaItem(index)} className="text-destructive hover:scale-110 transition-transform">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 bg-background border rounded-md p-1">
                                                        <button type="button" onClick={() => updateVendaItem(index, 'quantidade', Math.max(1, item.quantidade - 1))} className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded">-</button>
                                                        <span className="text-xs font-bold w-6 text-center">{item.quantidade}</span>
                                                        <button type="button" onClick={() => updateVendaItem(index, 'quantidade', item.quantidade + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded">+</button>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-muted-foreground">Subtotal</span>
                                                        <span className="text-sm font-black text-primary">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.preco_unitario)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Desconto (R$)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 w-24 text-primary font-bold"
                                        value={vendaForm.desconto}
                                        onChange={e => setVendaForm({ ...vendaForm, desconto: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="text-sm text-muted-foreground pt-3">
                                    Total da Venda: <span className="text-2xl font-bold text-primary ml-2">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" type="button" onClick={() => setIsVendaModalOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? "Processando..." : "Confirmar Venda"}
                                </Button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="py-8 space-y-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                                <CheckCircle2 className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Venda #{createdVendaId.slice(0, 8)} registrada!</h3>
                            <p className="text-muted-foreground max-w-sm">Deseja cadastrar uma entrega para este pedido agora ou finalizar?</p>
                        </div>
                        <div className="flex flex-col gap-3 max-w-xs mx-auto">
                            <Button className="gap-2 w-full" onClick={() => setIsEntregaModalOpen(true)}>
                                <Truck className="w-5 h-5" /> Agendar Entrega
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => {
                                setIsVendaModalOpen(false)
                                setCreatedVendaId(null)
                            }}>Finalizar sem Entrega</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* NEW ENTREGA MODAL */}
            <Modal
                isOpen={isEntregaModalOpen}
                onClose={() => setIsEntregaModalOpen(false)}
                title="Configurar Logística de Entrega"
            >
                <form onSubmit={handleCreateEntrega} className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Pedido Origem</Label>
                        <div className="p-3 border border-border rounded-lg bg-muted/50 font-mono text-xs">
                            #{createdVendaId?.slice(0, 8)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Transportadora</Label>
                        <Select
                            value={entregaForm.transportadora_id}
                            onChange={e => setEntregaForm({ ...entregaForm, transportadora_id: e.target.value })}
                        >
                            <option value="">Selecione uma transportadora...</option>
                            {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Código de Rastreio (Opcional)</Label>
                        <Input
                            placeholder="Ex: BR123456789XX"
                            value={entregaForm.codigo_rastreio}
                            onChange={e => setEntregaForm({ ...entregaForm, codigo_rastreio: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Endereço de Entrega</Label>
                        <Input
                            required
                            placeholder="Rua, Número, Bairro, Cidade..."
                            value={entregaForm.endereco_entrega}
                            onChange={e => setEntregaForm({ ...entregaForm, endereco_entrega: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Contato para Entrega (Telefone/Nome)</Label>
                        <Input
                            placeholder="Ex: (11) 99999-9999 - João"
                            value={entregaForm.contato_entrega}
                            onChange={e => setEntregaForm({ ...entregaForm, contato_entrega: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Status de Pagamento da Entrega</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setEntregaForm({ ...entregaForm, status_pagamento: 'Pago' })}
                                className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${entregaForm.status_pagamento === 'Pago'
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                                    : 'border-border text-muted-foreground hover:border-emerald-300'
                                    }`}
                            >
                                ✅ Frete Pago
                            </button>
                            <button
                                type="button"
                                onClick={() => setEntregaForm({ ...entregaForm, status_pagamento: 'A Receber' })}
                                className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${entregaForm.status_pagamento === 'A Receber'
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                                    : 'border-border text-muted-foreground hover:border-amber-300'
                                    }`}
                            >
                                ⏳ A Receber na Entrega
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => setIsEntregaModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Agendando..." : "Confirmar Entrega"}
                        </Button>
                    </div>
                </form>
            </Modal>
            <Modal
                isOpen={isFinalizeModalOpen}
                onClose={() => setIsFinalizeModalOpen(false)}
                title="Registrar Pagamento"
                className="max-w-md"
            >
                {(() => {
                    const venda = vendas.find(v => v.id === finalizeForm.venda_id);
                    if (!venda) return null;
                    const aberto = venda.total - (venda.total_pago || 0);

                    return (
                        <form onSubmit={handleFinalizeVenda} className="space-y-6">
                            <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Total do Pedido</span>
                                    <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground uppercase font-bold text-[10px]">Já Pago</span>
                                    <span className="font-bold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total_pago || 0)}</span>
                                </div>
                                <div className="flex justify-between text-base border-t pt-2">
                                    <span className="font-black uppercase text-[11px]">Saldo em Aberto</span>
                                    <span className="font-black text-amber-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aberto)}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Valor a Pagar Agora</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            required
                                            autoFocus
                                            className="pl-10 text-lg font-bold"
                                            value={finalizeForm.valor_pagar || ''}
                                            onChange={e => setFinalizeForm({ ...finalizeForm, valor_pagar: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground flex justify-center gap-2">
                                        <button type="button" onClick={() => setFinalizeForm({ ...finalizeForm, valor_pagar: aberto / 2 })} className="hover:text-primary underline">Pagar 50%</button>
                                        <button type="button" onClick={() => setFinalizeForm({ ...finalizeForm, valor_pagar: aberto })} className="hover:text-primary underline font-bold">Pagar Tudo</button>
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Forma de Pagamento</Label>
                                    <Select
                                        value={finalizeForm.forma_pagamento}
                                        onChange={e => setFinalizeForm({ ...finalizeForm, forma_pagamento: e.target.value })}
                                    >
                                        <option value="Dinheiro">Dinheiro (Entra no Caixa)</option>
                                        <option value="Pix">PIX</option>
                                        <option value="Cartão Crédito">Cartão de Crédito</option>
                                        <option value="Cartão Débito">Cartão de Débito</option>
                                        <option value="Boleto">Boleto Bancário</option>
                                        <option value="Haver Cliente">Haver Cliente (Usar Crédito)</option>
                                    </Select>
                                </div>

                                {['Boleto', 'Haver Cliente'].includes(finalizeForm.forma_pagamento) && (
                                    <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                                        <Label className="text-primary font-bold">
                                            {finalizeForm.forma_pagamento === 'Boleto' ? 'Vencimento' : 'Data da Baixa'}
                                        </Label>
                                        <Input
                                            type="date"
                                            required
                                            value={finalizeForm.data_vencimento}
                                            onChange={e => setFinalizeForm({ ...finalizeForm, data_vencimento: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => setIsFinalizeModalOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700">
                                    {submitting ? "Processando..." : "Confirmar Recebimento"}
                                </Button>
                            </div>
                        </form>
                    );
                })()}
            </Modal>

            {/* NOVO PRODUTO MODAL (Inside Vendas) */}
            <Modal isOpen={isNovoProdutoModalOpen} onClose={() => setIsNovoProdutoModalOpen(false)} title="Cadastrar Produto Rápido" className="max-w-md">
                <form onSubmit={handleCreateNovoProduto} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Nome do Produto</Label>
                            <Input required value={novoProdutoForm.nome} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, nome: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Preço de Venda</Label>
                            <Input type="number" step="0.01" required value={novoProdutoForm.preco || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, preco: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Custo</Label>
                            <Input type="number" step="0.01" value={novoProdutoForm.custo || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, custo: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Estoque Inicial</Label>
                            <Input type="number" required value={novoProdutoForm.estoque_atual || ''} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, estoque_atual: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                            <Label>SKU (Deixe vazio p/ Auto)</Label>
                            <Input value={novoProdutoForm.sku} onChange={e => setNovoProdutoForm({ ...novoProdutoForm, sku: e.target.value })} placeholder="Automático" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsNovoProdutoModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}> Salvar Produto </Button>
                    </div>
                </form>
            </Modal>

            {/* RECEIPT MODAL */}
            <Modal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                title="Imprimir Pedido de Venda"
                className="max-w-5xl"
            >
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        {/* Format Selector + Actions */}
                        <div className="flex items-center justify-between gap-4 pb-3 border-b flex-wrap gap-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-muted-foreground">Formato:</span>
                                {(['a4', 'a5', 'cupom'] as const).map(fmt => (
                                    <button
                                        key={fmt}
                                        type="button"
                                        onClick={() => setPrintFormat(fmt)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${printFormat === fmt
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border text-muted-foreground hover:border-primary/50'
                                            }`}
                                    >
                                        {fmt === 'a4' ? '🗂 A4 (Carta)' : fmt === 'a5' ? '📄 A5 (Meio ofício)' : '🧾 Cupom (80mm)'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsReceiptModalOpen(false)}>Fechar</Button>
                                <Button size="sm" className="bg-primary hover:bg-primary/90 gap-2" onClick={handlePrint}>
                                    <Printer className="w-4 h-4" />
                                    Imprimir {printFormat === 'a4' ? 'A4' : printFormat === 'a5' ? 'A5' : 'Cupom'}
                                </Button>
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div className="overflow-auto max-h-[70vh] flex justify-center bg-muted/30 p-4 rounded-lg">

                            {/* === A4 LAYOUT === */}
                            {printFormat === 'a4' && (
                                <div id="printable-receipt" className="bg-white text-black font-sans shadow-lg" style={{ width: '210mm', minHeight: '270mm', padding: '16mm 16mm 12mm' }}>
                                    <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                                        <div>
                                            <h1 className="text-2xl font-black uppercase tracking-tight">{company?.nome_fantasia || 'MINHA LOJA'}</h1>
                                            <p className="text-[9px] font-bold mt-0.5">{company?.razao_social}</p>
                                            <p className="text-[9px] mt-0.5">CNPJ: {company?.cnpj || '---'} | IE: {company?.inscricao_estadual || '---'}</p>
                                            <p className="text-[9px]">{company?.logradouro}, {company?.numero} | {company?.bairro} | {company?.cidade}/{company?.estado} | CEP: {company?.cep || '---'}</p>
                                            <p className="text-[9px]">{company?.telefone} {company?.email ? '| ' + company?.email : ''}</p>
                                        </div>
                                        <div className="text-right border-2 border-black px-4 py-2">
                                            <p className="text-[8px] uppercase font-bold border-b border-black mb-1">Pedido de Venda</p>
                                            <p className="text-lg font-black tracking-widest">#{selectedVendaForReceipt.id.substring(0, 8).toUpperCase()}</p>
                                            <p className="text-[8px] mt-1">{new Date(selectedVendaForReceipt.data_venda).toLocaleString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 mb-4">
                                        <div>
                                            <p className="text-[8px] font-black uppercase border-b border-black pb-0.5 mb-1">Cliente</p>
                                            <p className="text-[11px] font-bold">{selectedVendaForReceipt.clientes?.nome || 'Consumidor Final'}</p>
                                            <p className="text-[9px]">DOC: {selectedVendaForReceipt.clientes?.documento || '---'}</p>
                                            <p className="text-[9px]">End: {selectedVendaForReceipt.clientes?.endereco || '---'}</p>
                                            <p className="text-[9px]">Tel: {selectedVendaForReceipt.clientes?.telefone || '---'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black uppercase border-b border-black pb-0.5 mb-1">Vendedor / Pagamento</p>
                                            <p className="text-[11px] font-bold">{selectedVendaForReceipt.atendentes?.nome || '---'}</p>
                                            <p className="text-[9px] mt-1 font-bold">Forma de Pagamento</p>
                                            <p className="text-[10px]">{selectedVendaForReceipt.forma_pagamento || 'Dinheiro'}</p>
                                        </div>
                                    </div>
                                    {selectedVendaForReceipt.entrega && (
                                        <div className="border border-gray-300 p-2 rounded mb-4 text-[9px]">
                                            <p className="font-black uppercase mb-1">🚚 Entrega</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p>Transportadora: {selectedVendaForReceipt.entrega.transportadoras?.nome || '---'}</p>
                                                    <p>Endereço: {selectedVendaForReceipt.entrega.endereco_entrega || '---'}</p>
                                                </div>
                                                <div>
                                                    <p>Contato: {selectedVendaForReceipt.entrega.contato_entrega || '---'}</p>
                                                    <p>Rastreio: {selectedVendaForReceipt.entrega.codigo_rastreio || 'Em processamento'}</p>
                                                    {selectedVendaForReceipt.entrega.status_pagamento && <p className="font-bold">Frete: {selectedVendaForReceipt.entrega.status_pagamento}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <table className="w-full border-collapse mb-4 text-[9px]">
                                        <thead>
                                            <tr className="border-y-2 border-black font-black uppercase">
                                                <th className="py-1.5 text-left">SKU</th>
                                                <th className="py-1.5 text-left">Produto / Descrição</th>
                                                <th className="py-1.5 text-center">Qtd</th>
                                                <th className="py-1.5 text-right">Unitário</th>
                                                <th className="py-1.5 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedVendaForReceipt.itens.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-gray-200">
                                                    <td className="py-1 font-mono">{item.produtos?.sku}</td>
                                                    <td className="py-1">{item.produtos?.nome}</td>
                                                    <td className="py-1 text-center">{item.quantidade}</td>
                                                    <td className="py-1 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}</td>
                                                    <td className="py-1 text-right font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="flex justify-end">
                                        <div className="border-t-2 border-black pt-2 min-w-[220px] text-right">
                                            <p className="text-base font-black">TOTAL: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[7px] text-gray-400 italic mt-6 pt-2 border-t border-gray-200">{company?.mensagem_rodape || 'Documento interno — sem validade fiscal como NF-e.'} | Emitido em: {new Date().toLocaleString('pt-BR')}</p>
                                </div>
                            )}

                            {/* === A5 LAYOUT === */}
                            {printFormat === 'a5' && (
                                <div id="printable-receipt" className="bg-white text-black font-sans shadow-lg" style={{ width: '148mm', minHeight: '200mm', padding: '10mm 12mm 8mm' }}>
                                    <div className="border-b-2 border-black pb-2 mb-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h1 className="text-base font-black uppercase tracking-tight">{company?.nome_fantasia || 'MINHA LOJA'}</h1>
                                                <p className="text-[8px]">{company?.razao_social}</p>
                                                <p className="text-[8px]">{company?.logradouro}, {company?.numero} | {company?.cidade}/{company?.estado}</p>
                                                <p className="text-[8px]">{company?.telefone}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[7px] uppercase font-bold">Pedido</p>
                                                <p className="text-sm font-black">#{selectedVendaForReceipt.id.substring(0, 8).toUpperCase()}</p>
                                                <p className="text-[7px]">{new Date(selectedVendaForReceipt.data_venda).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3 text-[8px]">
                                        <div>
                                            <p className="font-black uppercase border-b border-black pb-0.5 mb-1">Cliente</p>
                                            <p className="font-bold">{selectedVendaForReceipt.clientes?.nome || 'Consumidor Final'}</p>
                                            <p>{selectedVendaForReceipt.clientes?.telefone || '---'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black uppercase border-b border-black pb-0.5 mb-1">Vendedor</p>
                                            <p className="font-bold">{selectedVendaForReceipt.atendentes?.nome || '---'}</p>
                                            <p>{selectedVendaForReceipt.forma_pagamento || 'Dinheiro'}</p>
                                        </div>
                                    </div>
                                    {selectedVendaForReceipt.entrega && (
                                        <div className="border border-gray-300 p-1.5 rounded mb-3 text-[7px]">
                                            <p className="font-black mb-0.5">ENTREGA: {selectedVendaForReceipt.entrega.endereco_entrega || '---'} | Frete: {selectedVendaForReceipt.entrega.status_pagamento || '---'}</p>
                                        </div>
                                    )}
                                    <table className="w-full border-collapse mb-3 text-[8px]">
                                        <thead>
                                            <tr className="border-y-2 border-black font-black">
                                                <th className="py-1 text-left">Item</th>
                                                <th className="py-1 text-center w-8">Qtd</th>
                                                <th className="py-1 text-right">Unit.</th>
                                                <th className="py-1 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedVendaForReceipt.itens.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-gray-200">
                                                    <td className="py-0.5">{item.produtos?.nome}</td>
                                                    <td className="py-0.5 text-center">{item.quantidade}</td>
                                                    <td className="py-0.5 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}</td>
                                                    <td className="py-0.5 text-right font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="flex justify-end">
                                        <div className="border-t-2 border-black pt-1 min-w-[160px] text-right">
                                            <p className="text-sm font-black">TOTAL: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[6px] text-gray-400 italic mt-4 pt-1 border-t border-gray-200">{company?.mensagem_rodape || 'Documento interno.'} | {new Date().toLocaleString('pt-BR')}</p>
                                </div>
                            )}

                            {/* === CUPOM 80mm LAYOUT === */}
                            {printFormat === 'cupom' && (
                                <div id="printable-receipt" className="bg-white text-black font-mono shadow-lg" style={{ width: '80mm', padding: '4mm 4mm' }}>
                                    <div className="text-center border-b-2 border-black pb-2 mb-2">
                                        <p className="text-[13px] font-black uppercase">{company?.nome_fantasia || 'MINHA LOJA'}</p>
                                        <p className="text-[8px]">{company?.logradouro}, {company?.numero}</p>
                                        <p className="text-[8px]">{company?.cidade}/{company?.estado}</p>
                                        <p className="text-[8px]">{company?.telefone}</p>
                                    </div>
                                    <div className="text-center mb-2">
                                        <p className="text-[8px] font-bold">PEDIDO #{selectedVendaForReceipt.id.substring(0, 8).toUpperCase()}</p>
                                        <p className="text-[8px]">{new Date(selectedVendaForReceipt.data_venda).toLocaleString('pt-BR')}</p>
                                        <p className="text-[8px]">{selectedVendaForReceipt.clientes?.nome || 'Consumidor Final'}</p>
                                    </div>
                                    <div className="border-t border-dashed border-black my-1" />
                                    {selectedVendaForReceipt.itens.map((item: any, idx: number) => (
                                        <div key={idx} className="mb-1 text-[8px]">
                                            <div className="flex justify-between">
                                                <span className="font-bold flex-1 pr-1 leading-tight">{item.produtos?.nome}</span>
                                                <span className="font-bold shrink-0">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}</span>
                                            </div>
                                            <div className="text-[7px] text-gray-600">{item.quantidade} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}</div>
                                        </div>
                                    ))}
                                    <div className="border-t border-dashed border-black my-1" />
                                    <div className="flex justify-between text-[10px] font-black">
                                        <span>TOTAL</span>
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</span>
                                    </div>
                                    <div className="flex justify-between text-[8px] mt-0.5">
                                        <span>Pagamento</span>
                                        <span>{selectedVendaForReceipt.forma_pagamento || 'Dinheiro'}</span>
                                    </div>
                                    {selectedVendaForReceipt.atendentes?.nome && (
                                        <div className="flex justify-between text-[8px]">
                                            <span>Atendente</span>
                                            <span>{selectedVendaForReceipt.atendentes.nome}</span>
                                        </div>
                                    )}
                                    {selectedVendaForReceipt.entrega && (
                                        <div className="mt-1 pt-1 border-t border-dashed border-black text-[7px]">
                                            <p className="font-bold">ENTREGA: {selectedVendaForReceipt.entrega.endereco_entrega || '---'}</p>
                                            {selectedVendaForReceipt.entrega.status_pagamento && <p>Frete: {selectedVendaForReceipt.entrega.status_pagamento}</p>}
                                        </div>
                                    )}
                                    <div className="border-t border-dashed border-black mt-2 pt-1 text-center">
                                        <p className="text-[7px]">{company?.mensagem_rodape || 'Obrigado pela preferência!'}</p>
                                        <p className="text-[6px] text-gray-500">{new Date().toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

