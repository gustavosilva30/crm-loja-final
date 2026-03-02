import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, LayoutGrid, List, Package, Trash2, Pencil, ShoppingCart, FileText, Camera, Upload, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Produto {
  id: string
  sku: string
  sku_ml: string | null
  nome: string
  descricao: string | null
  estoque_atual: number
  estoque_minimo: number
  custo: number
  preco: number
  preco_prazo?: number
  categoria_id: string | null
  imagem_url: string | null
  status?: string
  quantidade_orcamento?: number
  compatibilidade?: string | null
}

export function Produtos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isCompatModalOpen, setIsCompatModalOpen] = useState(false)
  const [selectedCompat, setSelectedCompat] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Resources
  const [categorias, setCategorias] = useState<{ id: string, nome: string }[]>([])

  // Form State
  const [newProduto, setNewProduto] = useState({
    sku: '',
    nome: '',
    descricao: '',
    estoque_atual: 0,
    estoque_minimo: 5,
    custo: 0,
    preco: 0,
    preco_prazo: 0,
    categoria_id: '',
    imagem_url: '',
    compatibilidade: ''
  })

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome')

      if (error) throw error
      setProdutos(data || [])
    } catch (err) {
      console.error('Error fetching produtos:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategorias = async () => {
    const { data } = await supabase.from('categorias').select('id, nome')
    if (data) setCategorias(data)
  }

  useEffect(() => {
    fetchProdutos()
    fetchCategorias()
  }, [])

  const handleAddProduto = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let finalImageUrl = newProduto.imagem_url

      // 1. Upload imagem se houver arquivo selecionado
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `product-images/${fileName}`

        const { error: uploadError, data } = await supabase.storage
          .from('produtos')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('produtos')
          .getPublicUrl(filePath)

        finalImageUrl = publicUrl
      }

      if (editingProduto) {
        const { error } = await supabase
          .from('produtos')
          .update({
            ...newProduto,
            imagem_url: finalImageUrl,
            categoria_id: newProduto.categoria_id || null
          })
          .eq('id', editingProduto.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('produtos')
          .insert([{
            ...newProduto,
            imagem_url: finalImageUrl,
            categoria_id: newProduto.categoria_id || null
          }])
        if (error) throw error
      }

      setNewProduto({
        sku: '',
        nome: '',
        descricao: '',
        estoque_atual: 0,
        estoque_minimo: 5,
        custo: 0,
        preco: 0,
        preco_prazo: 0,
        categoria_id: '',
        imagem_url: '',
        compatibilidade: ''
      })
      setSelectedFile(null)
      setImagePreview(null)
      fetchProdutos()
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error adding product:', err)
      alert('Erro ao salvar produto. Verifique se o SKU está em uso.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este produto?")) return
    const { error } = await supabase.from('produtos').delete().eq('id', id)
    if (error) alert("Erro ao excluir produto. Verifique se ele possui vendas vinculadas.")
    else fetchProdutos()
  }

  const startEdit = (produto: Produto) => {
    setEditingProduto(produto)
    setNewProduto({
      sku: produto.sku,
      nome: produto.nome,
      descricao: produto.descricao || '',
      estoque_atual: produto.estoque_atual,
      estoque_minimo: produto.estoque_minimo,
      custo: produto.custo,
      preco: produto.preco,
      preco_prazo: produto.preco_prazo || 0,
      categoria_id: produto.categoria_id || '',
      imagem_url: produto.imagem_url || '',
      compatibilidade: produto.compatibilidade || ''
    })
    setImagePreview(produto.imagem_url || null)
    setSelectedFile(null)
    setIsModalOpen(true)
  }

  const filteredProdutos = produtos.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddToCart = (produto: Produto, tipo: 'venda' | 'orcamento') => {
    const key = tipo === 'venda' ? 'crm_venda_cart' : 'crm_orcamento_items';
    const saved = localStorage.getItem(key);
    const cart = saved ? JSON.parse(saved) : [];

    const existingIndex = cart.findIndex((item: any) => item.produto_id === produto.id);
    if (existingIndex > -1) {
      cart[existingIndex].quantidade += 1;
    } else {
      cart.push({
        produto_id: produto.id,
        quantidade: 1,
        preco_unitario: produto.preco,
        nome: produto.nome,
        sku: produto.sku
      });
    }

    localStorage.setItem(key, JSON.stringify(cart));
    alert(`Produto adicionado ao ${tipo === 'venda' ? 'Carrinho de Vendas' : 'Orçamento'}!`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque & Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu catálogo e sincronização com Mercado Livre.</p>
        </div>
        <Button className="gap-2" onClick={() => {
          setEditingProduto(null)
          let nextSkuNum = 1;
          const numericSkus = produtos.map(p => parseInt(p.sku, 10)).filter(n => !isNaN(n));
          if (numericSkus.length > 0) {
            nextSkuNum = Math.max(...numericSkus) + 1;
          }
          setNewProduto({
            sku: nextSkuNum.toString(),
            nome: '',
            descricao: '',
            estoque_atual: 0,
            estoque_minimo: 5,
            custo: 0,
            preco: 0,
            preco_prazo: 0,
            categoria_id: '',
            imagem_url: '',
            compatibilidade: ''
          })
          setImagePreview(null)
          setSelectedFile(null)
          setIsModalOpen(true)
        }}>
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, nome..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-input rounded-md p-1 bg-background">
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-sm" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
                <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-sm" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
              </div>
              <Button variant="outline" className="gap-2"><Filter className="w-4 h-4" /> Filtros</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando produtos...</div>
          ) : viewMode === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Integração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProdutos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                ) : filteredProdutos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-mono text-xs">{produto.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-muted-foreground/40" />}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {produto.nome}
                            {produto.quantidade_orcamento && produto.quantidade_orcamento > 0 && (
                              <Badge variant="outline" className="text-[9px] h-4 border-blue-500 text-blue-500 bg-blue-500/10 px-1">{produto.quantidade_orcamento} em orç.</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[9px] px-2 text-primary hover:text-primary hover:bg-primary/10 mt-1 border border-primary/20"
                            onClick={() => {
                              setSelectedCompat(produto.compatibilidade || "Nenhuma compatibilidade cadastrada")
                              setIsCompatModalOpen(true)
                            }}
                          >
                            Mostrar Compatibilidades
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={produto.estoque_atual <= produto.estoque_minimo ? "text-destructive font-bold" : ""}>{produto.estoque_atual} un</span>
                    </TableCell>
                    <TableCell className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco)}</TableCell>
                    <TableCell>{produto.sku_ml ? <Badge variant="ml" className="text-[10px]">Sincronizado</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    <TableCell>
                      <Badge variant={produto.estoque_atual > produto.estoque_minimo ? 'default' : produto.estoque_atual > 0 ? 'secondary' : 'destructive'}>
                        {produto.estoque_atual > produto.estoque_minimo ? 'Ativo' : produto.estoque_atual > 0 ? 'Baixo Estoque' : 'Sem Estoque'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Enviar para Orçamento" onClick={() => handleAddToCart(produto, 'orcamento')}><FileText className="w-4 h-4 text-blue-500" /></Button>
                        <Button variant="ghost" size="icon" title="Enviar para Carrinho (Venda)" onClick={() => handleAddToCart(produto, 'venda')}><ShoppingCart className="w-4 h-4 text-emerald-500" /></Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => startEdit(produto)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                        <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(produto.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProdutos.map((produto) => (
                <Card key={produto.id} className="overflow-hidden border-border/50 hover:border-primary/50 transition-colors shadow-sm">
                  <div className="h-40 bg-muted/30 flex items-center justify-center border-b border-border/10 relative overflow-hidden">
                    {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" /> : <Package className="w-12 h-12 text-muted-foreground/20" />}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {produto.sku_ml && <Badge variant="ml" className="text-[10px] shadow-sm">ML</Badge>}
                      {produto.quantidade_orcamento && produto.quantidade_orcamento > 0 && (
                        <Badge variant="outline" className="text-[10px] shadow-sm border-blue-500 text-blue-500 bg-blue-500/10 backdrop-blur-sm">{produto.quantidade_orcamento} em Orçamento</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded-full truncate">{produto.sku}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Estoque</span>
                        <span className={`text-sm font-black ${produto.estoque_atual <= produto.estoque_minimo ? "text-destructive" : "text-emerald-500"}`}>{produto.estoque_atual} un</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-sm line-clamp-2 mb-1 h-10 tracking-tight">{produto.nome}</h3>
                    <Button variant="outline" size="sm" className="w-full text-[10px] h-7 mb-3 border-primary/20 text-primary hover:bg-primary/5" onClick={() => { setSelectedCompat(produto.compatibilidade || "Nenhuma compatibilidade cadastrada"); setIsCompatModalOpen(true); }}>Mostrar Compatibilidades</Button>
                    <div className="flex items-center justify-between mb-3"><span className="font-black text-lg text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco)}</span></div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/10">
                      <div className="flex gap-2">
                        <button onClick={() => handleAddToCart(produto, 'orcamento')} title="Enviar para Orçamento" className="p-1.5 text-blue-500 hover:text-white transition-colors hover:bg-blue-500 rounded"><FileText className="w-4 h-4" /></button>
                        <button onClick={() => handleAddToCart(produto, 'venda')} title="Enviar para Carrinho (Venda)" className="p-1.5 text-emerald-500 hover:text-white transition-colors hover:bg-emerald-500 rounded"><ShoppingCart className="w-4 h-4" /></button>
                        <button onClick={() => startEdit(produto)} title="Editar" className="p-1.5 text-muted-foreground hover:text-primary transition-colors hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(produto.id)} title="Excluir" className="p-1.5 text-muted-foreground hover:text-destructive transition-colors hover:bg-muted rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <Badge variant={produto.estoque_atual > produto.estoque_minimo ? 'default' : produto.estoque_atual > 0 ? 'secondary' : 'destructive'} className="text-[10px]">{produto.estoque_atual > 0 ? "Em linha" : "Esgotado"}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduto ? "Editar Produto" : "Cadastrar Novo Produto"} className="max-w-2xl">
        <form onSubmit={handleAddProduto} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU / Código do Produto</Label>
              <Input required placeholder="Ex: PROD-123" value={newProduto.sku} onChange={e => setNewProduto({ ...newProduto, sku: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newProduto.categoria_id} onChange={e => setNewProduto({ ...newProduto, categoria_id: e.target.value })}>
                <option value="">Selecione categoria...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do Produto</Label>
            <Input required placeholder="Ex: Teclado Mecânico RGB..." value={newProduto.nome} onChange={e => setNewProduto({ ...newProduto, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input placeholder="Detalhes do produto..." value={newProduto.descricao} onChange={e => setNewProduto({ ...newProduto, descricao: e.target.value })} />
          </div>
          <div className="space-y-4">
            <Label>Foto do Produto (PC ou Celular)</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center overflow-hidden group">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null)
                        setSelectedFile(null)
                        setNewProduto(prev => ({ ...prev, imagem_url: '' }))
                      }}
                      className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <Camera className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 w-full justify-start"
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {imagePreview ? "Trocar Foto" : "Selecionar Foto / Abrir Câmera"}
                </Button>
                <input
                  id="product-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setSelectedFile(file)
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        setImagePreview(reader.result as string)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground">Suporta JPG, PNG. O arquivo será enviado para o servidor ao salvar.</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Compatibilidade (Mercado Livre)</Label>
            <Input placeholder="Ex: Honda Civic 2012-2016, Corolla 2014..." value={newProduto.compatibilidade} onChange={e => setNewProduto({ ...newProduto, compatibilidade: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Preço à Vista (R$)</Label><Input required type="number" step="0.01" value={newProduto.preco} onChange={e => setNewProduto({ ...newProduto, preco: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} /></div>
            <div className="space-y-2"><Label>Preço a Prazo (R$)</Label><Input required type="number" step="0.01" value={newProduto.preco_prazo} onChange={e => setNewProduto({ ...newProduto, preco_prazo: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} /></div>
            <div className="space-y-2"><Label>Custo Unitário (R$)</Label><Input required type="number" step="0.01" value={newProduto.custo} onChange={e => setNewProduto({ ...newProduto, custo: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Estoque Inicial</Label><Input type="number" value={newProduto.estoque_atual} onChange={e => setNewProduto({ ...newProduto, estoque_atual: parseInt(e.target.value) })} onFocus={e => e.target.select()} /></div>
            <div className="space-y-2"><Label>Estoque Mínimo (Alerta)</Label><Input type="number" value={newProduto.estoque_minimo} onChange={e => setNewProduto({ ...newProduto, estoque_minimo: parseInt(e.target.value) })} onFocus={e => e.target.select()} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : (editingProduto ? "Salvar Alterações" : "Cadastrar Produto")}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCompatModalOpen} onClose={() => setIsCompatModalOpen(false)} title="Compatibilidades" className="max-w-md">
        <div className="p-4 space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 text-sm whitespace-pre-wrap">{selectedCompat || "Nenhuma compatibilidade cadastrada."}</div>
          <div className="flex justify-end font-medium"><Button onClick={() => setIsCompatModalOpen(false)}>Fechar</Button></div>
        </div>
      </Modal>
    </div>
  )
}
