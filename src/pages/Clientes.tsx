import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Filter, User, Mail, Phone, MapPin, Trash2, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"

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
}

export function Clientes() {
    const [searchTerm, setSearchTerm] = useState("")
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [searchingCNPJ, setSearchingCNPJ] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    // Form State
    const [newCliente, setNewCliente] = useState({
        nome: '',
        razao_social: '',
        documento: '',
        inscricao_estadual: '',
        email: '',
        telefone: '',
        endereco: '',
        limite_credito: 0
    })

    const fetchClientes = async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('nome')

            if (error) {
                console.error('Error fetching clientes:', error)
            } else {
                setClientes(data || [])
            }
        } catch (err) {
            console.error('Unexpected error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchClientes()
    }, [])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

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
            if (editingCliente) {
                const { error } = await supabase
                    .from('clientes')
                    .update(newCliente)
                    .eq('id', editingCliente.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('clientes')
                    .insert([newCliente])
                if (error) throw error
            }

            setIsModalOpen(false)
            setEditingCliente(null)
            setNewCliente({
                nome: '',
                razao_social: '',
                documento: '',
                inscricao_estadual: '',
                email: '',
                telefone: '',
                endereco: '',
                limite_credito: 0
            })
            fetchClientes()
        } catch (err: any) {
            console.error('Error adding client:', err)
            alert('Erro ao salvar cliente: ' + (err.message || 'Verifique se o CPF/CNPJ já existe'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este cliente?")) return
        const { error } = await supabase.from('clientes').delete().eq('id', id)
        if (error) alert("Erro ao excluir: verifique se o cliente possui vendas vinculadas")
        else fetchClientes()
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
            limite_credito: cliente.limite_credito || 0
        })
        setIsModalOpen(true)
    }

    const filteredClientes = clientes.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.documento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const paginatedClientes = filteredClientes.slice(0, currentPage * pageSize)
    const hasMore = paginatedClientes.length < filteredClientes.length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seu cadastro de clientes e histórico de compras.</p>
                </div>
                <Button className="gap-2" onClick={() => {
                    setEditingCliente(null)
                    setNewCliente({
                        nome: '',
                        razao_social: '',
                        documento: '',
                        inscricao_estadual: '',
                        email: '',
                        telefone: '',
                        endereco: '',
                        limite_credito: 0
                    })
                    setIsModalOpen(true)
                }}>
                    <Plus className="w-4 h-4" />
                    Novo Cliente
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="relative w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome, fantasia, CPF/CNPJ..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={pageSize.toString()}
                                onChange={e => setPageSize(parseInt(e.target.value))}
                            >
                                <option value="20">20 por vez</option>
                                <option value="50">50 por vez</option>
                                <option value="100">100 por vez</option>
                            </select>
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
                            Carregando clientes...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Localização</TableHead>
                                    <TableHead>Saldo Haver</TableHead>
                                    <TableHead>Limite Crédito</TableHead>
                                    <TableHead>Data Cadastro</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedClientes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            Nenhum cliente encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedClientes.map((cliente) => (
                                    <TableRow key={cliente.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full">
                                                    <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{cliente.nome}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">{cliente.razao_social || "Pessoa Física"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs">{cliente.documento || "-"}</span>
                                                <span className="text-[9px] text-muted-foreground italic truncate">IE: {cliente.inscricao_estadual || "Isento"}</span>
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
                                                {!cliente.email && !cliente.telefone && "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px] truncate">
                                                {cliente.endereco ? (
                                                    <>
                                                        <MapPin className="w-3 h-3 shrink-0" />
                                                        {cliente.endereco}
                                                    </>
                                                ) : "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={(cliente.saldo_haver || 0) > 0 ? "default" : "outline"} className="font-bold">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.saldo_haver || 0)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-emerald-600 text-xs">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.limite_credito || 0)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px]">
                                            {new Date(cliente.created_at).toLocaleDateString("pt-BR")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Editar"
                                                    onClick={() => startEdit(cliente)}
                                                >
                                                    <Pencil className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Excluir"
                                                    onClick={() => handleDelete(cliente.id)}
                                                    className="text-destructive"
                                                >
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
                            <Button variant="outline" className="px-10 h-10 border-indigo-600/20 text-indigo-600 hover:bg-indigo-600/5 font-bold" onClick={() => setCurrentPage(prev => prev + 1)}>
                                Carregar Mais Clientes
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
                            <Input
                                required
                                placeholder="Nome Fantasia"
                                value={newCliente.nome}
                                onChange={e => setNewCliente({ ...newCliente, nome: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Razão Social</Label>
                            <Input
                                placeholder="Nome no Contrato Social"
                                value={newCliente.razao_social}
                                onChange={e => setNewCliente({ ...newCliente, razao_social: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>CPF / CNPJ</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="00.000.000/0001-00"
                                    value={newCliente.documento}
                                    onChange={e => setNewCliente({ ...newCliente, documento: e.target.value })}
                                />
                                {newCliente.documento.replace(/\D/g, '').length === 14 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={searchCNPJ}
                                        disabled={searchingCNPJ}
                                        className="shrink-0"
                                        title="Buscar dados do CNPJ"
                                    >
                                        <Search className={`w-4 h-4 ${searchingCNPJ ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Inscrição Estadual (IE)</Label>
                            <Input
                                placeholder="000.000.000.000"
                                value={newCliente.inscricao_estadual}
                                onChange={e => setNewCliente({ ...newCliente, inscricao_estadual: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                                placeholder="(00) 00000-0000"
                                value={newCliente.telefone}
                                onChange={e => setNewCliente({ ...newCliente, telefone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                                type="email"
                                placeholder="email@exemplo.com"
                                value={newCliente.email}
                                onChange={e => setNewCliente({ ...newCliente, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Endereço Completo</Label>
                        <Input
                            placeholder="Rua, Número, Bairro, Cidade - UF"
                            value={newCliente.endereco}
                            onChange={e => setNewCliente({ ...newCliente, endereco: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Limite de Crédito (Boleto)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 5000.00"
                            value={newCliente.limite_credito}
                            onChange={e => setNewCliente({ ...newCliente, limite_credito: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground italic">Define o valor máximo permitido para vendas faturadas no boleto.</p>
                    </div>

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
