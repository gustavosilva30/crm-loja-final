import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, LayoutGrid, List, Package, Trash2, Pencil, ShoppingCart, FileText, Camera, Upload, X, Shield, Activity, Box, Tag, Ruler, Truck, Info, Settings, Maximize2, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Car, ImagePlus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { ImageViewer } from "@/components/ImageViewer"

interface Produto {
  id: string
  sku: string
  meli_id: string | null
  nome: string
  descricao: string | null
  estoque_atual: number
  estoque_minimo: number
  custo: number
  preco: number
  preco_prazo?: number
  categoria_id: string | null
  imagem_url: string | null
  imagem_urls: string[]
  status?: string
  quantidade_orcamento?: number
  compatibilidade?: string | null
  // New Fields
  ativo: boolean
  imobilizado: boolean
  item_seguranca: boolean
  rastreavel: boolean
  codigo_etiqueta: string | null
  part_number: string | null
  localizacao: string | null
  localizacao_id: string | null
  marca: string | null
  modelo: string | null
  ano: number | null
  versao: string | null
  cst: string | null
  cfop: string | null
  adicional_venda_percentual: number
  unidade_medida: string
  ncm: string | null
  cest: string | null
  outros_custos: number
  qualidade: string | null
  origem: string | null
  codigo_barras: string | null
  peso_g: number
  altura_cm: number
  largura_cm: number
  comprimento_cm: number
  informacoes_adicionais: string | null
}

interface Compatibilidade {
  id?: string
  marca: string
  modelo: string
  ano: string
  versao: string
}

