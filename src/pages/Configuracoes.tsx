import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Truck, Warehouse, Tags, Wallet, Save, Trash2, Users, Search, Database, MapPin, Layers, ChevronRight, Package, Pencil, ShoppingCart } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"
import { ImportadorInteligente } from "@/components/ImportadorInteligente"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"

export function Configuracoes() {
    const { atendente } = useAuthStore()
    const [activeTab, setActiveTab] = useState("shipping")
    const [loading, setLoading] = useState(false)

    // Data States
    const [shipping, setShipping] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [financeCategories, setFinanceCategories] = useState<any[]>([])
    const [atendentes, setAtendentes] = useState<any[]>([])
    const [locations, setLocations] = useState<any[]>([])
    const [mlAccounts, setMlAccounts] = useState<any[]>([])
    const [selectedLocationProducts, setSelectedLocationProducts] = useState<any[]>([])
    const [isProductListModalOpen, setIsProductListModalOpen] = useState(false)
    const [viewingLocationName, setViewingLocationName] = useState("")
    const [company, setCompany] = useState<any>({
        nome_fantasia: 'Dourados Auto Peças',
        razao_social: 'Leandro B Leal Auto Peças Eireli ME',
        cnpj: '',
        inscricao_estadual: '',
        email: '',
        telefone: '(67) 3424-3068 / (67) 9 9910-0220',
        logradouro: 'Av. Marcelino Pires',
        numero: '5235',
        bairro: 'vila Ubiratã',
        cidade: 'Dourados',
        estado: 'MS',
        cep: '',
        mensagem_rodape: 'Obrigado pela preferência!'
    })

    // Form States
    const [newShipping, setNewShipping] = useState({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', contato: '' })
    const [newSupplier, setNewSupplier] = useState({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', email: '', telefone: '' })
    const [newCat, setNewCat] = useState({
        nome: '',
        largura_padrao: 0,
        altura_padrao: 0,
        comprimento_padrao: 0,
        peso_padrao: 0
    })
    const [newFinCat, setNewFinCat] = useState("")
    const [newAtendente, setNewAtendente] = useState({
        nome: '',
        cargo: 'Vendedor',
        cor_identificacao: '#3b82f6',
        email: '',
        perm_vendas: true,
        perm_produtos: true,
        perm_financeiro: true,
        perm_fiscal: true,
        perm_caixa: true,
        perm_config: false
    })
    const [editingFinCat, setEditingFinCat] = useState<{ id: string, nome: string } | null>(null)
    const [editingCatId, setEditingCatId] = useState<string | null>(null)
    const [editingAtendente, setEditingAtendente] = useState<{ id: string, nome: string, cargo: string, cor_identificacao: string } | null>(null)
    const [isFinCatModalOpen, setIsFinCatModalOpen] = useState(false)
    const [isAtendenteModalOpen, setIsAtendenteModalOpen] = useState(false)
    const [newLocation, setNewLocation] = useState({ nome: '', sigla: '', descricao: '', parent_id: null as string | null })

    const fetchData = async () => {
        const { data: s } = await supabase.from('transportadoras').select('*').order('nome')
        const { data: sup } = await supabase.from('fornecedores').select('*').order('nome')
        const { data: c } = await supabase.from('categorias').select('*').order('nome')
        const { data: fc } = await supabase.from('financeiro_categorias').select('*').order('nome')
        const { data: at } = await supabase.from('atendentes').select('*').order('nome')
        const { data: comp } = await supabase.from('configuracoes_empresa').select('*').single()
        const { data: loc } = await supabase.from('localizacoes').select('*').order('nome')
        const { data: ml } = await supabase.from('mercadolivre_accounts').select('*').order('ml_nickname')

        if (s) setShipping(s)
        if (sup) setSuppliers(sup)
        if (c) setCategories(c)
        if (fc) setFinanceCategories(fc)
        if (at) setAtendentes(at)
        if (comp) setCompany(comp)
        if (loc) setLocations(loc)
        if (ml) setMlAccounts(ml)
    }

    useEffect(() => { fetchData() }, [])

    const searchCNPJGeneric = async (doc: string, setFn: any) => {
        const cnpj = doc.replace(/\D/g, '')
        if (cnpj.length !== 14) return alert('Digite um CNPJ válido')
        setLoading(true)
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
            if (!res.ok) throw new Error('Não encontrado')
            const data = await res.json()
            setFn((prev: any) => ({
                ...prev,
                nome: data.nome_fantasia || data.razao_social,
                razao_social: data.razao_social,
                email: data.email || prev.email,
                telefone: data.ddd_telefone_1 || prev.telefone,
                contato: data.ddd_telefone_1 || prev.contato
            }))
        } catch (err) { alert('Erro ao buscar CNPJ') }
        finally { setLoading(false) }
    }

    const handleAddShipping = async () => {
        if (!newShipping.nome) return
        setLoading(true)
        const { error } = await supabase.from('transportadoras').insert([newShipping])
        if (!error) { setNewShipping({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', contato: '' }); await fetchData(); }
        else alert("Erro ao salvar transportadora: " + error.message)
        setLoading(false)
    }

    const handleAddSupplier = async () => {
        if (!newSupplier.nome) return
        setLoading(true)
        const { error } = await supabase.from('fornecedores').insert([newSupplier])
        if (!error) { setNewSupplier({ nome: '', razao_social: '', documento: '', inscricao_estadual: '', email: '', telefone: '' }); await fetchData(); }
        else alert("Erro ao salvar fornecedor: " + error.message)
        setLoading(false)
    }

    const handleAddCategory = async () => {
        if (!newCat.nome) return
        setLoading(true)

        let error;
        if (editingCatId) {
            const { error: err } = await supabase.from('categorias').update(newCat).eq('id', editingCatId)
            error = err
        } else {
            const { error: err } = await supabase.from('categorias').insert([newCat])
            error = err
        }

        if (!error) {
            setNewCat({ nome: '', largura_padrao: 0, altura_padrao: 0, comprimento_padrao: 0, peso_padrao: 0 });
            setEditingCatId(null)
            await fetchData();
        } else alert("Erro ao salvar categoria: " + error.message)
        setLoading(false)
    }

    const handleSaveFinanceCategory = async () => {
        if (!newFinCat) return
        setLoading(true)
        let error;
        if (editingFinCat) {
            const { error: err } = await supabase.from('financeiro_categorias').update({ nome: newFinCat }).eq('id', editingFinCat.id)
            error = err;
        } else {
            const { error: err } = await supabase.from('financeiro_categorias').insert([{ nome: newFinCat }])
            error = err;
        }

        if (!error) {
            setNewFinCat("");
            setEditingFinCat(null);
            setIsFinCatModalOpen(false);
            await fetchData();
        } else alert("Erro ao salvar categoria financeira: " + error.message)
        setLoading(false)
    }

    const handleSaveAtendente = async () => {
        if (!newAtendente.nome) return
        setLoading(true)
        let error;
        if (editingAtendente) {
            const { error: err } = await supabase.from('atendentes').update(newAtendente).eq('id', editingAtendente.id)
            error = err;
        } else {
            const { error: err } = await supabase.from('atendentes').insert([newAtendente])
            error = err;
        }

        if (!error) {
            setNewAtendente({
                nome: '',
                cargo: 'Vendedor',
                cor_identificacao: '#3b82f6',
                email: '',
                perm_vendas: true,
                perm_produtos: true,
                perm_financeiro: true,
                perm_fiscal: true,
                perm_caixa: true,
                perm_config: false
            });
            setEditingAtendente(null);
            setIsAtendenteModalOpen(false);
            await fetchData();
        } else alert("Erro ao salvar atendente: " + error.message)
        setLoading(false)
    }

    const handleSaveCompany = async () => {
        setLoading(true)
        const { error } = await supabase
            .from('configuracoes_empresa')
            .update(company)
            .eq('id', company.id)

        if (!error) alert("Dados da empresa salvos com sucesso!")
        else alert("Erro ao salvar: " + error.message)
        setLoading(false)
    }

    const handleAddLocation = async () => {
        if (!newLocation.nome || !newLocation.sigla) return alert("Nome e Sigla são obrigatórios");
        setLoading(true)
        const { error } = await supabase.from('localizacoes').insert([newLocation])
        if (!error) {
            setNewLocation({ nome: '', sigla: '', descricao: '', parent_id: null })
            await fetchData()
        } else alert("Erro ao salvar localização: " + error.message)
        setLoading(false)
    }

    const viewProductsInLocation = async (locId: string, locNome: string) => {
        setLoading(true)
        setViewingLocationName(locNome)
        const { data, error } = await supabase.from('produtos').select('sku, nome, estoque_atual').eq('localizacao_id', locId)
        if (!error) {
            setSelectedLocationProducts(data || [])
            setIsProductListModalOpen(true)
        }
        setLoading(false)
    }

    const handleMLConnect = async () => {
        if (!atendente?.id) return alert("Usuário não identificado.");
        setLoading(true);
        try {
            const apiBase = "http://localhost:8000"; // Ajuste conforme necessário
            const res = await fetch(`${apiBase}/api/integrations/ml/connect?x_system_user_id=${atendente.id}`);
            if (!res.ok) throw new Error("Erro ao gerar URL de conexão");
            const data = await res.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            }
        } catch (err: any) {
            alert("Erro ao conectar ML: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleMLRefresh = async (accountId: string) => {
        if (!atendente?.id) return;
        setLoading(true);
        try {
            const apiBase = "http://localhost:8000";
            const res = await fetch(`${apiBase}/api/integrations/ml/refresh?account_id=${accountId}&x_system_user_id=${atendente.id}`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error("Erro ao renovar token");
            await fetchData();
            alert("Token renovado com sucesso!");
        } catch (err: any) {
            alert("Erro ao renovar: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    const deleteItem = async (table: string, id: string) => {
        if (confirm("Deseja realmente excluir este item?")) {
            await supabase.from(table).delete().eq('id', id)
            fetchData()
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase">Configurações do Sistema</h1>
                <p className="text-muted-foreground mt-1">Gerencie cadastros base, logística e categorias financeiras.</p>
            </div>

            <Tabs defaultValue="shipping" className="space-y-4" onValueChange={setActiveTab}>
                <TabsList className="flex flex-wrap h-auto bg-muted/50 p-1 border border-border/50 gap-1">
                    <TabsTrigger value="shipping" className="gap-2 flex-grow sm:flex-grow-0"><Truck className="w-4 h-4" /> Transportadoras</TabsTrigger>
                    <TabsTrigger value="suppliers" className="gap-2 flex-grow sm:flex-grow-0"><Warehouse className="w-4 h-4" /> Fornecedores</TabsTrigger>
                    <TabsTrigger value="categories" className="gap-2 flex-grow sm:flex-grow-0"><Tags className="w-4 h-4" /> Categorias de Produtos</TabsTrigger>
                    <TabsTrigger value="finance" className="gap-2 flex-grow sm:flex-grow-0"><Wallet className="w-4 h-4" /> Categorias de Contas</TabsTrigger>
                    <TabsTrigger value="staff" className="gap-2 flex-grow sm:flex-grow-0"><Users className="w-4 h-4" /> Atendentes</TabsTrigger>
                    <TabsTrigger value="company" className="gap-2 flex-grow sm:flex-grow-0"><Save className="w-4 h-4" /> Dados da Empresa</TabsTrigger>
                    <TabsTrigger value="locations" className="gap-2 flex-grow sm:flex-grow-0"><MapPin className="w-4 h-4" /> Localizações (WMS)</TabsTrigger>
                    <TabsTrigger value="mercadolivre" className="gap-2 flex-grow sm:flex-grow-0 bg-yellow-400/10 text-yellow-700 data-[state=active]:bg-yellow-400 font-bold"><ShoppingCart className="w-4 h-4" /> Mercado Livre</TabsTrigger>
                    <TabsTrigger value="import" className="gap-2 flex-grow sm:flex-grow-0"><Database className="w-4 h-4" /> Importador Inteligente</TabsTrigger>
                </TabsList>

                {/* TRANSPORTADORAS */}
                <TabsContent value="shipping">
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                        <CardHeader>
                            <CardTitle className="text-emerald-500 flex items-center gap-2">
                                <Plus className="w-5 h-5" /> Cadastrar Transportadora
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Nome Fantasia</Label>
                                    <Input
                                        placeholder="Ex: Correios, Jadlog..."
                                        value={newShipping.nome}
                                        onChange={e => setNewShipping({ ...newShipping, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Razão Social</Label>
                                    <Input
                                        placeholder="Nome Legal"
                                        value={newShipping.razao_social}
                                        onChange={e => setNewShipping({ ...newShipping, razao_social: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>CPF / CNPJ</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            placeholder="00.000.000/0001-00"
                                            value={newShipping.documento}
                                            onChange={e => setNewShipping({ ...newShipping, documento: e.target.value })}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => searchCNPJGeneric(newShipping.documento, setNewShipping)}>
                                            <Search className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Inscrição Estadual</Label>
                                    <Input
                                        placeholder="IE"
                                        value={newShipping.inscricao_estadual}
                                        onChange={e => setNewShipping({ ...newShipping, inscricao_estadual: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Contato (Tel/Email)</Label>
                                    <Input
                                        placeholder="(00) 00000-0000"
                                        value={newShipping.contato}
                                        onChange={e => setNewShipping({ ...newShipping, contato: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddShipping} disabled={loading}>
                                <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Transportadora"}
                            </Button>

                            <div className="pt-4 border-t border-emerald-500/10">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>CNPJ/CPF</TableHead>
                                            <TableHead>Contato</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shipping.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-4">Nenhuma cadastrada</TableCell></TableRow> :
                                            shipping.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{item.nome}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{item.razao_social || "-"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs">{item.documento || "-"}</span>
                                                            <span className="text-[9px] text-muted-foreground">IE: {item.inscricao_estadual || "Isento"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{item.contato || "-"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => deleteItem('transportadoras', item.id)} className="text-destructive">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FORNECEDORES */}
                <TabsContent value="suppliers">
                    <Card className="border-blue-500/20 bg-blue-500/5">
                        <CardHeader>
                            <CardTitle className="text-blue-500">Gestão de Fornecedores</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Nome Fantasia</Label>
                                    <Input
                                        placeholder="Nome do Fornecedor"
                                        value={newSupplier.nome}
                                        onChange={e => setNewSupplier({ ...newSupplier, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Razão Social</Label>
                                    <Input
                                        placeholder="Nome Legal"
                                        value={newSupplier.razao_social}
                                        onChange={e => setNewSupplier({ ...newSupplier, razao_social: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>CPF / CNPJ</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            placeholder="Ex: 00.000.000/0001-00"
                                            value={newSupplier.documento}
                                            onChange={e => setNewSupplier({ ...newSupplier, documento: e.target.value })}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => searchCNPJGeneric(newSupplier.documento, setNewSupplier)}>
                                            <Search className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Inscrição Estadual</Label>
                                    <Input
                                        placeholder="IE"
                                        value={newSupplier.inscricao_estadual}
                                        onChange={e => setNewSupplier({ ...newSupplier, inscricao_estadual: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Telefone</Label>
                                    <Input
                                        placeholder="(00) 00000-0000"
                                        value={newSupplier.telefone}
                                        onChange={e => setNewSupplier({ ...newSupplier, telefone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail</Label>
                                    <Input
                                        placeholder="email@fornecedor.com"
                                        value={newSupplier.email}
                                        onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddSupplier} disabled={loading}>
                                <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Fornecedor"}
                            </Button>

                            <Table className="mt-4">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Documento</TableHead>
                                        <TableHead>Contato</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suppliers.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{item.nome}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{item.razao_social || "-"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs">{item.documento || "-"}</span>
                                                    <span className="text-[9px] text-muted-foreground">IE: {item.inscricao_estadual || "Isento"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs flex flex-col">
                                                <span>{item.telefone || ""}</span>
                                                <span className="opacity-50 italic">{item.email || ""}</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('fornecedores', item.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CATEGORIAS COM DIMENSÕES */}
                <TabsContent value="categories">
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardHeader>
                            <CardTitle className="text-amber-600 flex items-center justify-between">
                                <span>Categorias de Produtos</span>
                                <Badge variant="outline" className="border-amber-400 text-amber-600 font-black">Dimensões Padrão</Badge>
                            </CardTitle>
                            <CardDescription>Defina pesos e medidas automáticas para facilitar a logística.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-3 gap-4 p-4 border border-amber-500/10 rounded-xl bg-background/50">
                                <div className="col-span-3 space-y-2">
                                    <Label className="font-bold">Nome da Categoria</Label>
                                    <Input
                                        placeholder="Ex: Eletrônicos, Vestuário..."
                                        value={newCat.nome}
                                        onChange={e => setNewCat({ ...newCat, nome: e.target.value })}
                                        className="border-amber-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-amber-600">Largura (cm)</Label>
                                    <Input type="number" step="0.01" value={newCat.largura_padrao} onChange={e => setNewCat({ ...newCat, largura_padrao: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-amber-600">Altura (cm)</Label>
                                    <Input type="number" step="0.01" value={newCat.altura_padrao} onChange={e => setNewCat({ ...newCat, altura_padrao: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-amber-600">Compr. (cm)</Label>
                                    <Input type="number" step="0.01" value={newCat.comprimento_padrao} onChange={e => setNewCat({ ...newCat, comprimento_padrao: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-amber-600">Peso Padrão (kg)</Label>
                                    <Input type="number" step="0.001" value={newCat.peso_padrao} onChange={e => setNewCat({ ...newCat, peso_padrao: parseFloat(e.target.value) })} />
                                </div>
                                <div className="col-span-1 flex items-end">
                                    <Button className="w-full bg-amber-600 hover:bg-amber-700 font-bold" onClick={handleAddCategory}>
                                        <Plus className="w-4 h-4 mr-2" /> {editingCatId ? "Atualizar" : "Cadastrar"}
                                    </Button>
                                </div>
                                {editingCatId && (
                                    <div className="col-span-1 flex items-end">
                                        <Button variant="outline" className="w-full" onClick={() => {
                                            setEditingCatId(null)
                                            setNewCat({ nome: '', largura_padrao: 0, altura_padrao: 0, comprimento_padrao: 0, peso_padrao: 0 })
                                        }}>
                                            Cancelar
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead>Medidas (LxAxC)</TableHead>
                                        <TableHead>Peso</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-black text-amber-700">{item.nome}</TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                {item.largura_padrao} x {item.altura_padrao} x {item.comprimento_padrao} cm
                                            </TableCell>
                                            <TableCell className="text-xs font-bold">{item.peso_padrao} kg</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    setEditingCatId(item.id)
                                                    setNewCat({
                                                        nome: item.nome,
                                                        largura_padrao: item.largura_padrao,
                                                        altura_padrao: item.altura_padrao,
                                                        comprimento_padrao: item.comprimento_padrao,
                                                        peso_padrao: item.peso_padrao
                                                    })
                                                }} className="text-primary h-8 w-8">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('categorias', item.id)} className="text-destructive h-8 w-8">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CATEGORIAS FINANCEIRAS */}
                <TabsContent value="finance">
                    <Card className="border-purple-500/20 bg-purple-500/5">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-purple-500">Plano de Contas (Categorias Financeiras)</CardTitle>
                            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => {
                                setEditingFinCat(null);
                                setNewFinCat("");
                                setIsFinCatModalOpen(true);
                            }}>
                                <Plus className="w-4 h-4 mr-2" /> Nova Categoria
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <Label>Nome da Categoria de Gasto</Label>
                                    <Input
                                        placeholder="Ex: Marketing, Manutenção, Impostos..."
                                        value={newFinCat}
                                        onChange={e => setNewFinCat(e.target.value)}
                                    />
                                </div>
                                <Button className="mt-8 bg-purple-600 hover:bg-purple-700" onClick={handleSaveFinanceCategory} disabled={loading}>
                                    <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Adicionar Categoria"}
                                </Button>
                            </div>

                            <Table className="mt-4">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome da Categoria</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {financeCategories.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.nome}</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    setEditingFinCat(item);
                                                    setNewFinCat(item.nome);
                                                    setIsFinCatModalOpen(true);
                                                }}>
                                                    <Save className="w-4 h-4 text-primary" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('financeiro_categorias', item.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* ATENDENTES */}
                <TabsContent value="staff">
                    <Card className="border-rose-500/20 bg-rose-500/5">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-rose-600">Gestão de Atendentes Operacionais</CardTitle>
                                <CardDescription>Cadastre quem poderá receber lembretes e tarefas no sistema.</CardDescription>
                            </div>
                            <Button className="bg-rose-600 hover:bg-rose-700 font-bold" onClick={() => {
                                setEditingAtendente(null);
                                setNewAtendente({
                                    nome: '',
                                    cargo: 'Vendedor',
                                    cor_identificacao: '#3b82f6',
                                    email: '',
                                    perm_vendas: true,
                                    perm_produtos: true,
                                    perm_financeiro: true,
                                    perm_fiscal: true,
                                    perm_caixa: true,
                                    perm_config: false
                                });
                                setIsAtendenteModalOpen(true);
                            }}>
                                <Plus className="w-4 h-4 mr-2" /> Cadastrar Atendente
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Removed inline form as we are using Modal now */}

                            <Table className="mt-4">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Atendente</TableHead>
                                        <TableHead>Email/Login</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Cor</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {atendentes.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-bold flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.cor_identificacao }} />
                                                {item.nome}
                                            </TableCell>
                                            <TableCell className="text-[9px] text-muted-foreground font-mono">{(item as any).email || "Não vinculado"}</TableCell>
                                            <TableCell className="text-xs uppercase font-medium">{item.cargo || "-"}</TableCell>
                                            <TableCell className="font-mono text-[10px]">{item.cor_identificacao}</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    setEditingAtendente(item);
                                                    setNewAtendente({
                                                        nome: item.nome,
                                                        cargo: item.cargo,
                                                        cor_identificacao: item.cor_identificacao,
                                                        email: item.email || "",
                                                        perm_vendas: item.perm_vendas ?? true,
                                                        perm_produtos: item.perm_produtos ?? true,
                                                        perm_financeiro: item.perm_financeiro ?? true,
                                                        perm_fiscal: item.perm_fiscal ?? true,
                                                        perm_caixa: item.perm_caixa ?? true,
                                                        perm_config: item.perm_config ?? false
                                                    });
                                                    setIsAtendenteModalOpen(true);
                                                }}>
                                                    <Save className="w-4 h-4 text-primary" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('atendentes', item.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* EMPRESA */}
                <TabsContent value="company">
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-primary flex items-center gap-2">
                                <Save className="w-5 h-5" /> Informações da Empresa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label>Nome Fantasia</Label>
                                    <Input value={company.nome_fantasia} onChange={e => setCompany({ ...company, nome_fantasia: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Razão Social</Label>
                                    <Input value={company.razao_social} onChange={e => setCompany({ ...company, razao_social: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>CNPJ</Label>
                                    <div className="flex gap-2">
                                        <Input value={company.cnpj} onChange={e => setCompany({ ...company, cnpj: e.target.value })} />
                                        <Button variant="outline" size="icon" onClick={() => searchCNPJGeneric(company.cnpj, setCompany)}>
                                            <Search className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Inscrição Estadual</Label>
                                    <Input value={company.inscricao_estadual} onChange={e => setCompany({ ...company, inscricao_estadual: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail Corporativo</Label>
                                    <Input value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Telefone / WhatsApp</Label>
                                    <Input value={company.telefone} onChange={e => setCompany({ ...company, telefone: e.target.value })} />
                                </div>
                                <div className="lg:col-span-2 space-y-2">
                                    <Label>Endereço Completo</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input className="col-span-2" placeholder="Rua / Av" value={company.logradouro} onChange={e => setCompany({ ...company, logradouro: e.target.value })} />
                                        <Input placeholder="Nº" value={company.numero} onChange={e => setCompany({ ...company, numero: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>CEP</Label>
                                    <Input value={company.cep} onChange={e => setCompany({ ...company, cep: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Bairro</Label>
                                    <Input value={company.bairro} onChange={e => setCompany({ ...company, bairro: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cidade</Label>
                                    <Input value={company.cidade} onChange={e => setCompany({ ...company, cidade: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estado (UF)</Label>
                                    <Input value={company.estado} onChange={e => setCompany({ ...company, estado: e.target.value })} />
                                </div>
                                <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                    <Label>Mensagem no Rodapé do Pedido</Label>
                                    <Input placeholder="Ex: Obrigado pela preferência! Volte sempre." value={company.mensagem_rodape} onChange={e => setCompany({ ...company, mensagem_rodape: e.target.value })} />
                                </div>
                            </div>
                            <Button className="font-bold bg-primary hover:bg-primary/90" onClick={handleSaveCompany} disabled={loading}>
                                <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Configurações da Empresa"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* LOCALIZACOES (WMS) */}
                <TabsContent value="locations" className="space-y-4">
                    <Card className="border-orange-500/20 bg-orange-500/5">
                        <CardHeader>
                            <CardTitle className="text-orange-600 flex items-center gap-2">
                                <MapPin className="w-5 h-5" /> Estrutura de Armazenamento (WMS)
                            </CardTitle>
                            <CardDescription>Cadastre corredores, prateleiras, gavetas ou caixas de forma hierárquica.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-background/50 p-4 rounded-xl border border-orange-500/10">
                                <div className="md:col-span-1 space-y-2">
                                    <Label>Nome da Localização</Label>
                                    <Input
                                        placeholder="Ex: Corredor A"
                                        value={newLocation.nome}
                                        onChange={e => setNewLocation({ ...newLocation, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sigla</Label>
                                    <Input
                                        placeholder="Ex: COR-A"
                                        value={newLocation.sigla}
                                        onChange={e => setNewLocation({ ...newLocation, sigla: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Dentro de (Opcional)</Label>
                                    <Select
                                        value={newLocation.parent_id || ""}
                                        onChange={e => setNewLocation({ ...newLocation, parent_id: e.target.value || null })}
                                    >
                                        <option value="">-- Local Principal --</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.sigla})</option>)}
                                    </Select>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Descrição / Observações</Label>
                                    <Input
                                        placeholder="Detalhes sobre este local..."
                                        value={newLocation.descricao}
                                        onChange={e => setNewLocation({ ...newLocation, descricao: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Button className="w-full bg-orange-600 hover:bg-orange-700 font-bold" onClick={handleAddLocation}>
                                        <Plus className="w-4 h-4 mr-2" /> Cadastrar Localização
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {locations.filter(l => !l.parent_id).map(parent => (
                                    <Card key={parent.id} className="border-border/50 shadow-sm overflow-hidden group">
                                        <div className="p-4 bg-muted/30 flex items-center justify-between border-b">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 font-bold text-orange-700">
                                                    <Layers className="w-4 h-4" /> {parent.nome}
                                                </div>
                                                <span className="text-[10px] font-black text-orange-500">{parent.sigla}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600" onClick={() => viewProductsInLocation(parent.id, parent.nome)}><Search className="w-3.5 h-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem('localizacoes', parent.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </div>
                                        <div className="p-2 space-y-1 bg-white">
                                            {locations.filter(child => child.parent_id === parent.id).length === 0 && (
                                                <p className="text-[10px] text-muted-foreground italic p-2">Nenhuma sub-localização</p>
                                            )}
                                            {locations.filter(child => child.parent_id === parent.id).map(child => (
                                                <div key={child.id} className="flex items-center justify-between p-2 hover:bg-orange-50 rounded-lg group/item transition-colors">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <ChevronRight className="w-3 h-3 text-orange-400" />
                                                            <span className="font-medium">{child.nome}</span>
                                                        </div>
                                                        <span className="text-[9px] font-black text-orange-500 ml-5">{child.sigla}</span>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-600" onClick={() => viewProductsInLocation(child.id, child.nome)}><Search className="w-3 h-3" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteItem('localizacoes', child.id)}><Trash2 className="w-3 h-3" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* MERCADO LIVRE */}
                <TabsContent value="mercadolivre">
                    <Card className="border-yellow-500/20 bg-yellow-500/5">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-yellow-700 flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5" /> Integração Mercado Livre
                                </CardTitle>
                                <CardDescription>Conecte várias contas para gerenciar vendas e anúncios.</CardDescription>
                            </div>
                            <Button className="bg-yellow-500 hover:bg-yellow-600 font-bold text-yellow-950" onClick={handleMLConnect} disabled={loading}>
                                <Plus className="w-4 h-4 mr-2" /> Conectar Nova Conta
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Apelido / Conta</TableHead>
                                        <TableHead>ML User ID</TableHead>
                                        <TableHead>Expiração do Token</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mlAccounts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                Nenhuma conta conectada. Clique no botão acima para conectar.
                                            </TableCell>
                                        </TableRow>
                                    ) : mlAccounts.map(account => (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-black text-yellow-800 uppercase italic tracking-wider">
                                                {account.ml_nickname || "Sem apelido"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{account.ml_user_id}</TableCell>
                                            <TableCell className="text-xs">
                                                {new Date(account.token_expires_at).toLocaleString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={account.is_active ? "bg-emerald-500" : "bg-destructive"}>
                                                    {account.is_active ? "Ativa" : "Inativa"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold border-yellow-500/30 text-yellow-700" onClick={() => handleMLRefresh(account.id)}>
                                                    RENOVAR TOKEN
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem('mercadolivre_accounts', account.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* IMPORTADOR */}
                <TabsContent value="import">
                    <ImportadorInteligente />
                </TabsContent>
            </Tabs>

            {/* MODAL EDIT CATEGORIA FINANCEIRA */}
            {
                isFinCatModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-md shadow-2xl border-purple-500/20">
                            <CardHeader>
                                <CardTitle className="text-purple-500">{editingFinCat ? "Editar Categoria" : "Nova Categoria"}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome da Categoria</Label>
                                    <Input
                                        placeholder="Ex: Marketing, Aluguel..."
                                        value={newFinCat}
                                        onChange={e => setNewFinCat(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => setIsFinCatModalOpen(false)}>Cancelar</Button>
                                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSaveFinanceCategory} disabled={loading}>
                                        {loading ? "Salvando..." : "Salvar"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* MODAL EDIT ATENDENTE */}
            {
                isAtendenteModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-md shadow-2xl border-rose-500/20">
                            <CardHeader>
                                <CardTitle className="text-rose-600">{editingAtendente ? "Editar Atendente" : "Novo Atendente"}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome Completo</Label>
                                    <Input
                                        placeholder="Nome do Atendente"
                                        value={newAtendente.nome}
                                        onChange={e => setNewAtendente({ ...newAtendente, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cargo / Função</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newAtendente.cargo}
                                        onChange={e => {
                                            const role = e.target.value;
                                            let perms = { ...newAtendente, cargo: role };

                                            // Presets de Permissão por Cargo
                                            if (role === 'Administrador') {
                                                perms = { ...perms, perm_vendas: true, perm_produtos: true, perm_financeiro: true, perm_fiscal: true, perm_caixa: true, perm_config: true };
                                            } else if (role === 'Gerente') {
                                                perms = { ...perms, perm_vendas: true, perm_produtos: true, perm_financeiro: true, perm_fiscal: true, perm_caixa: true, perm_config: false };
                                            } else if (role === 'Vendedor') {
                                                perms = { ...perms, perm_vendas: true, perm_produtos: true, perm_financeiro: false, perm_fiscal: false, perm_caixa: false, perm_config: false };
                                            } else if (role === 'Caixa') {
                                                perms = { ...perms, perm_vendas: false, perm_produtos: false, perm_financeiro: true, perm_fiscal: false, perm_caixa: true, perm_config: false };
                                            } else if (role === 'Cadastrador') {
                                                perms = { ...perms, perm_vendas: false, perm_produtos: true, perm_financeiro: false, perm_fiscal: false, perm_caixa: false, perm_config: false };
                                            }

                                            setNewAtendente(perms);
                                        }}
                                    >
                                        <option value="Vendedor">Vendedor</option>
                                        <option value="Cadastrador">Cadastrador / Estoquista</option>
                                        <option value="Caixa">Operador de Caixa</option>
                                        <option value="Gerente">Gerente</option>
                                        <option value="Administrador">Administrador</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor de Identificação</Label>
                                    <Input
                                        type="color"
                                        className="h-10 p-1"
                                        value={newAtendente.cor_identificacao}
                                        onChange={e => setNewAtendente({ ...newAtendente, cor_identificacao: e.target.value })}
                                    />
                                </div>

                                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Permissões de Acesso</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { key: 'perm_vendas', label: 'Vendas' },
                                            { key: 'perm_produtos', label: 'Produtos' },
                                            { key: 'perm_financeiro', label: 'Financeiro' },
                                            { key: 'perm_fiscal', label: 'Fiscal' },
                                            { key: 'perm_caixa', label: 'Caixa' },
                                            { key: 'perm_config', label: 'Configurações' },
                                        ].map((perm) => (
                                            <div key={perm.key} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={perm.key}
                                                    checked={(newAtendente as any)[perm.key] ?? true}
                                                    onChange={(e) => setNewAtendente({ ...newAtendente, [perm.key]: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <Label htmlFor={perm.key} className="text-sm cursor-pointer">{perm.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t">
                                    <Label className="text-rose-600 font-bold">Vincular Login (E-mail)</Label>
                                    <Input
                                        type="email"
                                        placeholder="email@acesso.com"
                                        value={(newAtendente as any).email || ""}
                                        onChange={e => setNewAtendente({ ...newAtendente, email: e.target.value })}
                                    />
                                    <p className="text-[10px] text-muted-foreground">O funcionário usará este e-mail para logar. A senha deve ser definida no Supabase Auth.</p>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => setIsAtendenteModalOpen(false)}>Cancelar</Button>
                                    <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleSaveAtendente} disabled={loading}>
                                        {loading ? "Salvando..." : "Salvar"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* MODAL PRODUTOS NA LOCALIZACAO */}
            <Modal isOpen={isProductListModalOpen} onClose={() => setIsProductListModalOpen(false)} title={`Inventário: ${viewingLocationName}`}>
                <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedLocationProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            Nenhum produto vinculado a esta localização.
                                        </TableCell>
                                    </TableRow>
                                ) : selectedLocationProducts.map((p, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                                        <TableCell className="text-xs font-medium">{p.nome}</TableCell>
                                        <TableCell className="text-right font-bold text-orange-600">{p.estoque_atual}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => setIsProductListModalOpen(false)}>Fechar</Button>
                    </div>
                </div>
            </Modal>
        </div >
    )
}
