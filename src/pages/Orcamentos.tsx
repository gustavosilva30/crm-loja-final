import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, MoreHorizontal, FileText, User, Trash2, Pencil, ShoppingCart, CheckCircle2, UserPlus, PackagePlus } from "lucide-react"
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
        .select('*, clientes ( nome ), atendentes ( nome ), orcamentos_itens ( produtos ( nome ) )')
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
  }, [])

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

        if (updErr) throw updErr;

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

      orcData = d1
      orcError = e1

      if (orcError) {
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
      }

      if (orcError) throw orcError

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
    } catch (err) {
      console.error('Error creating quote:', err)
      alert('Erro ao criar orçamento')
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

      localStorage.setItem('crm_venda_cart', JSON.stringify(cartItems));

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
          <p className="text-muted-foreground mt-1">Gerencie propostas comerciais e converta em vendas.</p>
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
                          <div key={idx} className="text-[13px] font-bold text-slate-700 flex items-center gap-1">
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
                    <TableCell className="text-xs italic text-muted-foreground">
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
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
            <div className="text-sm text-muted-foreground font-medium">
              Total do Orçamento: <span className="text-xl font-bold text-foreground ml-2">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}
              </span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Gerando..." : "Finalizar Orçamento"}
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
    </div>
  )
}