export function Produtos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isCompatModalOpen, setIsCompatModalOpen] = useState(false)
  const [selectedCompat, setSelectedCompat] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Image Viewer State
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [initialViewerIndex, setInitialViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [newCat, setNewCat] = useState({
    nome: '',
    largura_padrao: 0,
    altura_padrao: 0,
    comprimento_padrao: 0,
    peso_padrao: 0
  })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [productImageIndexes, setProductImageIndexes] = useState<Record<string, number>>({})
  const { atendente } = useAuthStore()

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12) // Default for grid
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // ─── Filtros ─────────────────────────────────────────────
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterEstoque, setFilterEstoque] = useState<'todos' | 'ok' | 'baixo' | 'zerado'>('todos')
  const [filterAtivo, setFilterAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [filterPrecoMin, setFilterPrecoMin] = useState('')
  const [filterPrecoMax, setFilterPrecoMax] = useState('')
  const [filterCustoMin, setFilterCustoMin] = useState('')
  const [filterCustoMax, setFilterCustoMax] = useState('')
  const [filterLocalizacao, setFilterLocalizacao] = useState('')
  const [filterMarca, setFilterMarca] = useState('')
  const [sortBy, setSortBy] = useState<'nome' | 'preco' | 'estoque_atual' | 'custo'>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Resources
  const [categorias, setCategorias] = useState<any[]>([])
  const [locais, setLocais] = useState<{ id: string, nome: string, sigla?: string, parent_id: string | null }[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [marcasStandard, setMarcasStandard] = useState<any[]>([])
  const [modelosStandard, setModelosStandard] = useState<any[]>([])

  // Form State
  const [newProduto, setNewProduto] = useState<any>({
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
    imagem_urls: [],
    compatibilidade: '',
    ativo: true,
    imobilizado: false,
    item_seguranca: false,
    rastreavel: false,
    codigo_etiqueta: '',
    part_number: '',
    localizacao: '',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    versao: '',
    cst: '',
    cfop: '',
    adicional_venda_percentual: 0,
    unidade_medida: 'UN',
    ncm: '',
    cest: '',
    outros_custos: 0,
    qualidade: 'A',
    origem: '',
    codigo_barras: '',
    peso_g: 0,
    altura_cm: 0,
    largura_cm: 0,
    comprimento_cm: 0,
    informacoes_adicionais: '',
    localizacao_id: '',
    meli_id: ''
  })

  // Catalog Autocomplete State
  const [catalogSuggestions, setCatalogSuggestions] = useState<any[]>([])
  const [showCatalogSuggestions, setShowCatalogSuggestions] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [selectedCatalogPeca, setSelectedCatalogPeca] = useState<any | null>(null)

  const searchCatalog = async (term: string) => {
    if (term.length < 2) {
      setCatalogSuggestions([])
      setShowCatalogSuggestions(false)
      return
    }

    const { data } = await supabase
      .from('pecas_catalogo')
      .select('*')
      .ilike('nome', `%${term}%`)
      .limit(5)

    if (data && data.length > 0) {
      setCatalogSuggestions(data)
      setShowCatalogSuggestions(true)
    } else {
      setCatalogSuggestions([])
      setShowCatalogSuggestions(false)
    }
  }

  const selectFromCatalog = async (peca: any) => {
    // Buscar dimensões da categoria se houver uma vinculada
    const cat = peca.categoria_id ? categorias.find(c => c.id === peca.categoria_id) : null;

    setNewProduto({
      ...newProduto,
      nome: peca.nome,
      marca: peca.marca_veiculo || newProduto.marca,
      modelo: peca.modelo_veiculo || newProduto.modelo,
      ano: peca.ano_inicio || newProduto.ano,
      preco: peca.preco_padrao || newProduto.preco,
      custo: peca.custo_padrao || newProduto.custo,
      categoria_id: peca.categoria_id || newProduto.categoria_id,
      part_number: peca.part_number || newProduto.part_number,
      descricao: peca.descricao || newProduto.descricao,
      imagem_url: peca.imagem_url || newProduto.imagem_url,
      estoque_atual: 1, // Automatizar para 1 na seleção do catálogo
      largura_cm: cat?.largura_padrao || newProduto.largura_cm,
      altura_cm: cat?.altura_padrao || newProduto.altura_cm,
      comprimento_cm: cat?.comprimento_padrao || newProduto.comprimento_cm,
      peso_g: cat?.peso_padrao ? (cat.peso_padrao * 1000) : newProduto.peso_g
    })

    if (peca.imagem_url) {
      if (!imagePreviews.includes(peca.imagem_url)) {
        setImagePreviews(prev => [peca.imagem_url, ...prev])
      }
    }
    setSelectedCatalogPeca(peca)

    // Fetch compatibilities from catalog
    const { data: compats } = await supabase
      .from('pecas_catalogo_compatibilidade')
      .select('marca, modelo, ano, versao')
      .eq('peca_id', peca.id)

    if (compats && compats.length > 0) {
      setCompatList(compats)
    }

    setShowCatalogSuggestions(false)
  }

  const [compatList, setCompatList] = useState<Compatibilidade[]>([])
  const [newCompat, setNewCompat] = useState<Compatibilidade>({ marca: '', modelo: '', ano: '', versao: '' })

  const fetchProdutos = async () => {
    setLoading(true)
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
    const { data } = await supabase.from('categorias').select('*').order('nome')
    if (data) setCategorias(data)
  }

  const fetchLocais = async () => {
    const { data } = await supabase.from('localizacoes').select('id, nome, sigla, parent_id').order('nome')
    if (data) setLocais(data)
  }

  const fetchCartCount = async () => {
    if (!atendente) return;
    const { count } = await supabase.from('carrinho_itens').select('*', { count: 'exact', head: true }).eq('atendente_id', atendente.id)
    setCartCount(count || 0)
  }

  const fetchMarcasStandard = async () => {
    const { data } = await supabase.from('veiculos_marcas').select('*').order('nome')
    if (data) setMarcasStandard(data)
  }

  const fetchModelosStandard = async () => {
    const { data } = await supabase.from('veiculos_modelos').select('*').order('nome')
    if (data) setModelosStandard(data)
  }

  useEffect(() => {
    fetchProdutos()
    fetchCategorias()
    fetchLocais()
    fetchCartCount()
    fetchMarcasStandard()
    fetchModelosStandard()
  }, [])

  useEffect(() => {
    // Reset to first page when changing view mode or search
    setCurrentPage(1)
    // Only set default pageSize if it was not manually changed or is invalid for the new mode
    if (viewMode === "grid" && ![12, 30, 90].includes(pageSize)) setPageSize(12)
    if (viewMode === "list" && ![30, 60].includes(pageSize)) setPageSize(30)
  }, [viewMode, searchTerm, filterCategoria, filterEstoque, filterAtivo, filterPrecoMin, filterPrecoMax, filterCustoMin, filterCustoMax, filterLocalizacao, filterMarca])

  const clearFilters = () => {
    setSearchTerm('')
    setFilterCategoria('')
    setFilterEstoque('todos')
    setFilterAtivo('todos')
    setFilterPrecoMin('')
    setFilterPrecoMax('')
    setFilterCustoMin('')
    setFilterCustoMax('')
    setFilterLocalizacao('')
    setFilterMarca('')
    setSortBy('nome')
    setSortDir('asc')
  }

  const activeFilterCount = [
    searchTerm,
    filterCategoria,
    filterEstoque !== 'todos' ? '1' : '',
    filterAtivo !== 'todos' ? '1' : '',
    filterPrecoMin, filterPrecoMax,
    filterCustoMin, filterCustoMax,
    filterLocalizacao, filterMarca,
  ].filter(Boolean).length

  // Marcas únicas disponíveis
  const marcasDisponiveis = useMemo(() => [...new Set(produtos.map(p => p.marca).filter(Boolean))].sort(), [produtos])

  useEffect(() => {
    if (!isModalOpen && !editingProduto) {
      setImagePreviews([])
      setSelectedFiles([])
    }
  }, [isModalOpen, editingProduto])

  const handleAddProduto = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const uploadedUrls: string[] = [...newProduto.imagem_urls]

      // 1. Upload imagens se houver arquivos selecionados
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `product-images/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('produtos')
            .upload(filePath, file)

          if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

          const { data: { publicUrl } } = supabase.storage
            .from('produtos')
            .getPublicUrl(filePath)

          uploadedUrls.push(publicUrl)
        }
      }

      const { localizacao, ...productData } = newProduto
      const finalImageUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : null

      // Clean up UUID fields to avoid "invalid input syntax for type uuid: ''"
      const sanitizedData = {
        ...productData,
        imagem_url: finalImageUrl,
        imagem_urls: uploadedUrls,
        categoria_id: productData.categoria_id || null,
        localizacao_id: productData.localizacao_id || null,
        meli_id: productData.meli_id || null,
        atendente_id: editingProduto ? productData.atendente_id : atendente?.id
      }

      const { data: savedProd, error: prodError } = editingProduto
        ? await supabase.from('produtos').update(sanitizedData).eq('id', editingProduto.id).select().single()
        : await supabase.from('produtos').insert([sanitizedData]).select().single()

      if (prodError) throw prodError

      // Salvar compatibilidades
      if (savedProd) {
        // Remove antigas se estiver editando
        if (editingProduto) {
          await supabase.from('produtos_compatibilidade').delete().eq('produto_id', savedProd.id)
        }

        if (compatList.length > 0) {
          const compatToSave = compatList.map(c => ({
            produto_id: savedProd.id,
            marca: c.marca,
            modelo: c.modelo,
            ano: c.ano,
            versao: c.versao
          }))
          await supabase.from('produtos_compatibilidade').insert(compatToSave)
        }
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
        compatibilidade: '',
        ativo: true,
        imobilizado: false,
        item_seguranca: false,
        rastreavel: false,
        codigo_etiqueta: '',
        part_number: '',
        localizacao: '',
        marca: '',
        modelo: '',
        ano: new Date().getFullYear(),
        versao: '',
        cst: '',
        cfop: '',
        adicional_venda_percentual: 0,
        unidade_medida: 'UN',
        ncm: '',
        cest: '',
        outros_custos: 0,
        qualidade: 'A',
        origem: '',
        codigo_barras: '',
        peso_g: 0,
        altura_cm: 0,
        largura_cm: 0,
        comprimento_cm: 0,
        informacoes_adicionais: ''
      })
      setSelectedFiles([])
      setImagePreviews([])
      setCompatList([])
      setSearchTerm('')
      fetchProdutos()
      setIsModalOpen(false)
      alert("Produto salvo com sucesso! Se ele não aparecer imediatamente, verifique se não há filtros ativos (Categoria, Estoque, etc.) ou se o SKU é novo. Lembre-se que novos produtos começam com estoque ZERO.")
    } catch (err: any) {
      console.error('Error adding product:', err)
      if (err.code === '23505') {
        alert('Erro ao salvar produto: O SKU digitado já está em uso em outro produto.')
      } else {
        alert(`Erro ao salvar produto: ${err.message || 'Verifique os dados e tente novamente.'}`)
      }
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

  const handleSaveCategory = async () => {
    if (!newCat.nome) return

    let error;
    if (editingCatId) {
      const { error: err } = await supabase.from('categorias').update(newCat).eq('id', editingCatId)
      error = err
    } else {
      const { error: err } = await supabase.from('categorias').insert([newCat])
      error = err
    }

    if (!error) {
      setNewCat({ nome: '', largura_padrao: 0, altura_padrao: 0, comprimento_padrao: 0, peso_padrao: 0 })
      setEditingCatId(null)
      fetchCategorias()
    } else {
      alert("Erro ao salvar categoria: " + error.message)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Deseja realmente excluir esta categoria?")) {
      const { error } = await supabase.from('categorias').delete().eq('id', id)
      if (!error) fetchCategorias()
      else alert("Erro ao excluir: " + error.message)
    }
  }

  const startEdit = async (produto: Produto) => {
    setEditingProduto(produto)
    setNewProduto({
      ...produto,
      categoria_id: produto.categoria_id || '',
      imagem_url: produto.imagem_url || '',
      compatibilidade: produto.compatibilidade || '',
      localizacao_id: (produto as any).localizacao_id || ''
    })

    // Fetch compatibilidades
    const { data } = await supabase.from('produtos_compatibilidade').select('*').eq('produto_id', produto.id)
    if (data) setCompatList(data)
    else setCompatList([])

    setImagePreviews(produto.imagem_urls || (produto.imagem_url ? [produto.imagem_url] : []))
    setSelectedFiles([])
    setIsModalOpen(true)
  }

  const removeImage = (index: number) => {
    // Se for uma imagem já salva
    const currentUrls = [...newProduto.imagem_urls]
    if (index < currentUrls.length) {
      const removed = currentUrls.splice(index, 1)
      setNewProduto({ ...newProduto, imagem_urls: currentUrls })
      setImagePreviews(prev => prev.filter((_, i) => i !== index))
    } else {
      // Se for uma imagem nova (ainda não salva)
      const fileIndex = index - currentUrls.length
      setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex))
      setImagePreviews(prev => prev.filter((_, i) => i !== index))
    }
  }

  const filteredProdutos = useMemo(() => {
    let result = produtos.filter(p => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !searchTerm ||
        p.nome.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.marca || '').toLowerCase().includes(term) ||
        (p.part_number || '').toLowerCase().includes(term) ||
        (p.codigo_barras || '').includes(searchTerm)

      const matchCat = !filterCategoria || p.categoria_id === filterCategoria

      const matchEst =
        filterEstoque === 'todos' ||
        (filterEstoque === 'zerado' && p.estoque_atual <= 0) ||
        (filterEstoque === 'baixo' && p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo) ||
        (filterEstoque === 'ok' && p.estoque_atual > p.estoque_minimo)

      const matchAtivo =
        filterAtivo === 'todos' ||
        (filterAtivo === 'ativo' && p.ativo !== false) ||
        (filterAtivo === 'inativo' && p.ativo === false)

      const matchPrecoMin = !filterPrecoMin || p.preco >= parseFloat(filterPrecoMin)
      const matchPrecoMax = !filterPrecoMax || p.preco <= parseFloat(filterPrecoMax)
      const matchCustoMin = !filterCustoMin || p.custo >= parseFloat(filterCustoMin)
      const matchCustoMax = !filterCustoMax || p.custo <= parseFloat(filterCustoMax)

      const matchLoc = !filterLocalizacao || p.localizacao_id === filterLocalizacao ||
        (p.localizacao || '').toLowerCase().includes(filterLocalizacao.toLowerCase())

      const matchMarca = !filterMarca || (p.marca || '').toLowerCase() === filterMarca.toLowerCase()

      return matchSearch && matchCat && matchEst && matchAtivo && matchPrecoMin && matchPrecoMax && matchCustoMin && matchCustoMax && matchLoc && matchMarca
    })

    // Ordenação
    result.sort((a, b) => {
      const va = (a as any)[sortBy] ?? ''
      const vb = (b as any)[sortBy] ?? ''
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [produtos, searchTerm, filterCategoria, filterEstoque, filterAtivo, filterPrecoMin, filterPrecoMax, filterCustoMin, filterCustoMax, filterLocalizacao, filterMarca, sortBy, sortDir])

  const paginatedProdutos = filteredProdutos.slice(0, currentPage * pageSize)
  const hasMore = paginatedProdutos.length < filteredProdutos.length

  const handleAddToCart = async (produto: Produto, tipo: 'venda' | 'orcamento') => {
    if (tipo === 'orcamento') {
      const saved = localStorage.getItem('crm_orcamento_items');
      const cart = saved ? JSON.parse(saved) : [];
      const existingIndex = cart.findIndex((item: any) => item.produto_id === produto.id);
      if (existingIndex > -1) cart[existingIndex].quantidade += 1;
      else cart.push({ produto_id: produto.id, quantidade: 1, preco_unitario: produto.preco, nome: produto.nome, sku: produto.sku });
      localStorage.setItem('crm_orcamento_items', JSON.stringify(cart));
      alert(`Produto adicionado ao Orçamento!`);
      return;
    }

    // Lógica de Carrinho de Vendas (Banco de Dados + Trigger de Estoque)
    if (!atendente) return alert("Você precisa estar logado para usar o carrinho.");
    if (produto.estoque_atual <= 0) return alert("Produto sem estoque disponível!");

    try {
      const { error } = await supabase.from('carrinho_itens').upsert({
        atendente_id: atendente.id,
        produto_id: produto.id,
        preco_unitario: produto.preco,
        quantidade: 1 // No banco a trigger cuida de subtrair 1 do estoque
      }, { onConflict: 'atendente_id,produto_id' })

      if (error) {
        // Se for erro de PK (já existe), tentamos incrementar a quantidade
        // Mas como o usuário quer que clique e baixe, vamos fazer insert simples ou incrementar via rpc/update
        const { data: existing } = await supabase.from('carrinho_itens').select('quantidade').eq('atendente_id', atendente.id).eq('produto_id', produto.id).single();
        if (existing) {
          await supabase.from('carrinho_itens').update({ quantidade: existing.quantidade + 1 }).eq('atendente_id', atendente.id).eq('produto_id', produto.id);
        }
      }

      fetchProdutos(); // Atualiza estoque na tela
      alert('Produto adicionado ao carrinho! O estoque foi reservado.');
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar ao carrinho.');
    }
  }

  const handleBulkAddToCart = async (tipo: 'venda' | 'orcamento') => {
    if (selectedIds.length === 0) return;
    if (tipo === 'venda' && !atendente) return alert("Faça login para usar o carrinho.");

    setLoading(true);
    let successCount = 0;

    for (const id of selectedIds) {
      const produto = produtos.find(p => p.id === id);
      if (!produto || (tipo === 'venda' && produto.estoque_atual <= 0)) continue;

      if (tipo === 'orcamento') {
        const saved = localStorage.getItem('crm_orcamento_items');
        const cart = saved ? JSON.parse(saved) : [];
        const existingIndex = cart.findIndex((item: any) => item.produto_id === id);
        if (existingIndex > -1) cart[existingIndex].quantidade += 1;
        else cart.push({ produto_id: id, quantidade: 1, preco_unitario: produto.preco, nome: produto.nome, sku: produto.sku });
        localStorage.setItem('crm_orcamento_items', JSON.stringify(cart));
        successCount++;
      } else {
        try {
          const { data: existing } = await supabase.from('carrinho_itens').select('quantidade').eq('atendente_id', atendente?.id).eq('produto_id', id).single();
          if (existing) {
            await supabase.from('carrinho_itens').update({ quantidade: existing.quantidade + 1 }).eq('atendente_id', atendente?.id).eq('produto_id', id);
          } else {
            await supabase.from('carrinho_itens').insert({
              atendente_id: atendente?.id,
              produto_id: id,
              preco_unitario: produto.preco,
              quantidade: 1
            });
          }
          successCount++;
        } catch (e) { console.error(e); }
      }
    }

    setSelectedIds([]);
    await fetchProdutos();
    await fetchCartCount();
    setLoading(false);
    alert(`${successCount} produtos adicionados ao ${tipo === 'venda' ? 'carrinho' : 'orçamento'}!`);
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !confirm(`Deseja realmente excluir ${selectedIds.length} produtos?`)) return;
    setLoading(true);
    const { error } = await supabase.from('produtos').delete().in('id', selectedIds);
    if (error) alert("Erro ao excluir alguns produtos. Verifique se possuem vínculos.");
    else {
      setSelectedIds([]);
      await fetchProdutos();
    }
    setLoading(false);
  }

  const handlePrintLabels = async () => {
    const selectedProducts = produtos.filter(p => selectedIds.includes(p.id));
    if (selectedProducts.length === 0) return;

    // Generate QR codes as base64 for each product SKU
    const QRCode = (await import('qrcode')).default;
    const labelsHtml = await Promise.all(
      selectedProducts.map(async (p) => {
        const loc = locais.find(l => l.id === p.localizacao_id);
        let locSigla = 'N/A';

        if (loc) {
          if (loc.parent_id) {
            const parent = locais.find(l => l.id === loc.parent_id);
            locSigla = `${parent?.sigla || ''} > ${loc.sigla || ''}`;
          } else {
            locSigla = loc.sigla || loc.nome;
          }
        } else if (p.localizacao) {
          locSigla = p.localizacao;
        }

        // Generate the QR code for the SKU as a data URL (offline, no CDN needed)
        const qrDataUrl = await QRCode.toDataURL(p.sku, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });

        return `
          <div class="label">
            <div class="left">
              <div class="sku">${p.sku}</div>
              <div class="name">${p.nome}</div>
              <div class="location">&#128205; ${locSigla}</div>
              ${p.part_number ? `<div class="part">PN: ${p.part_number}</div>` : ''}
            </div>
            <div class="right">
              <img src="${qrDataUrl}" class="qr" alt="QR ${p.sku}" />
              <div class="qr-label">ESCANEIE</div>
            </div>
          </div>
        `;
      })
    );

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas — ${selectedProducts.length} produto(s)</title>
          <style>
            @page {
              size: 100mm 50mm;
              margin: 0;
            }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
              background: #fff;
            }
            .label {
              width: 100mm;
              height: 50mm;
              padding: 4mm 4mm 3mm 4mm;
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 3mm;
              border: 1px dashed #aaa;
              page-break-after: always;
              overflow: hidden;
            }
            .left {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 1mm;
              overflow: hidden;
            }
            .right {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              gap: 1mm;
            }
            .sku {
              font-size: 18pt;
              font-weight: 900;
              letter-spacing: -0.5px;
              color: #000;
              line-height: 1;
            }
            .name {
              font-size: 9pt;
              color: #222;
              line-height: 1.2;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .location {
              font-size: 9pt;
              font-weight: bold;
              color: #000;
              border-top: 1px solid #ccc;
              padding-top: 1.5mm;
              margin-top: 0.5mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .part {
              font-size: 7.5pt;
              color: #555;
              font-family: monospace;
            }
            .qr {
              width: 30mm;
              height: 30mm;
              display: block;
              border: 1px solid #ddd;
              border-radius: 2px;
            }
            .qr-label {
              font-size: 6pt;
              color: #888;
              text-align: center;
              letter-spacing: 0.5px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${labelsHtml.join('')}
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque & Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu catálogo e sincronização com Mercado Livre.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="relative cursor-pointer" onClick={() => window.location.href = '/vendas?cart=true'} title="Ir para o Carrinho">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-in zoom-in">
                {cartCount}
              </span>
            )}
          </Button>
          <Button className="gap-2" onClick={() => {
            setEditingProduto(null)

            // Buscar maior SKU numérico para sugestão (Fallback se o banco não for chamado via RPC)
            const numericSkus = produtos.map(p => parseInt(p.sku, 10)).filter(n => !isNaN(n));
            let nextSkuNum = 25010;
            if (numericSkus.length > 0) {
              const maxSku = Math.max(...numericSkus);
              nextSkuNum = maxSku >= 25010 ? maxSku + 1 : 25010;
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
              imagem_urls: [],
              compatibilidade: '',
              ativo: true,
              imobilizado: false,
              item_seguranca: false,
              rastreavel: false,
              meli_id: '',
              marca: '',
              modelo: '',
              ano: new Date().getFullYear(),
              versao: '',
              adicional_venda_percentual: 0,
              ncm: '',
              cest: '',
              cfop: '',
              cst: '',
              unidade_medida: 'UN',
              outros_custos: 0,
              qualidade: 'A',
              origem: '',
              codigo_barras: '',
              peso_g: 0,
              altura_cm: 0,
              largura_cm: 0,
              comprimento_cm: 0,
              informacoes_adicionais: ''
            })
            setCompatList([])
            setImagePreviews([])
            setSelectedFiles([])
            setIsModalOpen(true)
          }}>
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, nome, Part Number, código de barras..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
                <span className="text-xs font-bold text-primary">{selectedIds.length} selecionados</span>
                <div className="h-4 w-px bg-primary/20 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={handlePrintLabels}><Tag className="w-3.5 h-3.5" /> Etiquetas</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleBulkAddToCart('orcamento')}><FileText className="w-3.5 h-3.5" /> Orçamento</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleBulkAddToCart('venda')}><ShoppingCart className="w-3.5 h-3.5" /> Carrinho</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-2 text-destructive hover:bg-destructive/10" onClick={handleBulkDelete}><Trash2 className="w-3.5 h-3.5" /> Excluir</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds([])}>Cancelar</Button>
              </div>
            )}

            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={`${sortBy}:${sortDir}`}
              onChange={e => {
                const [col, dir] = e.target.value.split(':')
                setSortBy(col as any)
                setSortDir(dir as any)
              }}
            >
              <option value="nome:asc">Nome A→Z</option>
              <option value="nome:desc">Nome Z→A</option>
              <option value="preco:asc">Menor Preço</option>
              <option value="preco:desc">Maior Preço</option>
              <option value="estoque_atual:asc">Menor Estoque</option>
              <option value="estoque_atual:desc">Maior Estoque</option>
              <option value="custo:desc">Maior Custo</option>
            </select>

            <Select value={pageSize.toString()} onChange={(e) => setPageSize(parseInt(e.target.value))}>
              {viewMode === "grid" ? (
                <>
                  <option value="12">12 por vez</option>
                  <option value="30">30 por vez</option>
                  <option value="90">90 por vez</option>
                </>
              ) : (
                <>
                  <option value="30">30 por vez</option>
                  <option value="60">60 por vez</option>
                </>
              )}
            </Select>

            <div className="flex items-center border border-input rounded-md p-1 bg-background">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-sm" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-sm" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            </div>

            <Button
              variant={isFilterOpen ? "secondary" : "outline"}
              className="gap-2 relative"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="w-4 h-4" /> Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>

          {isFilterOpen && (
            <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border animate-in fade-in slide-in-from-top-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoria</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Status Estoque</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterEstoque} onChange={e => setFilterEstoque(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="ok">✅ Normal</option>
                  <option value="baixo">⚠️ Baixo</option>
                  <option value="zerado">🔴 Zerado</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Status Produto</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterAtivo} onChange={e => setFilterAtivo(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="ativo">✅ Ativos</option>
                  <option value="inativo">❌ Inativos</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Marca</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterMarca} onChange={e => setFilterMarca(e.target.value)}>
                  <option value="">Todas</option>
                  {marcasDisponiveis.map(m => <option key={m} value={m!}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Localização</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterLocalizacao} onChange={e => setFilterLocalizacao(e.target.value)}>
                  <option value="">Todas</option>
                  {locais.map(l => <option key={l.id} value={l.id}>{l.sigla || l.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Preço min (R$)</label>
                <input type="number" min="0" step="0.01" placeholder="0,00" value={filterPrecoMin} onChange={e => setFilterPrecoMin(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Preço max (R$)</label>
                <input type="number" min="0" step="0.01" placeholder="∞" value={filterPrecoMax} onChange={e => setFilterPrecoMax(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Custo min (R$)</label>
                <input type="number" min="0" step="0.01" placeholder="0,00" value={filterCustoMin} onChange={e => setFilterCustoMin(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Custo max (R$)</label>
                <input type="number" min="0" step="0.01" placeholder="∞" value={filterCustoMax} onChange={e => setFilterCustoMax(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="flex items-end">
                <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 w-full text-center">
                  <span className="font-bold text-primary text-base">{filteredProdutos.length}</span>
                  <span className="block">produto(s)</span>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando produtos...</div>
          ) : viewMode === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(paginatedProdutos.map(p => p.id))
                        else setSelectedIds([])
                      }}
                      checked={selectedIds.length === paginatedProdutos.length && paginatedProdutos.length > 0}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>MELI ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProdutos.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                ) : paginatedProdutos.map((produto) => (
                  <TableRow key={produto.id} className={selectedIds.includes(produto.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(produto.id)}
                        onChange={() => {
                          setSelectedIds(prev => prev.includes(produto.id) ? prev.filter(id => id !== produto.id) : [...prev, produto.id])
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{produto.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded border bg-muted overflow-hidden flex items-center justify-center shrink-0 cursor-zoom-in group/img relative"
                          onClick={() => {
                            const imgs = produto.imagem_urls && produto.imagem_urls.length > 0 ? produto.imagem_urls : (produto.imagem_url ? [produto.imagem_url] : [])
                            if (imgs.length > 0) {
                              setSelectedImages(imgs)
                              setInitialViewerIndex(0)
                              setIsViewerOpen(true)
                            }
                          }}
                        >
                          {produto.imagem_url ? (
                            <>
                              <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-contain transition-transform group-hover/img:scale-110" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : <Package className="w-5 h-5 text-muted-foreground/40" />}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {produto.nome}
                            {(produto.quantidade_orcamento !== undefined && produto.quantidade_orcamento > 0) && (
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
                    <TableCell>{produto.meli_id ? <Badge variant="secondary" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/20">{produto.meli_id}</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
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
              {paginatedProdutos.map((produto) => (
                <Card key={produto.id} className={`overflow-hidden border-border/50 hover:border-primary/50 transition-colors shadow-sm relative ${selectedIds.includes(produto.id) ? "ring-2 ring-primary border-primary/50" : ""}`}>
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={selectedIds.includes(produto.id)}
                      onChange={() => {
                        setSelectedIds(prev => prev.includes(produto.id) ? prev.filter(id => id !== produto.id) : [...prev, produto.id])
                      }}
                    />
                  </div>
                  <div
                    className="h-40 bg-muted/30 flex items-center justify-center border-b border-border/10 relative overflow-hidden cursor-zoom-in group/img"
                    onClick={() => {
                      const imgs = produto.imagem_urls && produto.imagem_urls.length > 0 ? produto.imagem_urls : (produto.imagem_url ? [produto.imagem_url] : [])
                      if (imgs.length > 0) {
                        setSelectedImages(imgs)
                        setInitialViewerIndex(productImageIndexes[produto.id] || 0)
                        setIsViewerOpen(true)
                      }
                    }}
                  >
                    {(() => {
                      const imgs = produto.imagem_urls && produto.imagem_urls.length > 0 ? produto.imagem_urls : (produto.imagem_url ? [produto.imagem_url] : [])
                      const currentIndex = productImageIndexes[produto.id] || 0
                      const currentImg = imgs[currentIndex]

                      if (!currentImg) return <Package className="w-12 h-12 text-muted-foreground/20" />

                      return (
                        <>
                          <img src={currentImg} alt={produto.nome} className="w-full h-full object-contain transition-transform group-hover/img:scale-105 duration-500" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                              <Maximize2 className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          {imgs.length > 1 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setProductImageIndexes(prev => ({ ...prev, [produto.id]: (currentIndex - 1 + imgs.length) % imgs.length }))
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 hover:bg-black/50 text-white rounded-full transition-opacity opacity-0 group-hover/img:opacity-100"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setProductImageIndexes(prev => ({ ...prev, [produto.id]: (currentIndex + 1) % imgs.length }))
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/30 hover:bg-black/50 text-white rounded-full transition-opacity opacity-0 group-hover/img:opacity-100"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {imgs.map((_, i) => (
                                  <div key={i} className={`w-1 h-1 rounded-full ${i === currentIndex ? "bg-white scale-125" : "bg-white/40"}`} />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )
                    })()}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                      {!!produto.meli_id && <Badge variant="secondary" className="text-[10px] shadow-sm bg-yellow-500/20 text-yellow-700 border-yellow-500/20">MELI</Badge>}
                      {!!(produto.quantidade_orcamento && produto.quantidade_orcamento > 0) && (
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
                    <Button variant="outline" size="sm" className="w-full text-[10px] h-7 mb-3 border-primary/30 text-foreground hover:bg-primary/10" onClick={() => { setSelectedCompat(produto.compatibilidade || "Nenhuma compatibilidade cadastrada"); setIsCompatModalOpen(true); }}>Mostrar Compatibilidades</Button>
                    <div className="flex items-center justify-between mb-3"><span className="font-black text-lg text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco)}</span></div>
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

          {hasMore && (
            <div className="flex justify-center mt-8 pb-4">
              <Button
                variant="outline"
                className="gap-2 px-12 h-10 border-primary/30 text-primary hover:bg-primary/10 font-bold"
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Ver Mais Produtos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduto ? "Editar Produto" : "Cadastrar Novo Produto"} className="max-w-2xl">
        <form onSubmit={handleAddProduto} className="space-y-6">
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="geral" className="gap-2"><Settings className="w-4 h-4" /> Geral</TabsTrigger>
              <TabsTrigger value="fiscal" className="gap-2"><FileText className="w-4 h-4" /> Fiscal</TabsTrigger>
              <TabsTrigger value="logistica" className="gap-2"><Truck className="w-4 h-4" /> Logística</TabsTrigger>
              <TabsTrigger value="compat" className="gap-2"><Activity className="w-4 h-4" /> Compatibilidade</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ativo" checked={newProduto.ativo} onChange={e => setNewProduto({ ...newProduto, ativo: e.target.checked })} />
                  <Label htmlFor="ativo" className="text-xs cursor-pointer">Produto Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="imobilizado" checked={newProduto.imobilizado} onChange={e => setNewProduto({ ...newProduto, imobilizado: e.target.checked })} />
                  <Label htmlFor="imobilizado" className="text-xs cursor-pointer">Produto Imobilizado</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="seguranca" checked={newProduto.item_seguranca} onChange={e => setNewProduto({ ...newProduto, item_seguranca: e.target.checked })} />
                  <Label htmlFor="seguranca" className="text-xs cursor-pointer">Item de Segurança</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rastreavel" checked={newProduto.rastreavel} onChange={e => setNewProduto({ ...newProduto, rastreavel: e.target.checked })} />
                  <Label htmlFor="rastreavel" className="text-xs cursor-pointer">Item Rastreável</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-1 space-y-2">
                  <Label>SKU / Código</Label>
                  <Input required placeholder="Ex: 17700" value={newProduto.sku} onChange={e => setNewProduto({ ...newProduto, sku: e.target.value })} />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label>Part Number</Label>
                  <Input placeholder="Código do fabricante" value={newProduto.part_number} onChange={e => setNewProduto({ ...newProduto, part_number: e.target.value })} />
                </div>
                <div className="md:col-span-4 space-y-2 relative">
                  <Label>Título / Nome (Máx 60 car.)</Label>
                  <Input
                    required
                    maxLength={60}
                    placeholder="Ex: CABO PUXADOR CAPO UNO"
                    value={newProduto.nome}
                    onChange={e => {
                      setNewProduto({ ...newProduto, nome: e.target.value })
                      searchCatalog(e.target.value)
                    }}
                    onBlur={() => setTimeout(() => setShowCatalogSuggestions(false), 200)}
                  />
                  {showCatalogSuggestions && (
                    <div className="absolute z-50 w-full bg-card border border-border rounded-lg shadow-xl mt-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-2 border-b border-border bg-muted/50 text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Car className="w-3 h-3" /> Sugestões do Catálogo
                      </div>
                      {catalogSuggestions.map((peca) => (
                        <button
                          key={peca.id}
                          type="button"
                          className="w-full text-left p-3 hover:bg-primary/10 transition-colors border-b border-border last:border-0"
                          onClick={() => selectFromCatalog(peca)}
                        >
                          <div className="flex items-center gap-3">
                            {peca.imagem_url && (
                              <div className="relative group/img">
                                <img
                                  src={peca.imagem_url}
                                  alt={peca.nome}
                                  className="w-12 h-12 rounded-lg object-cover border border-border shadow-sm group-hover/img:scale-105 transition-transform"
                                />
                                <button
                                  type="button"
                                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedImage(peca.imagem_url);
                                  }}
                                >
                                  <Maximize2 className="w-4 h-4 text-white" />
                                </button>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-bold text-sm tracking-tight">{peca.nome}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                                <span className="bg-muted px-1.5 py-0.5 rounded-sm font-bold">{peca.marca_veiculo}</span>
                                <span className="text-primary font-black">R$ {peca.preco_padrao.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Categoria</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-[10px] text-primary hover:text-primary/80 gap-1 font-bold uppercase"
                      onClick={() => setIsCategoryModalOpen(true)}
                    >
                      <Settings className="w-3 h-3" /> Gerenciar Categorias
                    </Button>
                  </div>
                  <Select value={newProduto.categoria_id} onChange={e => {
                    const selectedCatId = e.target.value;
                    const cat = categorias.find(c => c.id === selectedCatId);
                    if (cat) {
                      // Herdar dimensões da categoria selecionada
                      setNewProduto({
                        ...newProduto,
                        categoria_id: selectedCatId,
                        largura_cm: cat.largura_padrao || newProduto.largura_cm,
                        altura_cm: cat.altura_padrao || newProduto.altura_cm,
                        comprimento_cm: cat.comprimento_padrao || newProduto.comprimento_padrao,
                        peso_g: (cat.peso_padrao * 1000) || newProduto.peso_g // Convertendo kg para g
                      });
                    } else {
                      setNewProduto({ ...newProduto, categoria_id: '' });
                    }
                  }}>
                    <option value="">Selecione categoria...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Localização Estruturada (WMS)</Label>
                  <Select value={newProduto.localizacao_id} onChange={e => setNewProduto({ ...newProduto, localizacao_id: e.target.value })}>
                    <option value="">Selecione localização...</option>
                    {locais.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.parent_id ? `${locais.find(p => p.id === l.parent_id)?.nome} (${locais.find(p => p.id === l.parent_id)?.sigla}) > ${l.nome} (${l.sigla})` : `${l.nome} (${l.sigla})`}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>MELI ID (Mercado Livre)</Label>
                  <Input placeholder="Ex: MLB12345678" value={newProduto.meli_id || ''} onChange={e => setNewProduto({ ...newProduto, meli_id: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input
                    value={newProduto.marca}
                    onChange={e => setNewProduto({ ...newProduto, marca: e.target.value, modelo: '' })}
                    list="marcas-standard-list"
                  />
                  <datalist id="marcas-standard-list">
                    {marcasStandard.map(m => <option key={m.id} value={m.nome} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={newProduto.modelo}
                    onChange={e => setNewProduto({ ...newProduto, modelo: e.target.value })}
                    disabled={!newProduto.marca}
                    placeholder={!newProduto.marca ? "Selecione a marca..." : ""}
                    list="modelos-standard-list"
                  />
                  <datalist id="modelos-standard-list">
                    {modelosStandard
                      .filter(m => !newProduto.marca || marcasStandard.find(brand => brand.nome === newProduto.marca)?.id === m.marca_id)
                      .map(m => <option key={m.id} value={m.nome} />)}
                  </datalist>
                </div>
                <div className="space-y-2"><Label>Ano</Label><Input type="number" value={newProduto.ano} onChange={e => setNewProduto({ ...newProduto, ano: parseInt(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Versão</Label><Input value={newProduto.versao} onChange={e => setNewProduto({ ...newProduto, versao: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Custo Compra (R$)</Label><Input type="number" step="0.01" value={newProduto.custo} onChange={e => setNewProduto({ ...newProduto, custo: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Valor Venda (R$)</Label><Input type="number" step="0.01" value={newProduto.preco} onChange={e => setNewProduto({ ...newProduto, preco: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Adicional Venda (%)</Label><Input type="number" step="0.01" value={newProduto.adicional_venda_percentual} onChange={e => setNewProduto({ ...newProduto, adicional_venda_percentual: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Estoque Total</Label><Input type="number" value={newProduto.estoque_atual} onChange={e => setNewProduto({ ...newProduto, estoque_atual: parseInt(e.target.value) })} /></div>
              </div>

              <div className="space-y-2">
                <Label>Informações Adicionais / Descrição</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newProduto.descricao}
                  onChange={e => setNewProduto({ ...newProduto, descricao: e.target.value })}
                />
              </div>

              <div className="p-4 border border-dashed rounded-lg bg-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <Label>Imagens do Produto ({imagePreviews.length})</Label>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs font-bold uppercase gap-1" onClick={() => document.getElementById('img-up')?.click()}>
                    <Plus className="w-3 h-3" /> Adicionar Fotos
                  </Button>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded border bg-background overflow-hidden group">
                      <img
                        src={preview}
                        className="w-full h-full object-contain transition-transform group-hover:scale-110"
                        onClick={() => {
                          setSelectedImages(imagePreviews)
                          setInitialViewerIndex(index)
                          setIsViewerOpen(true)
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[8px] text-white text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {index === 0 ? "Principal" : `Foto ${index + 1}`}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => document.getElementById('img-up')?.click()}
                    className="aspect-square rounded border-2 border-dashed flex flex-col items-center justify-center bg-background/50 hover:bg-background transition-colors text-muted-foreground/40 hover:text-primary/40"
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                  </button>
                </div>

                <input
                  id="img-up"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length > 0) {
                      setSelectedFiles(prev => [...prev, ...files])

                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreviews(prev => [...prev, reader.result as string])
                        }
                        reader.readAsDataURL(file)
                      })
                    }
                  }}
                />
                <p className="text-[9px] text-muted-foreground mt-2 uppercase tracking-tighter">A primeira imagem será o ícone principal no catálogo.</p>

                {selectedCatalogPeca?.imagem_url && (
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-white">
                        <img src={selectedCatalogPeca.imagem_url} alt="Template" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary">Foto do Catálogo disponível</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Template: {selectedCatalogPeca.nome}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-primary/10 text-primary border-primary/30 hover:bg-primary hover:text-white font-bold text-[10px] gap-2"
                      onClick={() => {
                        if (!imagePreviews.includes(selectedCatalogPeca.imagem_url)) {
                          setImagePreviews(prev => [selectedCatalogPeca.imagem_url, ...prev]);
                        } else {
                          alert("Esta foto já está na lista!");
                        }
                      }}
                    >
                      <ImagePlus className="w-3 h-3" /> Usar Foto do Catálogo
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>CST (Situação Tributária)</Label><Input placeholder="Ex: 500" value={newProduto.cst} onChange={e => setNewProduto({ ...newProduto, cst: e.target.value })} /></div>
                <div className="space-y-2"><Label>CFOP</Label><Input placeholder="Ex: 5405" value={newProduto.cfop} onChange={e => setNewProduto({ ...newProduto, cfop: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Unid. Medida</Label>
                  <Select value={newProduto.unidade_medida} onChange={e => setNewProduto({ ...newProduto, unidade_medida: e.target.value })}>
                    <option value="UN">UN - Unidade</option>
                    <option value="PC">PC - Peça</option>
                    <option value="JG">JG - Jogo</option>
                    <option value="LT">LT - Litro</option>
                    <option value="KG">KG - Quilo</option>
                  </Select>
                </div>
                <div className="space-y-2"><Label>NCM</Label><Input placeholder="00000000" value={newProduto.ncm} onChange={e => setNewProduto({ ...newProduto, ncm: e.target.value })} /></div>
                <div className="space-y-2"><Label>CEST</Label><Input placeholder="0000000" value={newProduto.cest} onChange={e => setNewProduto({ ...newProduto, cest: e.target.value })} /></div>
                <div className="space-y-2"><Label>Outros Custos (R$)</Label><Input type="number" step="0.01" value={newProduto.outros_custos} onChange={e => setNewProduto({ ...newProduto, outros_custos: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Qualidade da Peça</Label>
                  <Select value={newProduto.qualidade} onChange={e => setNewProduto({ ...newProduto, qualidade: e.target.value })}>
                    <option value="A">Qualidade A (Original/Premium)</option>
                    <option value="B">Qualidade B (Standard)</option>
                    <option value="C">Qualidade C (Econômica)</option>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Origem do Produto</Label><Input value={newProduto.origem} onChange={e => setNewProduto({ ...newProduto, origem: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="logistica" className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Barras (GTIN)</Label>
                <Input placeholder="SEM GTIN" value={newProduto.codigo_barras} onChange={e => setNewProduto({ ...newProduto, codigo_barras: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Peso (g)</Label><Input type="number" value={newProduto.peso_g} onChange={e => setNewProduto({ ...newProduto, peso_g: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" step="0.1" value={newProduto.altura_cm} onChange={e => setNewProduto({ ...newProduto, altura_cm: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Largura (cm)</Label><Input type="number" step="0.1" value={newProduto.largura_cm} onChange={e => setNewProduto({ ...newProduto, largura_cm: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Comprimento (cm)</Label><Input type="number" step="0.1" value={newProduto.comprimento_cm} onChange={e => setNewProduto({ ...newProduto, comprimento_cm: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Informações Adicionais para Venda</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={newProduto.informacoes_adicionais}
                  onChange={e => setNewProduto({ ...newProduto, informacoes_adicionais: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="compat" className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Adicionar Modelo Compatível</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Marca</Label>
                    <Input
                      bs-size="sm"
                      value={newCompat.marca}
                      onChange={e => setNewCompat({ ...newCompat, marca: e.target.value, modelo: '' })}
                      list="marcas-standard-list"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Modelo</Label>
                    <Input
                      bs-size="sm"
                      value={newCompat.modelo}
                      onChange={e => setNewCompat({ ...newCompat, modelo: e.target.value })}
                      disabled={!newCompat.marca}
                      list="modelos-standard-compat-list"
                    />
                    <datalist id="modelos-standard-compat-list">
                      {modelosStandard
                        .filter(m => !newCompat.marca || marcasStandard.find(brand => brand.nome === newCompat.marca)?.id === m.marca_id)
                        .map(m => <option key={m.id} value={m.nome} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase">Ano</Label><Input bs-size="sm" value={newCompat.ano} onChange={e => setNewCompat({ ...newCompat, ano: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase">Versão</Label><Input bs-size="sm" value={newCompat.versao} onChange={e => setNewCompat({ ...newCompat, versao: e.target.value })} /></div>
                </div>
                <Button type="button" className="w-full bg-primary/20 text-primary hover:bg-primary hover:text-white" onClick={() => {
                  if (!newCompat.marca || !newCompat.modelo) return alert("Preencha Marca e Modelo")
                  setCompatList([...compatList, newCompat])
                  setNewCompat({ marca: '', modelo: '', ano: '', versao: '' })
                }}><Plus className="w-4 h-4 mr-2" /> Vincular Modelo</Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {compatList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs italic">Nenhuma compatibilidade vinculada.</div>
                ) : (
                  compatList.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-background border rounded-lg text-xs">
                      <div className="flex gap-4">
                        <span className="font-bold text-primary">{c.marca} {c.modelo}</span>
                        <span className="text-muted-foreground">Ano: {c.ano} | Ver: {c.versao}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setCompatList(compatList.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t border-border bg-background sticky bottom-0 z-10">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting} className="bg-destructive hover:bg-destructive/90 text-white font-bold px-8">
              {submitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCompatModalOpen} onClose={() => setIsCompatModalOpen(false)} title="Compatibilidades" className="max-w-md">
        <div className="p-4 space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 text-sm whitespace-pre-wrap">{selectedCompat || "Nenhuma compatibilidade cadastrada."}</div>
          <div className="flex justify-end font-medium"><Button onClick={() => setIsCompatModalOpen(false)}>Fechar</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Gerenciar Categorias" className="max-w-lg">
        <div className="space-y-6">
          <div className="p-4 border border-amber-500/10 rounded-xl bg-amber-500/5 space-y-4">
            <h3 className="font-bold text-sm text-amber-600 flex items-center gap-2">
              {editingCatId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingCatId ? "Editar Categoria" : "Nova Categoria"}
            </h3>
            <div className="space-y-2">
              <Label>Nome da Categoria</Label>
              <Input
                placeholder="Ex: Motor, Suspensão..."
                value={newCat.nome}
                onChange={e => setNewCat({ ...newCat, nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Largura (cm)</Label>
                <Input type="number" step="0.1" value={newCat.largura_padrao} onChange={e => setNewCat({ ...newCat, largura_padrao: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Altura (cm)</Label>
                <Input type="number" step="0.1" value={newCat.altura_padrao} onChange={e => setNewCat({ ...newCat, altura_padrao: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Compr. (cm)</Label>
                <Input type="number" step="0.1" value={newCat.comprimento_padrao} onChange={e => setNewCat({ ...newCat, comprimento_padrao: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Peso (kg)</Label>
                <Input type="number" step="0.001" value={newCat.peso_padrao} onChange={e => setNewCat({ ...newCat, peso_padrao: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex gap-2">
              {editingCatId && (
                <Button variant="outline" className="flex-1" onClick={() => {
                  setEditingCatId(null)
                  setNewCat({ nome: '', largura_padrao: 0, altura_padrao: 0, comprimento_padrao: 0, peso_padrao: 0 })
                }}>
                  Cancelar Edição
                </Button>
              )}
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 font-bold" onClick={handleSaveCategory}>
                {editingCatId ? "Atualizar Categoria" : "Salvar Categoria"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Categorias Cadastradas</Label>
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
              {categorias.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs italic">Nenhuma categoria cadastrada.</div>
              ) : (
                categorias.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-background border rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{c.nome}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {c.largura_padrao}x{c.altura_padrao}x{c.comprimento_padrao}cm | {c.peso_padrao}kg
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                        setEditingCatId(c.id)
                        setNewCat({
                          nome: c.nome,
                          largura_padrao: c.largura_padrao,
                          altura_padrao: c.altura_padrao,
                          comprimento_padrao: c.comprimento_padrao,
                          peso_padrao: c.peso_padrao
                        })
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={() => setIsCategoryModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Zoom da Imagem do Catálogo */}
      <Modal isOpen={!!zoomedImage} onClose={() => setZoomedImage(null)} title="Visualização da Imagem" className="max-w-3xl border-none bg-transparent shadow-none">
        <div className="relative group overflow-hidden rounded-2xl bg-black/20 backdrop-blur-sm p-1">
          <img
            src={zoomedImage || ''}
            alt="Catalog Zoom"
            className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
          />
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </Modal>
      <ImageViewer
        images={selectedImages}
        initialIndex={initialViewerIndex}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />
    </div>
  )
}
