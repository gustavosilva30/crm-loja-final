import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Plus, Search, Trash2, Pencil, Package, Save, X, Car, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'

interface PecaCatalogo {
    id: string
    nome: string
    categoria_id: string | null
    preco_padrao: number
    custo_padrao: number
    marca_veiculo: string | null
    modelo_veiculo: string | null
    ano_inicio: number | null
    ano_fim: number | null
    motorizacao: string | null
    part_number: string | null
    imagem_url: string | null
    descricao: string | null
}

interface PecaCompatibilidade {
    id?: string
    peca_id: string
    marca: string
    modelo: string
    ano: string
    versao: string
}

export function Catalogo() {
    const [loading, setLoading] = useState(true)
    const [pecas, setPecas] = useState<PecaCatalogo[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCompatModalOpen, setIsCompatModalOpen] = useState(false)
    const [editingPeca, setEditingPeca] = useState<PecaCatalogo | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [categorias, setCategorias] = useState<any[]>([])
    const [marcas, setMarcas] = useState<any[]>([])
    const [modelos, setModelos] = useState<any[]>([])

    // Excel Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [importData, setImportData] = useState<any[]>([])
    const [importLoading, setImportLoading] = useState(false)

    const [formPeca, setFormPeca] = useState<any>({
        nome: '',
        categoria_id: '',
        preco_padrao: 0,
        custo_padrao: 0,
        marca_veiculo: '',
        modelo_veiculo: '',
        ano_inicio: new Date().getFullYear(),
        ano_fim: new Date().getFullYear(),
        motorizacao: '',
        part_number: '',
        descricao: ''
    })

    const [compatList, setCompatList] = useState<PecaCompatibilidade[]>([])
    const [newCompat, setNewCompat] = useState<any>({ marca: '', modelo: '', ano: '', versao: '' })

    const fetchPecas = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('pecas_catalogo')
                .select('*')
                .order('nome')
            if (error) throw error
            setPecas(data || [])
        } catch (err) {
            console.error('Error fetching catalog:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchCategorias = async () => {
        const { data } = await supabase.from('categorias').select('*').order('nome')
        if (data) setCategorias(data)
    }

    const fetchMarcas = async () => {
        const { data } = await supabase.from('veiculos_marcas').select('*').order('nome')
        if (data) setMarcas(data)
    }

    const fetchModelos = async () => {
        const { data } = await supabase.from('veiculos_modelos').select('*').order('nome')
        if (data) setModelos(data)
    }

    useEffect(() => {
        fetchPecas()
        fetchCategorias()
        fetchMarcas()
        fetchModelos()
    }, [])

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (evt) => {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: 'binary' })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const data = XLSX.utils.sheet_to_json(ws)
            setImportData(data)
            setIsImportModalOpen(true)
        }
        reader.readAsBinaryString(file)
    }

    const processImport = async () => {
        if (importData.length === 0) return
        setImportLoading(true)
        try {
            // Mapeamento inteligente
            const mappedData = importData.map(row => ({
                nome: row.Nome || row.nome || row.Descricao || row.descricao || 'Peça sem nome',
                categoria_id: findCategoryId(row.Categoria || row.categoria),
                preco_padrao: parseFloat(row.Preco || row.preco || row.Valor || row.valor || 0),
                custo_padrao: parseFloat(row.Custo || row.custo || 0),
                marca_veiculo: row.Marca || row.marca,
                modelo_veiculo: row.Modelo || row.modelo,
                ano_inicio: parseInt(row.AnoInicio || row.Ano_Inicio || row.Ano || 0),
                ano_fim: parseInt(row.AnoFim || row.Ano_Fim || row.Ano || 0),
                motorizacao: row.Motor || row.motor || row.Motorizacao,
                part_number: row.PartNumber || row.Part_Number || row.Codigo,
                descricao: row.Descricao_Detalhada || row.Obs || row.Observacao
            }))

            const { error } = await supabase.from('pecas_catalogo').insert(mappedData)
            if (error) throw error

            alert(`${mappedData.length} peças importadas com sucesso!`)
            setIsImportModalOpen(false)
            setImportData([])
            fetchPecas()
        } catch (err: any) {
            console.error('Error importing:', err)
            alert('Erro na importação: ' + err.message)
        } finally {
            setImportLoading(false)
        }
    }

    const findCategoryId = (nome: string) => {
        if (!nome) return null
        const cat = categorias.find(c => c.nome.toLowerCase() === nome.toLowerCase())
        return cat ? cat.id : null
    }

    const filteredPecas = useMemo(() => {
        return pecas.filter(p =>
            p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.modelo_veiculo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.part_number || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [pecas, searchTerm])

    const [isCatSubModalOpen, setIsCatSubModalOpen] = useState(false)
    const [newCat, setNewCat] = useState({
        nome: '',
        largura_padrao: 0,
        altura_padrao: 0,
        comprimento_padrao: 0,
        peso_padrao: 0
    })

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const handleSavePeca = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            let finalImageUrl = formPeca.imagem_url

            // Handle Image Upload
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `catalog-${Math.random()}.${fileExt}`
                const filePath = `catalog-templates/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('produtos')
                    .upload(filePath, selectedFile)

                if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

                const { data: { publicUrl } } = supabase.storage
                    .from('produtos')
                    .getPublicUrl(filePath)

                finalImageUrl = publicUrl
            }

            const dataToSave = {
                ...formPeca,
                imagem_url: finalImageUrl,
                categoria_id: formPeca.categoria_id || null
            }

            let pecaId = editingPeca?.id;
            if (editingPeca) {
                const { error } = await supabase.from('pecas_catalogo').update(dataToSave).eq('id', editingPeca.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('pecas_catalogo').insert([dataToSave]).select().single()
                if (error) throw error
                pecaId = data.id
            }

            // Save compatibilities
            if (pecaId) {
                await supabase.from('pecas_catalogo_compatibilidade').delete().eq('peca_id', pecaId)
                if (compatList.length > 0) {
                    const compatWithId = compatList.map(c => ({ ...c, peca_id: pecaId }))
                    await supabase.from('pecas_catalogo_compatibilidade').insert(compatWithId)
                }
            }

            setIsModalOpen(false)
            setSelectedFile(null)
            setImagePreview(null)
            fetchPecas()
        } catch (err: any) {
            alert(`Erro ao salvar: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleQuickSaveCategory = async () => {
        if (!newCat.nome) return
        const { data, error } = await supabase.from('categorias').insert([newCat]).select().single()
        if (!error && data) {
            await fetchCategorias()
            setFormPeca({ ...formPeca, categoria_id: data.id })
            setIsCatSubModalOpen(false)
            setNewCat({ nome: '', largura_padrao: 0, altura_padrao: 0, comprimento_padrao: 0, peso_padrao: 0 })
        } else {
            alert("Erro ao salvar categoria: " + error.message)
        }
    }

    const startEdit = async (peca: PecaCatalogo) => {
        setEditingPeca(peca)
        setFormPeca({ ...peca })
        setImagePreview(peca.imagem_url || null)
        setSelectedFile(null)

        const { data } = await supabase.from('pecas_catalogo_compatibilidade').select('*').eq('peca_id', peca.id)
        setCompatList(data || [])

        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta peça do catálogo?")) return
        const { error } = await supabase.from('pecas_catalogo').delete().eq('id', id)
        if (error) alert("Erro ao excluir")
        else fetchPecas()
    }

    const addCompat = () => {
        if (!newCompat.marca || !newCompat.modelo) return
        setCompatList([...compatList, { ...newCompat }])
        setNewCompat({ marca: '', modelo: '', ano: '', versao: '' })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Catálogo Master</h1>
                    <p className="text-muted-foreground mt-1">Gerencie os modelos de peças para agilizar o cadastro de estoque.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/5 font-semibold">
                            <FileSpreadsheet className="w-4 h-4" /> Importar Excel
                        </Button>
                    </div>
                    <Button className="gap-2 font-bold" onClick={() => {
                        setEditingPeca(null)
                        setFormPeca({
                            nome: '',
                            categoria_id: '',
                            preco_padrao: 0,
                            custo_padrao: 0,
                            marca_veiculo: '',
                            modelo_veiculo: '',
                            ano_inicio: 2000,
                            ano_fim: new Date().getFullYear(),
                            motorizacao: '',
                            part_number: '',
                            imagem_url: '',
                            descricao: ''
                        })
                        setCompatList([])
                        setImagePreview(null)
                        setSelectedFile(null)
                        setIsModalOpen(true)
                    }}>
                        <Plus className="w-4 h-4" /> Nova Peça Master
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome, modelo ou part number..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">Previa</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Veículo Base</TableHead>
                                <TableHead>Preço Padrão</TableHead>
                                <TableHead>Part Number</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell></TableRow>
                            ) : filteredPecas.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma peça encontrada.</TableCell></TableRow>
                            ) : filteredPecas.map((peca) => (
                                <TableRow key={peca.id}>
                                    <TableCell>
                                        <div className="w-10 h-10 rounded border bg-muted overflow-hidden flex items-center justify-center">
                                            {peca.imagem_url ? (
                                                <img src={peca.imagem_url} alt={peca.nome} className="w-full h-full object-contain" />
                                            ) : <Package className="w-5 h-5 text-muted-foreground/30" />}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{peca.nome}</TableCell>
                                    <TableCell>{peca.marca_veiculo} {peca.modelo_veiculo} ({peca.ano_inicio}-{peca.ano_fim})</TableCell>
                                    <TableCell>R$ {peca.preco_padrao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell>{peca.part_number || '-'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => startEdit(peca)}><Pencil className="w-4 h-4" /></Button>
                                        <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDelete(peca.id)}><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal
                title={editingPeca ? "Editar Peça Master" : "Nova Peça Master"}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                className="max-w-4xl"
            >
                <form onSubmit={handleSavePeca} className="space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                        {/* Image Upload Area */}
                        <div className="space-y-4">
                            <Label>Imagem Template</Label>
                            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/50 transition-colors relative h-48 flex flex-col items-center justify-center">
                                {imagePreview ? (
                                    <div className="relative w-full h-full group">
                                        <img src={imagePreview} className="w-full h-full object-contain" />
                                        <button
                                            type="button"
                                            onClick={() => { setImagePreview(null); setSelectedFile(null); }}
                                            className="absolute top-0 right-0 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    setSelectedFile(file)
                                                    setImagePreview(URL.createObjectURL(file))
                                                }
                                            }}
                                        />
                                        <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                                        <p className="text-xs text-muted-foreground">Adicionar Foto Template</p>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label>Nome da Peça (Ex: Parachoque Dianteiro Gol G5)</Label>
                                <Input
                                    required
                                    value={formPeca.nome}
                                    onChange={(e) => setFormPeca({ ...formPeca, nome: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Marca do Veículo</Label>
                                <Input
                                    value={formPeca.marca_veiculo}
                                    onChange={(e) => setFormPeca({ ...formPeca, marca_veiculo: e.target.value, modelo_veiculo: '' })}
                                    list="marcas-list"
                                />
                                <datalist id="marcas-list">
                                    {marcas.map(m => <option key={m.id} value={m.nome} />)}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <Label>Modelo do Veículo</Label>
                                <Input
                                    value={formPeca.modelo_veiculo}
                                    onChange={(e) => setFormPeca({ ...formPeca, modelo_veiculo: e.target.value })}
                                    disabled={!formPeca.marca_veiculo}
                                    placeholder={!formPeca.marca_veiculo ? "Selecione a marca primeiro" : ""}
                                    list="modelos-list"
                                />
                                <datalist id="modelos-list">
                                    {modelos
                                        .filter(m => !formPeca.marca_veiculo || marcas.find(brand => brand.nome === formPeca.marca_veiculo)?.id === m.marca_id)
                                        .map(m => <option key={m.id} value={m.nome} />)}
                                </datalist>
                            </div>

                            <div className="space-y-2">
                                <Label>Ano Início</Label>
                                <Input
                                    type="number"
                                    value={formPeca.ano_inicio}
                                    onChange={(e) => setFormPeca({ ...formPeca, ano_inicio: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Ano Fim</Label>
                                <Input
                                    type="number"
                                    value={formPeca.ano_fim}
                                    onChange={(e) => setFormPeca({ ...formPeca, ano_fim: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Preço Padrão (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formPeca.preco_padrao}
                                    onChange={(e) => setFormPeca({ ...formPeca, preco_padrao: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo Padrão (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formPeca.custo_padrao}
                                    onChange={(e) => setFormPeca({ ...formPeca, custo_padrao: parseFloat(e.target.value) })}
                                />
                            </div>

                            {/* Categorias com Cadastro Rápido */}
                            <div className="space-y-2 col-span-2">
                                <div className="flex items-center justify-between">
                                    <Label>Categoria</Label>
                                    <Button type="button" variant="link" className="h-auto p-0 text-xs font-black uppercase text-primary gap-1" onClick={() => setIsCatSubModalOpen(true)}>
                                        <Plus className="w-3 h-3" /> Nova Categoria
                                    </Button>
                                </div>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formPeca.categoria_id || ''}
                                    onChange={(e) => setFormPeca({ ...formPeca, categoria_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2 col-span-2">
                                <Label>Part Number</Label>
                                <Input
                                    value={formPeca.part_number}
                                    onChange={(e) => setFormPeca({ ...formPeca, part_number: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-lg font-bold border-b pb-2 block">Compatibilidades (Templates)</Label>
                        <div className="grid grid-cols-4 gap-2">
                            <Input
                                placeholder="Marca"
                                value={newCompat.marca}
                                onChange={e => setNewCompat({ ...newCompat, marca: e.target.value, modelo: '' })}
                                list="marcas-list"
                            />
                            <Input
                                placeholder="Modelo"
                                value={newCompat.modelo}
                                onChange={e => setNewCompat({ ...newCompat, modelo: e.target.value })}
                                disabled={!newCompat.marca}
                                list="modelos-compat-list"
                            />
                            <datalist id="modelos-compat-list">
                                {modelos
                                    .filter(m => !newCompat.marca || marcas.find(brand => brand.nome === newCompat.marca)?.id === m.marca_id)
                                    .map(m => <option key={m.id} value={m.nome} />)}
                            </datalist>
                            <Input placeholder="Ano" value={newCompat.ano} onChange={e => setNewCompat({ ...newCompat, ano: e.target.value })} />
                            <Button type="button" onClick={addCompat} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
                        </div>

                        <div className="border rounded-lg p-2 min-h-[100px] space-y-2">
                            {compatList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma compatibilidade adicionada.</p>}
                            {compatList.map((c, i) => (
                                <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                    <span>{c.marca} {c.modelo} {c.ano}</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setCompatList(compatList.filter((_, idx) => idx !== i))}>
                                        <X className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Salvando..." : "Salvar no Catálogo"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title="Nova Categoria"
                isOpen={isCatSubModalOpen}
                onClose={() => setIsCatSubModalOpen(false)}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome da Categoria (Ex: Parachoques)</Label>
                        <Input value={newCat.nome} onChange={e => setNewCat({ ...newCat, nome: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Largura (cm)</Label><Input type="number" value={newCat.largura_padrao} onChange={e => setNewCat({ ...newCat, largura_padrao: parseFloat(e.target.value) })} /></div>
                        <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" value={newCat.altura_padrao} onChange={e => setNewCat({ ...newCat, altura_padrao: parseFloat(e.target.value) })} /></div>
                        <div className="space-y-2"><Label>Comprimento (cm)</Label><Input type="number" value={newCat.comprimento_padrao} onChange={e => setNewCat({ ...newCat, comprimento_padrao: parseFloat(e.target.value) })} /></div>
                        <div className="space-y-2"><Label>Peso Padrão (kg)</Label><Input type="number" value={newCat.peso_padrao} onChange={e => setNewCat({ ...newCat, peso_padrao: parseFloat(e.target.value) })} /></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsCatSubModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleQuickSaveCategory}>Salvar Categoria</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Importação */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Peças (Planilha)" className="max-w-4xl">
                <div className="space-y-6">
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-full text-primary">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Validamos sua planilha!</h3>
                            <p className="text-xs text-muted-foreground">Encontramos **{importData.length}** registros para importar. Verifique o mapeamento antes de confirmar.</p>
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="text-[10px] uppercase font-bold">Nome</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Marca/Modelo</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Preço</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Part Number</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {importData.slice(0, 10).map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs">{row.Nome || row.nome || row.Descricao || row.descricao}</TableCell>
                                        <TableCell className="text-xs">{row.Marca || row.marca} {row.Modelo || row.modelo}</TableCell>
                                        <TableCell className="text-xs font-mono">R$ {row.Preco || row.preco || 0}</TableCell>
                                        <TableCell className="text-xs">{row.PartNumber || row.Part_Number || row.Codigo}</TableCell>
                                    </TableRow>
                                ))}
                                {importData.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-2 text-muted-foreground text-[10px] font-bold italic">
                                            + {importData.length - 10} registros ocultos na pré-visualização
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-primary">Dica de Cabeçalhos</p>
                            <p className="text-[10px] text-muted-foreground italic">
                                Use colunas com nomes como: **Nome, Categoria, Marca, Modelo, Preco, Custo, AnoInicio, AnoFim, Motor, PartNumber**.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportData([]); }}>Cancelar</Button>
                        <Button
                            className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 px-8"
                            onClick={processImport}
                            disabled={importLoading}
                        >
                            {importLoading ? "Importando..." : <><Upload className="w-4 h-4" /> Confirmar Importação</>}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
