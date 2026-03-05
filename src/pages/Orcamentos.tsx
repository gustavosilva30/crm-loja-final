import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, MoreHorizontal, FileText, User, Trash2, Pencil, ShoppingCart, CheckCircle2, UserPlus, PackagePlus, Printer, Package, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

interface Orcamento {
  id: string
  numero_pedido?: number
  cliente_id: string | null
  vendedor_id: string | null
  total: number
  data_inicio: string | null
  validade: string | null
  condicao_pagamento: string | null
  status: string
  clientes?: { nome: string }
  atendentes?: { nome: string }
  orcamentos_itens?: { produtos: { nome: string } }[]
}

interface ItemOrcamento {
  produto_id: string
  quantidade: number
  preco_unitario: number
}

export function Orcamentos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const formatNumPedido = (num?: number) => num ? String(num) : '------'
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createdOrcamentoId, setCreatedOrcamentoId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [printAfterSave, setPrintAfterSave] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [selectedOrcamentoForReceipt, setSelectedOrcamentoForReceipt] = useState<any>(null)
  const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom' | 'cupom58'>('a4')
  const [company, setCompany] = useState<any>(null)


  // Resources for Form
  const [clientes, setClientes] = useState<{ id: string, nome: string }[]>([])
  const [produtos, setProdutos] = useState<{ id: string, nome: string, preco: number, preco_prazo?: number }[]>([])

  // Form State
  const [formData, setFormData] = useState({
    cliente_id: '',
    vendedor_id: '',
    condicao_pagamento: 'À Vista',
    validade: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Aberto'
  })
  const [items, setItems] = useState<ItemOrcamento[]>([])

  // Quick Registration Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [newClient, setNewClient] = useState({
    nome: '',
    documento: '',
    telefone: '',
    email: ''
  })
  const [newProduct, setNewProduct] = useState({
    sku: '',
    nome: '',
    preco: 0,
    custo: 0,
    estoque_atual: 0
  })

  const fetchOrcamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*, clientes!cliente_id ( nome ), atendentes ( nome ), orcamentos_itens ( produtos ( nome ) )')
        .order('created_at', { ascending: false })

      setOrcamentos(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const [atendentes, setAtendentes] = useState<{ id: string, nome: string }[]>([])

  const fetchResources = async () => {
    const { data: clients } = await supabase.from('clientes').select('id, nome')
    const { data: products } = await supabase.from('produtos').select('id, nome, preco, preco_prazo')
    const { data: staff } = await supabase.from('atendentes').select('id, nome')
    if (clients) setClientes(clients)
    if (products) setProdutos(products)
    if (staff) setAtendentes(staff)
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data, error } = await supabase.from('clientes').insert([newClient]).select().single()
      if (error) throw error
      await fetchResources()
      setFormData({ ...formData, cliente_id: data.id })
      setIsClientModalOpen(false)
      setNewClient({ nome: '', documento: '', telefone: '', email: '' })
    } catch (err: any) {
      alert('Erro ao cadastrar cliente: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data, error } = await supabase.from('produtos').insert([newProduct]).select().single()
      if (error) throw error
      await fetchResources()
      setIsProductModalOpen(false)
      setNewProduct({ sku: '', nome: '', preco: 0, custo: 0, estoque_atual: 0 })
    } catch (err: any) {
      alert('Erro ao cadastrar produto: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchOrcamentos()
    fetchResources()

    const savedCart = localStorage.getItem('crm_orcamento_items')
    if (savedCart) {
      try {
        const parsedItems = JSON.parse(savedCart)
        if (parsedItems.length > 0) {
          setItems(parsedItems)
          setIsModalOpen(true)
          localStorage.removeItem('crm_orcamento_items')
        }
      } catch (e) { }
    }
    supabase.from('configuracoes_empresa').select('*').maybeSingle().then(({ data }) => setCompany(data))
  }, [])

  const handleOpenReceipt = async (orcId: string) => {
    setLoading(true)
    try {
      const { data: orc } = await supabase.from('orcamentos').select(`*, clientes!cliente_id(*), atendentes:vendedor_id(nome)`).eq('id', orcId).single()
      const { data: itens } = await supabase.from('orcamentos_itens').select(`*, produtos(nome, sku)`).eq('orcamento_id', orcId)
      setSelectedOrcamentoForReceipt({ ...orc, itens: itens || [] })
      setIsReceiptModalOpen(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([...items, { produto_id: '', quantidade: 1, preco_unitario: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ItemOrcamento, value: string | number) => {
    const newItems = [...items]
    const item = { ...newItems[index] }

    if (field === 'produto_id') {
      item.produto_id = value as string
      const prod = produtos.find(p => p.id === value)
      if (prod) item.preco_unitario = prod.preco
    } else {
      (item as any)[field] = value
    }

    newItems[index] = item
    setItems(newItems)
  }

  const calculateTotal = () => items.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0)

  const handleCreateOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return alert('Adicione pelo menos um item')

    setSubmitting(true)
    try {
      const total = calculateTotal()

      if (createdOrcamentoId) {
        // Edit Mode
        const { error: updErr } = await supabase.from('orcamentos').update({
          cliente_id: formData.cliente_id || null,
          vendedor_id: formData.vendedor_id || null,
          condicao_pagamento: formData.condicao_pagamento,
          validade: formData.validade,
          status: formData.status,
          total: total
        }).eq('id', createdOrcamentoId);

        if (updErr) {
          // Fallback update without new columns
          const { error: updErr2 } = await supabase.from('orcamentos').update({
            cliente_id: formData.cliente_id || null,
            validade: formData.validade,
            status: formData.status,
            total: total
          }).eq('id', createdOrcamentoId);
          if (updErr2) throw updErr2;
        }

        await supabase.from('orcamentos_itens').delete().eq('orcamento_id', createdOrcamentoId);
        const itemsToInsert = items.map(item => ({
          orcamento_id: createdOrcamentoId,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.quantidade * item.preco_unitario
        }));
        await supabase.from('orcamentos_itens').insert(itemsToInsert);

        setIsModalOpen(false);
        setCreatedOrcamentoId(null);
        fetchOrcamentos();
        return;
      }

      // 1. Insert Quote
      let orcData: any = null
      let orcError: any = null
      const payload: any = {
        cliente_id: formData.cliente_id || null,
        vendedor_id: formData.vendedor_id || null,
        condicao_pagamento: formData.condicao_pagamento,
        validade: formData.validade,
        status: formData.status,
        total: total,
        data_inicio: new Date().toISOString()
      }

      const { data: d1, error: e1 } = await supabase
        .from('orcamentos')
        .insert([payload])
        .select()
        .single()

      if (e1) {
        // Fallback without new columns
        const { data: orcData2, error: orcError2 } = await supabase
          .from('orcamentos')
          .insert([{
            cliente_id: formData.cliente_id || null,
            validade: formData.validade,
            status: formData.status,
            total: total
          }])
          .select()
          .single()

        if (orcError2) throw orcError2
        orcData = orcData2
      } else {
        orcData = d1
      }

      // 2. Insert Items
      const itemsToInsert = items.map(item => ({
        orcamento_id: orcData.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.quantidade * item.preco_unitario
      }))

      const { error: itemsError } = await supabase
        .from('orcamentos_itens')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      setIsModalOpen(false)
      setCreatedOrcamentoId(null)
      setItems([])
      setFormData({
        cliente_id: '',
        vendedor_id: '',
        condicao_pagamento: 'À Vista',
        validade: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Aberto'
      })
      fetchOrcamentos()
      if (printAfterSave) {
        handleOpenReceipt(orcData.id)
        setPrintAfterSave(false)
      }
    } catch (err) {
      console.error('Error creating quote:', err)
      alert('Erro ao criar orçamento')
      setPrintAfterSave(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOrcamento = async (orc: Orcamento) => {
    setCreatedOrcamentoId(orc.id);
    const { data: itens } = await supabase.from('orcamentos_itens').select('*').eq('orcamento_id', orc.id);

    setFormData({
      cliente_id: orc.cliente_id || '',
      vendedor_id: orc.vendedor_id || '',
      condicao_pagamento: orc.condicao_pagamento || 'À Vista',
      validade: orc.validade ? orc.validade.split('T')[0] : '',
      status: orc.status
    });

    if (itens) {
      setItems(itens.map(i => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario
      })));
    } else {
      setItems([]);
    }

    setIsModalOpen(true);
  }

  const handleDeleteOrcamento = async (id: string) => {
    if (!confirm('Deseja realmente cancelar/excluir este orçamento? O estoque reservado voltará a ficar disponível.')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
      fetchOrcamentos();
    } catch (e: any) {
      alert('Erro ao excluir: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleConvertOrcamento = async (orc: Orcamento) => {
    if (!confirm('Converter este orçamento em Venda?')) return;
    setSubmitting(true);
    try {
      const { data: itens } = await supabase.from('orcamentos_itens').select('*, produtos(nome, sku)').eq('orcamento_id', orc.id);
      if (!itens) throw new Error('Itens não encontrados');

      const cartItems = itens.map(i => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        // @ts-ignore
        nome: i.produtos?.nome || '',
        // @ts-ignore
        sku: i.produtos?.sku || ''
      }));

      const payload = {
        items: cartItems,
        cliente_id: orc.cliente_id,
        atendente_id: orc.vendedor_id,
        autoOpenCheckout: true
      };

      localStorage.setItem('crm_venda_cart', JSON.stringify(payload));

      // Mark as Aprovado
      await supabase.from('orcamentos').update({ status: 'Aprovado' }).eq('id', orc.id);

      navigate('/vendas');
    } catch (e: any) {
      alert('Erro ao converter: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredOrcamentos = orcamentos.filter(o =>
    String(o.numero_pedido || '').includes(searchTerm) ||
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orcamentos_itens?.some(i => i.produtos?.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-foreground mt-1">Gerencie propostas comerciais e converta em vendas.</p>
        </div>
        <Button className="gap-2" onClick={() => {
          const savedCart = localStorage.getItem('crm_orcamento_items')
          if (savedCart) {
            try {
              const parsedItems = JSON.parse(savedCart)
              if (parsedItems.length > 0) {
                setItems(parsedItems)
                localStorage.removeItem('crm_orcamento_items')
              }
            } catch (e) { setItems([]) }
          } else {
            setItems([])
          }
          setCreatedOrcamentoId(null)
          setFormData({
            cliente_id: '',
            vendedor_id: '',
            condicao_pagamento: 'À Vista',
            validade: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Aberto'
          })
          setIsModalOpen(true)
        }}>
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ID..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Carregando orçamentos...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Período (Início/Fim)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrcamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum orçamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : filteredOrcamentos.map((orcamento) => (
                  <TableRow key={orcamento.id}>
                    <TableCell className="font-extrabold text-indigo-700 text-sm">
                      #{formatNumPedido(orcamento.numero_pedido)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[320px]">
                        {orcamento.orcamentos_itens?.map((item: any, idx: number) => (
                          <div key={idx} className="text-[13px] font-bold text-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            {item.produtos?.nome}
                          </div>
                        ))}
                        {(!orcamento.orcamentos_itens || orcamento.orcamentos_itens.length === 0) && <span className="text-[10px] text-muted-foreground italic">Sem itens</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {orcamento.clientes?.nome || "Consumidor Final"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs italic text-foreground">
                      {orcamento.atendentes?.nome || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {orcamento.condicao_pagamento || 'À Vista'}
                    </TableCell>
                    <TableCell className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.total)}
                    </TableCell>
                    <TableCell className="text-[10px] leading-tight">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">De: {orcamento.data_inicio ? new Date(orcamento.data_inicio).toLocaleDateString('pt-BR') : new Date(orcamento.id).toLocaleDateString('pt-BR')}</span>
                        <span className="font-medium text-destructive">Até: {orcamento.validade ? new Date(orcamento.validade).toLocaleDateString('pt-BR') : "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          orcamento.status === 'Aprovado' ? 'default' :
                            orcamento.status === 'Aberto' ? 'outline' : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {orcamento.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Imprimir" onClick={() => handleOpenReceipt(orcamento.id)}>
                          <Printer className="w-4 h-4 text-primary" />
                        </Button>
                        {orcamento.status !== 'Aprovado' && (
                          <Button variant="ghost" size="icon" title="Converter em Venda (Aprovar)" onClick={() => handleConvertOrcamento(orcamento)}>
                            <ShoppingCart className="w-4 h-4 text-emerald-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEditOrcamento(orcamento)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDeleteOrcamento(orcamento.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* NEW QUOTE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={createdOrcamentoId ? "Editar Orçamento" : "Gerar Novo Orçamento"}
        className="max-w-2xl"
      >
        <form onSubmit={handleCreateOrcamento} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cliente</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsClientModalOpen(true)} className="h-4 p-0 text-[10px] text-primary hover:underline gap-1">
                  <UserPlus className="w-3 h-3" /> + Novo Cliente
                </Button>
              </div>
              <Select
                value={formData.cliente_id}
                onChange={e => setFormData({ ...formData, cliente_id: e.target.value })}
              >
                <option value="">Selecione um cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor Responsável</Label>
              <Select
                value={formData.vendedor_id}
                onChange={e => setFormData({ ...formData, vendedor_id: e.target.value })}
              >
                <option value="">Selecionar vendedor...</option>
                {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Select
                value={formData.condicao_pagamento}
                onChange={e => {
                  const newCond = e.target.value;
                  setFormData({ ...formData, condicao_pagamento: newCond });
                  // Update all item prices based on new condition
                  setItems(items.map(item => {
                    const p = produtos.find(pp => pp.id === item.produto_id);
                    if (p) {
                      const newPrice = newCond === 'A Prazo' && p.preco_prazo && p.preco_prazo > 0 ? p.preco_prazo : p.preco;
                      return { ...item, preco_unitario: newPrice };
                    }
                    return item;
                  }));
                }}
              >
                <option value="À Vista">À Vista</option>
                <option value="A Prazo">A Prazo</option>
              </Select>
            </div>
            <div className="space-y-2 invisible">
              {/* Spacer */}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" /> Itens do Orçamento
              </h3>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsProductModalOpen(true)} className="h-8 text-[10px] text-primary gap-1">
                  <PackagePlus className="w-3 h-3" /> + Novo Produto
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1">
                  <Plus className="w-3 h-3" /> Adicionar Item
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_120px_40px] gap-3 items-end p-3 border border-border rounded-lg bg-muted/20">
                  <div className="space-y-2">
                    <Label className="text-[10px]">Produto</Label>
                    <Select
                      value={item.produto_id}
                      onChange={e => {
                        const pid = e.target.value;
                        const p = produtos.find(pp => pp.id === pid);
                        const price = p ? (formData.condicao_pagamento === 'A Prazo' && p.preco_prazo && p.preco_prazo > 0 ? p.preco_prazo : p.preco) : 0;
                        updateItem(index, 'produto_id', pid);
                        updateItem(index, 'preco_unitario', price);
                      }}
                    >
                      <option value="">Buscar produto...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px]">Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={e => updateItem(index, 'quantidade', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px]">Preço Un.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.preco_unitario}
                      onChange={e => updateItem(index, 'preco_unitario', parseFloat(e.target.value))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-10 w-10 shrink-0"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-border mt-4">
            <div className="text-sm text-foreground font-medium">
              Total do Orçamento: <span className="text-xl font-bold text-foreground ml-2">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}
              </span>
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="outline" onClick={() => setPrintAfterSave(true)} className="gap-2 border-primary text-primary hover:bg-primary hover:text-white">
                <Printer className="w-4 h-4" /> Salvar e Imprimir
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* QUICK CLIENT MODAL */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
        className="max-w-md"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input required value={newClient.nome} onChange={e => setNewClient({ ...newClient, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input value={newClient.documento} onChange={e => setNewClient({ ...newClient, documento: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={newClient.telefone} onChange={e => setNewClient({ ...newClient, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsClientModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>Cadastrar</Button>
          </div>
        </form>
      </Modal>

      {/* QUICK PRODUCT MODAL */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Cadastrar Novo Produto"
        className="max-w-md"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input required value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estoque Inicial</Label>
              <Input type="number" value={newProduct.estoque_atual} onChange={e => setNewProduct({ ...newProduct, estoque_atual: parseInt(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do Produto</Label>
            <Input required value={newProduct.nome} onChange={e => setNewProduct({ ...newProduct, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço Venda</Label>
              <Input type="number" step="0.01" required value={newProduct.preco} onChange={e => setNewProduct({ ...newProduct, preco: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Custo</Label>
              <Input type="number" step="0.01" required value={newProduct.custo} onChange={e => setNewProduct({ ...newProduct, custo: parseFloat(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>Cadastrar</Button>
          </div>
        </form>
      </Modal>
      {/* MODAL IMPRESSÃO ORÇAMENTO */}
      <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Impressão de Orçamento" className="max-w-4xl">
        {selectedOrcamentoForReceipt && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg no-print">
              <div className="flex gap-2">
                {(['a4', 'a5', 'cupom', 'cupom58'] as const).map(f => (
                  <Button
                    key={f}
                    variant={printFormat === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrintFormat(f)}
                    className="h-8 capitalize"
                  >
                    {f === 'cupom' ? 'Cupom 80mm' : f === 'cupom58' ? 'Cupom 58mm' : `Papel ${f.toUpperCase()}`}
                  </Button>
                ))}
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
                  margin: 0 auto;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                @media print {
                  @page { margin: 0; size: auto; }
                  body * { visibility: hidden !important; }
                  .print-preview-container, .print-preview-container * { visibility: visible !important; }
                  .print-preview-container { 
                    position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; z-index: 99999 !important;
                  }
                  .no-print { display: none !important; }
                }
                .a4 { width: 210mm; min-height: 297mm; padding: 15mm; font-size: 11pt; --base-font: 11pt; }
                .a5 { width: 148mm; min-height: 210mm; padding: 8mm; font-size: 9pt; --base-font: 9pt; }
                .cupom { width: 80mm; padding: 4mm; font-size: 10pt; --base-font: 10pt; font-family: 'Courier Prime', monospace; }
                .cupom58 { width: 58mm; padding: 2mm; font-size: 8pt; --base-font: 8pt; font-family: 'Courier Prime', monospace; }
                .formal-header { border: 1px solid #000; padding: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
                .formal-table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                .formal-table th { text-align: left; font-size: calc(var(--base-font) * 0.85); border-bottom: 2px solid #000; padding: 5px 2px; }
                .formal-table td { padding: 6px 2px; font-size: var(--base-font); border-bottom: 1px dotted #ccc; }
                .formal-section { border-top: 2px solid #000; margin-top: 15px; padding-top: 5px; }
                .formal-label { font-size: calc(var(--base-font) * 0.75); font-weight: bold; text-transform: uppercase; }
              `}</style>

              <div className={`print-preview-container ${printFormat} text-black`}>
                {printFormat.includes('cupom') ? (
                  <div className="ticket-content">
                    <div className="text-center mb-4">
                      <p className="font-bold text-lg">{company?.nome_fantasia || 'LOJA'}</p>
                      <p className="text-[10px]">CNPJ: {company?.cnpj || '00.000.000/0000-00'}</p>
                      <p className="text-[10px]">{company?.logradouro}, {company?.numero}</p>
                      <p className="text-[10px] TEL:">{company?.telefone || '(00) 0000-0000'}</p>
                    </div>
                    <div className="border-y-2 border-black py-1 font-bold text-center uppercase my-2">ORÇAMENTO Nº {formatNumPedido(selectedOrcamentoForReceipt.numero_pedido)}</div>
                    <div className="text-[11px] space-y-1 mb-2">
                      <p>Data: {new Date(selectedOrcamentoForReceipt.data_inicio || selectedOrcamentoForReceipt.created_at).toLocaleDateString()}</p>
                      <p className="font-bold text-destructive">Validade: {new Date(selectedOrcamentoForReceipt.validade).toLocaleDateString()}</p>
                      <p>Cliente: {selectedOrcamentoForReceipt.clientes?.nome || 'CONSUMIDOR'}</p>
                      <p>Vendedor: {selectedOrcamentoForReceipt.atendentes?.nome || 'N/A'}</p>
                    </div>
                    <div className="border-b border-black text-center font-bold text-[10px] mb-1">PRODUTOS</div>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="text-left">Item</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrcamentoForReceipt.itens?.map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-1">{i.produtos?.nome}</td>
                            <td className="text-right">{i.quantidade}</td>
                            <td className="text-right">{i.subtotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t-2 border-black mt-2 pt-1 flex justify-between font-bold text-lg">
                      <span>TOTAL:</span>
                      <span>R$ {selectedOrcamentoForReceipt.total.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 text-[10px] text-center italic">
                      <p>Válido por 10 dias a partir da data de emissão.</p>
                      <p>Este documento não é nota fiscal.</p>
                    </div>
                  </div>
                ) : (
                  <div className="formal-content">
                    <div className="formal-header">
                      <div className="flex items-center gap-3">
                        <Package className="w-10 h-10" />
                        <div>
                          <p className="font-black text-xl leading-none">{company?.nome_fantasia || 'SUA EMPRESA'}</p>
                          <p className="text-[10px] italic">Orçamento de Venda</p>
                        </div>
                      </div>
                      <div className="text-right text-[10px]">
                        <p className="text-lg font-black italic">ORÇAMENTO #{formatNumPedido(selectedOrcamentoForReceipt.numero_pedido)}</p>
                        <p>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border border-black p-3 text-[11px] mb-4">
                      <div>
                        <p className="formal-label">Dados do Cliente</p>
                        <p className="font-bold text-sm">{selectedOrcamentoForReceipt.clientes?.nome || 'CONSUMIDOR FINAL'}</p>
                        <p>CPF/CNPJ: {selectedOrcamentoForReceipt.clientes?.documento || '---'}</p>
                        <p>Tel: {selectedOrcamentoForReceipt.clientes?.telefone || '---'}</p>
                      </div>
                      <div className="text-right">
                        <p className="formal-label">Informações</p>
                        <p>Data Emissão: {new Date(selectedOrcamentoForReceipt.data_inicio || selectedOrcamentoForReceipt.created_at).toLocaleDateString('pt-BR')}</p>
                        <p className="text-destructive font-bold">Vencimento: {new Date(selectedOrcamentoForReceipt.validade).toLocaleDateString('pt-BR')}</p>
                        <p>Vendedor: {selectedOrcamentoForReceipt.atendentes?.nome || 'N/A'}</p>
                      </div>
                    </div>

                    <table className="formal-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50%' }}>Item / Descrição</th>
                          <th style={{ width: '15%' }}>SKU</th>
                          <th style={{ width: '10%' }} className="text-center">Qtd</th>
                          <th style={{ width: '10%' }} className="text-right">Unit</th>
                          <th style={{ width: '15%' }} className="text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrcamentoForReceipt.itens?.map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td>{i.produtos?.nome}</td>
                            <td className="font-mono text-[9px]">{i.produtos?.sku}</td>
                            <td className="text-center">{i.quantidade}</td>
                            <td className="text-right">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.preco_unitario)}</td>
                            <td className="text-right font-bold">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end mt-6">
                      <div className="w-64 border-t-2 border-black pt-2 space-y-1 text-right">
                        <div className="flex justify-between text-base font-black">
                          <span>TOTAL:</span>
                          <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOrcamentoForReceipt.total)}</span>
                        </div>
                        <p className="text-[10px] italic mt-4">Condição de Pagamento: {selectedOrcamentoForReceipt.condicao_pagamento || 'À Vista'}</p>
                        <p className="text-[10px] text-destructive font-bold uppercase mt-4 text-center border-2 border-destructive p-1">Este orçamento é válido por 10 dias.</p>
                      </div>
                    </div>

                    <div className="mt-20 text-center border-t border-black pt-2 w-1/2 mx-auto">
                      <p className="text-[10px] uppercase font-bold">{company?.nome_fantasia}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div >
  )
}
