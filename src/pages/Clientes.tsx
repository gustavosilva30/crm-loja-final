import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, User, Mail, Phone, MapPin, Trash2, Pencil, X, ChevronDown, RefreshCw, Users, Wallet, TrendingUp, AlertTriangle, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import { fmt } from "@/lib/format"
import { useAsyncData } from "@/hooks/useAsyncData"

interface Cliente {
    id: string
    nome: string
    razao_social: string | null
    documento: string | null
    inscricao_estadual: string | null
    email: string | null
    telefone: string | null
    endereco: string | null
    saldo_haver: number
    limite_credito: number
    created_at: string
    vendedor_id: string | null
    vendedor?: { id: string, nome: string }
}

export function Clientes() {
    const [searchTerm, setSearchTerm] = useState("")
    const [clientes, setClientes] = useState<Cliente[]>([])
    const { run, loading, error, clearError } = useAsyncData()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [searchingCNPJ, setSearchingCNPJ] = useState(false)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [vendedores, setVendedores] = useState<{ id: string, nome: string }[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const { atendente } = useAuthStore()

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    // ─── Filtros ─────────────────────────────────────────────
    const [filterSaldoHaver, setFilterSaldoHaver] = useState<'todos' | 'com_saldo' | 'sem_saldo'>('todos')
    const [filterLimiteCredito, setFilterLimiteCredito] = useState<'todos' | 'com_limite' | 'sem_limite'>('todos')
    const [filterCadastroInicio, setFilterCadastroInicio] = useState('')
    const [filterCadastroFim, setFilterCadastroFim] = useState('')
    const [filterTipo, setFilterTipo] = useState<'todos' | 'pf' | 'pj'>('todos') // PF (CPF 11 dígitos) vs PJ (CNPJ 14)
    const [filterComEmail, setFilterComEmail] = useState<'todos' | 'sim' | 'nao'>('todos')
    const [filterComTelefone, setFilterComTelefone] = useState<'todos' | 'sim' | 'nao'>('todos')
    const [filterVendedorId, setFilterVendedorId] = useState<string>('all')
    const [sortBy, setSortBy] = useState<'nome' | 'created_at' | 'saldo_haver' | 'limite_credito'>('nome')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    // Form State
    const [newCliente, setNewCliente] = useState({
        nome: '',
        razao_social: '',
        documento: '',
        inscricao_estadual: '',
        email: '',
        telefone: '',
        endereco: '',
        limite_credito: 0,
        vendedor_id: ''
    })

    const fetchClientes = useCallback(() => run(async () => {
        let query = supabase.from('clientes').select('*, vendedor:atendentes(id, nome)')
        if (!atendente?.perm_config) query = query.eq('vendedor_id', atendente?.id)
        const { data, err } = await query.order('nome')
        if (err) throw err
        setClientes(data || [])
        const { data: vends } = await supabase.from('atendentes').select('id, nome').order('nome')
        if (vends) setVendedores(vends)
    }), [run, atendente?.id, atendente?.perm_config])

    useEffect(() => { fetchClientes() }, [fetchClientes])
    useEffect(() => { if (error) { alert('Falha ao carregar clientes. Tente novamente.'); clearError() } }, [error, clearError])
    useEffect(() => { setCurrentPage(1) }, [searchTerm, filterSaldoHaver, filterLimiteCredito, filterCadastroInicio, filterCadastroFim, filterTipo, filterComEmail, filterComTelefone, filterVendedorId])

    const searchCNPJ = async () => {
        const cnpj = newCliente.documento.replace(/\D/g, '')
        if (cnpj.length !== 14) return alert('Digite um CNPJ válido com 14 números')
        setSearchingCNPJ(true)
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
            if (!res.ok) throw new Error('CNPJ não encontrado')
            const data = await res.json()
            setNewCliente(prev => ({
                ...prev,
                nome: data.nome_fantasia || data.razao_social,
                razao_social: data.razao_social,
                email: data.email || prev.email,
                telefone: data.ddd_telefone_1 || prev.telefone,
                endereco: `${data.logradouro}, ${data.numero}${data.complemento ? ' ' + data.complemento : ''} - ${data.bairro}, ${data.municipio} - ${data.uf}`
            }))
        } catch (err) {
            alert('Erro ao buscar CNPJ. Verifique o número.')
        } finally {
            setSearchingCNPJ(false)
        }
    }

    const handleAddCliente = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const dataToSave = {
                ...newCliente,
                vendedor_id: newCliente.vendedor_id || atendente?.id || null
            }
            if (editingCliente) {
                const { error } = await supabase.from('clientes').update(dataToSave).eq('id', editingCliente.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('clientes').insert([dataToSave])
                if (error) throw error
            }
            setIsModalOpen(false)
            setEditingCliente(null)
            setNewCliente({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', email: '', telefone: '', endereco: '', limite_credito: 0, vendedor_id: '' })
            fetchClientes()
        } catch (err: any) {
            alert('Erro ao salvar cliente: ' + (err.message || 'Verifique se o CPF/CNPJ já existe'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este cliente?")) return
        const { error } = await supabase.from('clientes').delete().eq('id', id)
        if (error) {
            alert("Erro ao excluir: verifique se o cliente possui vendas vinculadas.")
        } else {
            fetchClientes()
            alert("Cliente excluído com sucesso.")
        }
    }

    const startEdit = (cliente: Cliente) => {
        setEditingCliente(cliente)
        setNewCliente({
            nome: cliente.nome,
            razao_social: cliente.razao_social || '',
            documento: cliente.documento || '',
            inscricao_estadual: cliente.inscricao_estadual || '',
            email: cliente.email || '',
            telefone: cliente.telefone || '',
            endereco: cliente.endereco || '',
            limite_credito: cliente.limite_credito || 0,
            vendedor_id: cliente.vendedor_id || ''
        })
        setIsModalOpen(true)
    }

    const clearFilters = () => {
        setSearchTerm('')
        setFilterSaldoHaver('todos')
        setFilterLimiteCredito('todos')
        setFilterCadastroInicio('')
        setFilterCadastroFim('')
        setFilterTipo('todos')
        setFilterComEmail('todos')
        setFilterComTelefone('todos')
        setFilterVendedorId('all')
        setSortBy('nome')
        setSortDir('asc')
    }

    const activeFilterCount = [
        searchTerm,
        filterSaldoHaver !== 'todos' ? '1' : '',
        filterLimiteCredito !== 'todos' ? '1' : '',
        filterCadastroInicio, filterCadastroFim,
        filterTipo !== 'todos' ? '1' : '',
        filterComEmail !== 'todos' ? '1' : '',
        filterComTelefone !== 'todos' ? '1' : '',
        filterVendedorId !== 'all' ? '1' : '',
    ].filter(Boolean).length

    const filteredClientes = useMemo(() => {
        let result = clientes.filter(c => {
            const term = searchTerm.toLowerCase()
            const matchSearch = !searchTerm ||
                c.nome.toLowerCase().includes(term) ||
                c.documento?.toLowerCase().includes(term) ||
                c.email?.toLowerCase().includes(term) ||
                c.razao_social?.toLowerCase().includes(term) ||
                c.telefone?.includes(searchTerm) ||
                c.endereco?.toLowerCase().includes(term)

            const matchSaldo =
                filterSaldoHaver === 'todos' ||
                (filterSaldoHaver === 'com_saldo' && (c.saldo_haver || 0) > 0) ||
                (filterSaldoHaver === 'sem_saldo' && (c.saldo_haver || 0) === 0)

            const matchLimite =
                filterLimiteCredito === 'todos' ||
                (filterLimiteCredito === 'com_limite' && (c.limite_credito || 0) > 0) ||
                (filterLimiteCredito === 'sem_limite' && (c.limite_credito || 0) === 0)

            const docDigits = (c.documento || '').replace(/\D/g, '')
            const matchTipo =
                filterTipo === 'todos' ||
                (filterTipo === 'pf' && docDigits.length === 11) ||
                (filterTipo === 'pj' && docDigits.length === 14) ||
                (filterTipo === 'pj' && docDigits.length === 0)

            const matchEmail =
                filterComEmail === 'todos' ||
                (filterComEmail === 'sim' && !!c.email) ||
                (filterComEmail === 'nao' && !c.email)

            const matchTel =
                filterComTelefone === 'todos' ||
                (filterComTelefone === 'sim' && !!c.telefone) ||
                (filterComTelefone === 'nao' && !c.telefone)

            const cadDate = new Date(c.created_at).getTime()
            const matchInicio = !filterCadastroInicio || cadDate >= new Date(filterCadastroInicio + 'T00:00:00').getTime()
            const matchFim = !filterCadastroFim || cadDate <= new Date(filterCadastroFim + 'T23:59:59').getTime()

            const matchVendedor = filterVendedorId === 'all' || c.vendedor_id === filterVendedorId

            return matchSearch && matchSaldo && matchLimite && matchTipo && matchEmail && matchTel && matchInicio && matchFim && matchVendedor
        })

        // Sort
        result.sort((a, b) => {
            let va: any = a[sortBy] ?? ''
            let vb: any = b[sortBy] ?? ''
            if (typeof va === 'string') va = va.toLowerCase()
            if (typeof vb === 'string') vb = vb.toLowerCase()
            if (va < vb) return sortDir === 'asc' ? -1 : 1
            if (va > vb) return sortDir === 'asc' ? 1 : -1
            return 0
        })

        return result
    }, [clientes, searchTerm, filterSaldoHaver, filterLimiteCredito, filterCadastroInicio, filterCadastroFim, filterTipo, filterComEmail, filterComTelefone, sortBy, sortDir])

    const paginatedClientes = filteredClientes.slice(0, currentPage * pageSize)
    const hasMore = paginatedClientes.length < filteredClientes.length

    // KPIs
    const totalComSaldo = clientes.filter(c => (c.saldo_haver || 0) > 0).length
    const totalSaldoHaver = clientes.reduce((a, c) => a + (c.saldo_haver || 0), 0)
    const totalComLimite = clientes.filter(c => (c.limite_credito || 0) > 0).length
    const semContato = clientes.filter(c => !c.email && !c.telefone).length

    const handleBulkTransfer = async () => {
        if (selectedIds.length === 0) return
        const targetVendedorId = prompt("Digite o ID do novo vendedor ou selecione 'OK' para confirmar a transferência para um vendedor específico (implementação visual pendente, usando prompt simplificado)")

        if (!targetVendedorId) return

        setLoading(true)
        try {
            const { error } = await supabase.from('clientes').update({ vendedor_id: targetVendedorId }).in('id', selectedIds)
            if (error) throw error
            alert(`${selectedIds.length} clientes transferidos com sucesso!`)
            setSelectedIds([])
            fetchClientes()
        } catch (err: any) {
            alert("Erro ao transferir carteira: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seu cadastro de clientes e histórico de compras.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchClientes}><RefreshCw className="w-4 h-4" /></Button>
                    <Button className="gap-2" onClick={() => {
                        setEditingCliente(null)
                        setNewCliente({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', email: '', telefone: '', endereco: '', limite_credito: 0, vendedor_id: '' })
                        setIsModalOpen(true)
                    }}>
                        <Plus className="w-4 h-4" /> Novo Cliente
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> Total</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{clientes.length}</div><p className="text-xs text-muted-foreground">clientes cadastrados</p></CardContent>
                </Card>
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo Haver</CardTitle></CardHeader>
                    <CardContent><div className="text-xl font-bold text-emerald-500">{fmt(totalSaldoHaver)}</div><p className="text-xs text-muted-foreground">{totalComSaldo} clientes com saldo</p></CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Limite Crédito</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-500">{totalComLimite}</div><p className="text-xs text-muted-foreground">clientes com limite</p></CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem Contato</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-500">{semContato}</div><p className="text-xs text-muted-foreground">sem e-mail nem telefone</p></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    {/* Barra de busca e botão filtros */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome, fantasia, CPF/CNPJ, telefone, e-mail..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Ordenação rápida */}
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
                            <option value="created_at:desc">Mais recentes</option>
                            <option value="created_at:asc">Mais antigos</option>
                            <option value="saldo_haver:desc">Maior saldo haver</option>
                            <option value="limite_credito:desc">Maior limite</option>
                        </select>

                        <select
                            className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
                            value={pageSize.toString()}
                            onChange={e => setPageSize(parseInt(e.target.value))}
                        >
                            <option value="20">20 por vez</option>
                            <option value="50">50 por vez</option>
                            <option value="100">100 por vez</option>
                        </select>

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
                                <X className="w-3 h-3" /> Limpar filtros
                            </Button>
                        )}
                    </div>

                    {/* Painel de Filtros */}
                    {isFilterOpen && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border animate-in fade-in slide-in-from-top-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Pessoa</Label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value as any)}>
                                    <option value="todos">Todos</option>
                                    <option value="pf">Pessoa Física (CPF)</option>
                                    <option value="pj">Pessoa Jurídica (CNPJ)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Haver</Label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterSaldoHaver} onChange={e => setFilterSaldoHaver(e.target.value as any)}>
                                    <option value="todos">Todos</option>
                                    <option value="com_saldo">Com saldo</option>
                                    <option value="sem_saldo">Sem saldo</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Limite de Crédito</Label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterLimiteCredito} onChange={e => setFilterLimiteCredito(e.target.value as any)}>
                                    <option value="todos">Todos</option>
                                    <option value="com_limite">Com limite</option>
                                    <option value="sem_limite">Sem limite</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">E-mail Cadastrado</Label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterComEmail} onChange={e => setFilterComEmail(e.target.value as any)}>
                                    <option value="todos">Todos</option>
                                    <option value="sim">Com e-mail</option>
                                    <option value="nao">Sem e-mail</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Telefone Cadastrado</Label>
                                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterComTelefone} onChange={e => setFilterComTelefone(e.target.value as any)}>
                                    <option value="todos">Todos</option>
                                    <option value="sim">Com telefone</option>
                                    <option value="nao">Sem telefone</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cadastro de</Label>
                                <input type="date" value={filterCadastroInicio}
                                    onChange={e => setFilterCadastroInicio(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cadastro até</Label>
                                <input type="date" value={filterCadastroFim}
                                    onChange={e => setFilterCadastroFim(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
                            </div>
                            {atendente?.perm_config && (
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vendedor (Admin)</Label>
                                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterVendedorId} onChange={e => setFilterVendedorId(e.target.value)}>
                                        <option value="all">Todos os Vendedores</option>
                                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="flex items-end">
                                <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 w-full text-center">
                                    <span className="font-bold text-primary text-base">{filteredClientes.length}</span>
                                    <span className="block">resultado(s)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground animate-pulse">Carregando clientes...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <input
                                            type="checkbox"
                                            className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                            checked={selectedIds.length === paginatedClientes.length && paginatedClientes.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds(paginatedClientes.map(p => p.id))
                                                else setSelectedIds([])
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Saldo Haver</TableHead>
                                    <TableHead>Limite Crédito</TableHead>
                                    <TableHead>Cadastro</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedClientes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                            <p>Nenhum cliente encontrado.</p>
                                            {activeFilterCount > 0 && (
                                                <Button variant="link" size="sm" className="mt-1" onClick={clearFilters}>Limpar filtros</Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedClientes.map((cliente) => (
                                    <TableRow key={cliente.id} className={cn("group transition-colors", selectedIds.includes(cliente.id) && "bg-primary/5")}>
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                                checked={selectedIds.includes(cliente.id)}
                                                onChange={() => {
                                                    setSelectedIds(prev => prev.includes(cliente.id) ? prev.filter(id => id !== cliente.id) : [...prev, cliente.id])
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full shrink-0">
                                                    <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{cliente.nome}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">
                                                        {cliente.razao_social || "Pessoa Física"}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs">{cliente.documento || "—"}</span>
                                                <span className="text-[9px] text-muted-foreground italic">IE: {cliente.inscricao_estadual || "Isento"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {cliente.email && (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Mail className="w-3 h-3" /> {cliente.email}
                                                    </div>
                                                )}
                                                {cliente.telefone && (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Phone className="w-3 h-3" /> {cliente.telefone}
                                                    </div>
                                                )}
                                                {!cliente.email && !cliente.telefone && (
                                                    <span className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem contato</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-[10px] py-0 font-bold border-primary/20 bg-primary/5">
                                                    {cliente.vendedor?.nome || "Sem Vendedor"}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={(cliente.saldo_haver || 0) > 0 ? "default" : "outline"} className="font-bold">
                                                {fmt(cliente.saldo_haver || 0)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`font-bold text-xs ${(cliente.limite_credito || 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                {fmt(cliente.limite_credito || 0)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px]">
                                            {new Date(cliente.created_at).toLocaleDateString("pt-BR")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" title="Editar" onClick={() => startEdit(cliente)}>
                                                    <Pencil className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(cliente.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {hasMore && (
                        <div className="flex justify-center mt-6">
                            <Button variant="outline" className="px-10 h-10 font-bold" onClick={() => setCurrentPage(prev => prev + 1)}>
                                Carregar mais ({filteredClientes.length - paginatedClientes.length} restantes)
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCliente ? "Editar Cliente" : "Cadastrar Novo Cliente"}>
                <form onSubmit={handleAddCliente} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome Fantasia / Nome</Label>
                            <Input required placeholder="Nome Fantasia" value={newCliente.nome} onChange={e => setNewCliente({ ...newCliente, nome: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Razão Social</Label>
                            <Input placeholder="Nome no Contrato Social" value={newCliente.razao_social} onChange={e => setNewCliente({ ...newCliente, razao_social: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>CPF / CNPJ</Label>
                            <div className="flex gap-2">
                                <Input placeholder="00.000.000/0001-00" value={newCliente.documento}
                                    onChange={e => setNewCliente({ ...newCliente, documento: e.target.value })} />
                                {newCliente.documento.replace(/\D/g, '').length === 14 && (
                                    <Button type="button" variant="outline" size="icon" onClick={searchCNPJ} disabled={searchingCNPJ} title="Buscar dados do CNPJ">
                                        <Search className={`w-4 h-4 ${searchingCNPJ ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Inscrição Estadual (IE)</Label>
                            <Input placeholder="000.000.000.000" value={newCliente.inscricao_estadual}
                                onChange={e => setNewCliente({ ...newCliente, inscricao_estadual: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input placeholder="(00) 00000-0000" value={newCliente.telefone}
                                onChange={e => setNewCliente({ ...newCliente, telefone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input type="email" placeholder="email@exemplo.com" value={newCliente.email}
                                onChange={e => setNewCliente({ ...newCliente, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Endereço Completo</Label>
                        <Input placeholder="Rua, Número, Bairro, Cidade - UF" value={newCliente.endereco}
                            onChange={e => setNewCliente({ ...newCliente, endereco: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Limite de Crédito (R$)</Label>
                        <Input type="number" step="0.01" placeholder="Ex: 5000.00" value={newCliente.limite_credito}
                            onChange={e => setNewCliente({ ...newCliente, limite_credito: parseFloat(e.target.value) || 0 })} />
                        <p className="text-[10px] text-muted-foreground italic">Define o valor máximo permitido para vendas faturadas no boleto.</p>
                    </div>
                    {atendente?.perm_config && (
                        <div className="space-y-2">
                            <Label>Vendedor Responsável</Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={newCliente.vendedor_id}
                                onChange={e => setNewCliente({ ...newCliente, vendedor_id: e.target.value })}
                            >
                                <option value="">Atribuir automaticamente ao logado</option>
                                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Salvando..." : (editingCliente ? "Salvar Alterações" : "Cadastrar Cliente")}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
