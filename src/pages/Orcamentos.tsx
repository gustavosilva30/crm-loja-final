import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, MoreHorizontal, FileText, User, Trash2, Pencil, ShoppingCart, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

interface Orcamento {
  id: string
  cliente_id: string | null
  total: number
  validade: string | null
  status: string
  clientes?: { nome: string }
}

interface ItemOrcamento {
  produto_id: string
  quantidade: number
  preco_unitario: number
}

export function Orcamentos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createdOrcamentoId, setCreatedOrcamentoId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  // Resources for Form
  const [clientes, setClientes] = useState<{ id: string, nome: string }[]>([])
  const [produtos, setProdutos] = useState<{ id: string, nome: string, preco: number }[]>([])

  // Form State
  const [formData, setFormData] = useState({
    cliente_id: '',
    validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Aberto'
  })
  const [items, setItems] = useState<ItemOrcamento[]>([])

  const fetchOrcamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*, clientes ( nome )')
        .gt('validade', new Date().toISOString()) // Only future/today
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrcamentos(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchResources = async () => {
    const { data: clients } = await supabase.from('clientes').select('id, nome')
    const { data: products } = await supabase.from('produtos').select('id, nome, preco')
    if (clients) setClientes(clients)
    if (products) setProdutos(products)
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
      const { data: orcData, error: orcError } = await supabase
        .from('orcamentos')
        .insert([{
          cliente_id: formData.cliente_id || null,
          validade: formData.validade,
          status: formData.status,
          total: total
        }])
        .select()
        .single()

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
        validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
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
            validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Validade</TableHead>
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
                    <TableCell className="font-mono text-xs italic">#{orcamento.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {orcamento.clientes?.nome || "Consumidor Final"}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.total)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {orcamento.validade ? new Date(orcamento.validade).toLocaleDateString('pt-BR') : "-"}
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
              <Label>Cliente</Label>
              <Select
                value={formData.cliente_id}
                onChange={e => setFormData({ ...formData, cliente_id: e.target.value })}
              >
                <option value="">Selecione um cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input
                type="date"
                value={formData.validade}
                onChange={e => setFormData({ ...formData, validade: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" /> Itens do Orçamento
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1">
                <Plus className="w-3 h-3" /> Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_120px_40px] gap-3 items-end p-3 border border-border rounded-lg bg-muted/20">
                  <div className="space-y-2">
                    <Label className="text-[10px]">Produto</Label>
                    <Select
                      value={item.produto_id}
                      onChange={e => updateItem(index, 'produto_id', e.target.value)}
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
    </div>
  )
}
