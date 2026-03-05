import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import {
    Car, Plus, Search, ChevronLeft, Package, MapPin, DollarSign, Upload, X,
    Wrench, CheckCircle2, AlertCircle, RefreshCw, BarChart2, Camera, ExternalLink,
    Trash2, Pencil, ArrowRight, ClipboardList, Layers
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"

// ─── Types ───────────────────────────────────────────────────────────────────

type SucataStatus = "Aguardando" | "Em Desmontagem" | "Concluída" | "Alienada"
type PecaStatus = "Disponível" | "Cadastrada no Estoque" | "Vendida" | "Descartada"
type PecaCondicao = "Ótima" | "Boa" | "Regular" | "Danificada"

interface Sucata {
    id: string
    codigo: string
    status: SucataStatus
    placa: string | null
    chassi: string | null
    marca: string
    modelo: string
    ano_fabricacao: number | null
    ano_modelo: number | null
    cor: string | null
    combustivel: string | null
    km_entrada: number | null
    condicao: string | null
    data_compra: string
    valor_compra: number
    valor_frete: number
    outros_custos: number
    custo_total: number
    auction_lot_id: string | null
    local_armazenagem: string | null
    fotos: string[]
    observacoes: string | null
    responsavel_id: string | null
    created_at: string
    // Agregados do join
    pecas_count?: number
    pecas_disponiveis?: number
}

interface SucataPeca {
    id: string
    sucata_id: string
    produto_id: string | null
    nome: string
    descricao: string | null
    part_number: string | null
    condicao: PecaCondicao
    localizacao_id: string | null
    custo_estimado: number
    preco_venda: number
    status: PecaStatus
    fotos: string[]
    created_at: string
    localizacoes?: { nome: string; sigla: string | null }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    "Aguardando": "bg-slate-100 text-slate-600 border-slate-200",
    "Em Desmontagem": "bg-amber-100 text-amber-700 border-amber-200",
    "Concluída": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Alienada": "bg-rose-100 text-rose-700 border-rose-200"
}

const pecaStatusColors: Record<string, string> = {
    "Disponível": "bg-emerald-100 text-emerald-700",
    "Cadastrada no Estoque": "bg-blue-100 text-blue-700",
    "Vendida": "bg-purple-100 text-purple-700",
    "Descartada": "bg-slate-100 text-slate-500"
}

const condicaoColors: Record<string, string> = {
    "Ótima": "text-emerald-600",
    "Boa": "text-blue-600",
    "Regular": "text-amber-600",
    "Danificada": "text-rose-600"
}

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")

// ─── Blank forms ──────────────────────────────────────────────────────────────

const BLANK_SUCATA = {
    codigo: "",
    status: "Aguardando" as SucataStatus,
    placa: "", chassi: "", marca: "", modelo: "",
    ano_fabricacao: new Date().getFullYear(), ano_modelo: new Date().getFullYear(),
    cor: "", combustivel: "Flex", km_entrada: 0, condicao: "Batida",
    data_compra: new Date().toISOString().split("T")[0],
    valor_compra: 0, valor_frete: 0, outros_custos: 0,
    auction_lot_id: "", local_armazenagem: "", observacoes: ""
}

const BLANK_PECA = {
    nome: "", descricao: "", part_number: "", condicao: "Boa" as PecaCondicao,
    localizacao_id: "", custo_estimado: 0, preco_venda: 0, status: "Disponível" as PecaStatus
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function Sucatas() {
    const { atendente } = useAuthStore()

    // Data
    const [sucatas, setSucatas] = useState<Sucata[]>([])
    const [auctionLots, setAuctionLots] = useState<{ id: string; lot_number: string; lot_name: string }[]>([])
    const [locations, setLocations] = useState<{ id: string; nome: string; sigla: string | null; parent_id: string | null }[]>([])
    const [loading, setLoading] = useState(true)

    // View
    const [view, setView] = useState<"list" | "detail">("list")
    const [selectedSucata, setSelectedSucata] = useState<Sucata | null>(null)
    const [pecas, setPecas] = useState<SucataPeca[]>([])
    const [loadingPecas, setLoadingPecas] = useState(false)

    // Filters
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("todos")

    // Modals
    const [isSucataModalOpen, setIsSucataModalOpen] = useState(false)
    const [isPecaModalOpen, setIsPecaModalOpen] = useState(false)
    const [editingSucata, setEditingSucata] = useState<Sucata | null>(null)
    const [editingPeca, setEditingPeca] = useState<SucataPeca | null>(null)
    const [sucataForm, setSucataForm] = useState<any>(BLANK_SUCATA)
    const [pecaForm, setPecaForm] = useState<any>(BLANK_PECA)
    const [submitting, setSubmitting] = useState(false)

    // ── Fetchers ────────────────────────────────────────────────────────────────

    const fetchSucatas = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from("sucatas")
                .select(`*, sucatas_pecas(id, status)`)
                .order("created_at", { ascending: false })

            if (data) {
                setSucatas(data.map((s: any) => ({
                    ...s,
                    pecas_count: s.sucatas_pecas?.length || 0,
                    pecas_disponiveis: s.sucatas_pecas?.filter((p: any) => p.status === "Disponível").length || 0
                })))
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchResources = async () => {
        const [{ data: lots }, { data: locs }] = await Promise.all([
            supabase.from("auction_lots").select("id, lot_number, lot_name").order("lot_number"),
            supabase.from("localizacoes").select("id, nome, sigla, parent_id").order("nome")
        ])
        if (lots) setAuctionLots(lots)
        if (locs) setLocations(locs)
    }

    const fetchPecas = useCallback(async (sucataId: string) => {
        setLoadingPecas(true)
        try {
            const { data } = await supabase
                .from("sucatas_pecas")
                .select(`*, localizacoes(nome, sigla)`)
                .eq("sucata_id", sucataId)
                .order("created_at", { ascending: false })
            if (data) setPecas(data)
        } catch (e) { console.error(e) }
        finally { setLoadingPecas(false) }
    }, [])

    useEffect(() => {
        fetchSucatas()
        fetchResources()
    }, [])

    // ── Computed ─────────────────────────────────────────────────────────────────

    const filtered = useMemo(() => sucatas.filter(s => {
        const term = search.toLowerCase()
        const matchSearch = !search ||
            s.codigo.toLowerCase().includes(term) ||
            s.marca.toLowerCase().includes(term) ||
            s.modelo.toLowerCase().includes(term) ||
            (s.placa || "").toLowerCase().includes(term)
        const matchStatus = filterStatus === "todos" || s.status === filterStatus
        return matchSearch && matchStatus
    }), [sucatas, search, filterStatus])

    const stats = useMemo(() => ({
        total: sucatas.length,
        ativas: sucatas.filter(s => s.status === "Em Desmontagem").length,
        custo: sucatas.reduce((a, s) => a + (s.custo_total || 0), 0),
        pecas: sucatas.reduce((a, s) => a + (s.pecas_count || 0), 0)
    }), [sucatas])

    // ── SUCATA CRUD ─────────────────────────────────────────────────────────────

    const openNewSucata = () => {
        setEditingSucata(null)
        setSucataForm({ ...BLANK_SUCATA })
        setIsSucataModalOpen(true)
    }

    const openEditSucata = (s: Sucata) => {
        setEditingSucata(s)
        setSucataForm({
            codigo: s.codigo,
            status: s.status,
            placa: s.placa || "",
            chassi: s.chassi || "",
            marca: s.marca,
            modelo: s.modelo,
            ano_fabricacao: s.ano_fabricacao || new Date().getFullYear(),
            ano_modelo: s.ano_modelo || new Date().getFullYear(),
            cor: s.cor || "",
            combustivel: s.combustivel || "Flex",
            km_entrada: s.km_entrada || 0,
            condicao: s.condicao || "Batida",
            data_compra: s.data_compra,
            valor_compra: s.valor_compra,
            valor_frete: s.valor_frete,
            outros_custos: s.outros_custos,
            auction_lot_id: s.auction_lot_id || "",
            local_armazenagem: s.local_armazenagem || "",
            observacoes: s.observacoes || ""
        })
        setIsSucataModalOpen(true)
    }

    const handleSaveSucata = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!sucataForm.marca || !sucataForm.modelo) return alert("Marca e modelo são obrigatórios.")
        setSubmitting(true)
        try {
            const payload = {
                ...sucataForm,
                codigo: sucataForm.codigo || undefined,
                placa: sucataForm.placa || null,
                chassi: sucataForm.chassi || null,
                cor: sucataForm.cor || null,
                local_armazenagem: sucataForm.local_armazenagem || null,
                observacoes: sucataForm.observacoes || null,
                auction_lot_id: sucataForm.auction_lot_id || null,
                responsavel_id: atendente?.id || null,
                valor_compra: parseFloat(sucataForm.valor_compra) || 0,
                valor_frete: parseFloat(sucataForm.valor_frete) || 0,
                outros_custos: parseFloat(sucataForm.outros_custos) || 0,
            }

            if (editingSucata) {
                const { error } = await supabase.from("sucatas").update(payload).eq("id", editingSucata.id)
                if (error) throw error
            } else {
                const { data: saved, error } = await supabase.from("sucatas").insert([payload]).select().single()
                if (error) throw error

                // Launch automatic financial entry for the purchase
                if (saved) {
                    await supabase.from("financeiro_lancamentos").insert([{
                        tipo: "Despesa",
                        descricao: `Compra de Sucata: ${saved.codigo} — ${saved.marca} ${saved.modelo} ${saved.ano_modelo || ""}`,
                        valor: saved.custo_total,
                        data_vencimento: saved.data_compra,
                        data_pagamento: saved.data_compra,
                        status: "Pago",
                        forma_pagamento: "Outros"
                    }])
                }
            }

            setIsSucataModalOpen(false)
            await fetchSucatas()
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteSucata = async (id: string) => {
        if (!confirm("Deseja excluir esta sucata e todas as suas peças?")) return
        const { error } = await supabase.from("sucatas").delete().eq("id", id)
        if (error) alert("Erro: " + error.message)
        else fetchSucatas()
    }

    const openDetail = (s: Sucata) => {
        setSelectedSucata(s)
        setView("detail")
        fetchPecas(s.id)
    }

    // ── PECA CRUD ───────────────────────────────────────────────────────────────

    const openNewPeca = () => {
        setEditingPeca(null)
        // Suggest cost: custo_total / (pecas.length + 1)
        const suggestedCost = selectedSucata && (pecas.length + 1) > 0
            ? Math.round(selectedSucata.custo_total / (pecas.length + 1) * 100) / 100
            : 0
        setPecaForm({ ...BLANK_PECA, custo_estimado: suggestedCost })
        setIsPecaModalOpen(true)
    }

    const openEditPeca = (p: SucataPeca) => {
        setEditingPeca(p)
        setPecaForm({
            nome: p.nome, descricao: p.descricao || "", part_number: p.part_number || "",
            condicao: p.condicao, localizacao_id: p.localizacao_id || "",
            custo_estimado: p.custo_estimado, preco_venda: p.preco_venda, status: p.status
        })
        setIsPecaModalOpen(true)
    }

    const handleSavePeca = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pecaForm.nome || !selectedSucata) return
        setSubmitting(true)
        try {
            const payload = {
                sucata_id: selectedSucata.id,
                nome: pecaForm.nome,
                descricao: pecaForm.descricao || null,
                part_number: pecaForm.part_number || null,
                condicao: pecaForm.condicao,
                localizacao_id: pecaForm.localizacao_id || null,
                custo_estimado: parseFloat(pecaForm.custo_estimado) || 0,
                preco_venda: parseFloat(pecaForm.preco_venda) || 0,
                status: pecaForm.status
            }

            if (editingPeca) {
                const { error } = await supabase.from("sucatas_pecas").update(payload).eq("id", editingPeca.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from("sucatas_pecas").insert([payload])
                if (error) throw error
                // Update sucata status to Em Desmontagem automatically
                if (selectedSucata.status === "Aguardando") {
                    await supabase.from("sucatas").update({ status: "Em Desmontagem" }).eq("id", selectedSucata.id)
                    setSelectedSucata(prev => prev ? { ...prev, status: "Em Desmontagem" } : prev)
                }
            }

            setIsPecaModalOpen(false)
            await fetchPecas(selectedSucata.id)
            await fetchSucatas()
        } catch (e: any) {
            alert("Erro ao salvar peça: " + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeletePeca = async (id: string) => {
        if (!confirm("Excluir esta peça?")) return
        const { error } = await supabase.from("sucatas_pecas").delete().eq("id", id)
        if (error) alert("Erro: " + error.message)
        else {
            await fetchPecas(selectedSucata!.id)
            await fetchSucatas()
        }
    }

    // ── Cadastrar Peça no Estoque ────────────────────────────────────────────────

    const handleAddPecaToEstoque = async (peca: SucataPeca) => {
        if (!selectedSucata) return
        if (!confirm(`Cadastrar "${peca.nome}" como produto no estoque?`)) return

        setSubmitting(true)
        try {
            // Build SKU: SUC-[sucata_code]-[seq]
            const sku = `${selectedSucata.codigo}-${Date.now().toString().slice(-5)}`

            const { data: prod, error: prodError } = await supabase
                .from("produtos")
                .insert([{
                    sku,
                    nome: peca.nome,
                    descricao: peca.descricao || `Peça desmontada da sucata ${selectedSucata.codigo} — ${selectedSucata.marca} ${selectedSucata.modelo} ${selectedSucata.ano_modelo || ""}`,
                    part_number: peca.part_number || null,
                    custo: peca.custo_estimado,
                    preco: peca.preco_venda || Math.round(peca.custo_estimado * 1.5 * 100) / 100,
                    estoque_atual: 1,
                    estoque_minimo: 0,
                    marca: selectedSucata.marca,
                    modelo: selectedSucata.modelo,
                    ano: selectedSucata.ano_modelo,
                    qualidade: peca.condicao === "Ótima" ? "A" : peca.condicao === "Boa" ? "B" : peca.condicao === "Regular" ? "C" : "D",
                    origem: "Sucata",
                    localizacao_id: peca.localizacao_id || null,
                    codigo_etiqueta: sku,
                    ativo: true,
                    responsavel_id: atendente?.id || null
                }])
                .select()
                .single()

            if (prodError) throw prodError

            // Link the part to the product
            const { error: updateError } = await supabase
                .from("sucatas_pecas")
                .update({ produto_id: prod.id, status: "Cadastrada no Estoque" })
                .eq("id", peca.id)

            if (updateError) throw updateError

            alert(`✅ Peça cadastrada no estoque!\nSKU: ${sku}\nAcesse Estoque para ver e imprimir a etiqueta.`)
            await fetchPecas(selectedSucata.id)
        } catch (e: any) {
            alert("Erro ao cadastrar no estoque: " + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    // ── Rentabilidade do veículo ─────────────────────────────────────────────────

    const rentabilidade = useMemo(() => {
        if (!selectedSucata) return null
        const receitaEstimada = pecas.reduce((a, p) => a + (p.preco_venda || 0), 0)
        const custo = selectedSucata.custo_total || 0
        const margem = custo > 0 ? ((receitaEstimada - custo) / custo) * 100 : 0
        return { receitaEstimada, custo, margem }
    }, [selectedSucata, pecas])

    // ── Location helper ──────────────────────────────────────────────────────────

    const getLocLabel = (locId: string | null) => {
        if (!locId) return "—"
        const loc = locations.find(l => l.id === locId)
        if (!loc) return "—"
        const parent = locations.find(l => l.id === loc.parent_id)
        return parent ? `${parent.sigla || parent.nome} › ${loc.sigla || loc.nome}` : (loc.sigla || loc.nome)
    }

    // ────────────────────────────────────────────────────────────────────────────
    // RENDER — DETAIL VIEW
    // ────────────────────────────────────────────────────────────────────────────

    if (view === "detail" && selectedSucata) {
        const progressPct = selectedSucata.pecas_count
            ? Math.round((pecas.filter(p => p.status !== "Disponível").length / pecas.length) * 100)
            : 0

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => { setView("list"); setSelectedSucata(null) }}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight">{selectedSucata.codigo}</h1>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColors[selectedSucata.status]}`}>
                                {selectedSucata.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            {selectedSucata.marca} {selectedSucata.modelo} {selectedSucata.ano_modelo || ""}
                            {selectedSucata.placa ? ` · ${selectedSucata.placa}` : ""}
                        </p>
                    </div>
                    <Button className="gap-2" onClick={openNewPeca}>
                        <Plus className="w-4 h-4" /> Registrar Peça
                    </Button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Vehicle info */}
                    <Card className="md:col-span-2">
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                {[
                                    ["Custo de Compra", fmtMoney(selectedSucata.valor_compra)],
                                    ["Frete", fmtMoney(selectedSucata.valor_frete)],
                                    ["Custo Total", fmtMoney(selectedSucata.custo_total)],
                                    ["Comprado em", fmtDate(selectedSucata.data_compra)],
                                    ["Condição", selectedSucata.condicao || "—"],
                                    ["KM Entrada", selectedSucata.km_entrada?.toLocaleString("pt-BR") || "—"],
                                ].map(([label, value]) => (
                                    <div key={label} className="p-3 rounded-xl bg-muted/40 border border-border/50">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{label}</p>
                                        <p className="font-bold text-sm">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Progress bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
                                    <span>Progresso de Desmontagem</span>
                                    <span>{pecas.filter(p => p.status !== "Disponível").length}/{pecas.length} peças</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rentabilidade */}
                    {rentabilidade && (
                        <Card className={rentabilidade.margem >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-rose-200 bg-rose-50/30"}>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-primary" /> Rentabilidade Projetada
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Investimento</span>
                                    <span className="font-bold text-rose-600">{fmtMoney(rentabilidade.custo)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Receita Estimada</span>
                                    <span className="font-bold text-emerald-600">{fmtMoney(rentabilidade.receitaEstimada)}</span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                                    <span className="font-bold">Margem</span>
                                    <span className={`font-black text-base ${rentabilidade.margem >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {rentabilidade.margem >= 0 ? "+" : ""}{rentabilidade.margem.toFixed(1)}%
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Parts list */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Peças Registradas ({pecas.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingPecas ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando peças...
                            </div>
                        ) : pecas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
                                <Wrench className="w-12 h-12 opacity-20" />
                                <p className="text-sm">Nenhuma peça registrada ainda.</p>
                                <Button variant="outline" size="sm" onClick={openNewPeca} className="gap-2">
                                    <Plus className="w-4 h-4" /> Registrar primeira peça
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pecas.map(p => (
                                    <div key={p.id} className="flex items-start gap-4 px-4 py-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm">{p.nome}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pecaStatusColors[p.status]}`}>
                                                    {p.status}
                                                </span>
                                                <span className={`text-[10px] font-bold ${condicaoColors[p.condicao]}`}>
                                                    {p.condicao}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                                                {p.part_number && <span className="font-mono">PN: {p.part_number}</span>}
                                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{getLocLabel(p.localizacao_id)}</span>
                                                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />Custo: {fmtMoney(p.custo_estimado)}</span>
                                                <span className="font-bold text-foreground">Venda: {fmtMoney(p.preco_venda)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {p.status === "Disponível" && !p.produto_id && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                                    onClick={() => handleAddPecaToEstoque(p)}
                                                    disabled={submitting}
                                                >
                                                    <Package className="w-3.5 h-3.5" /> → Estoque
                                                </Button>
                                            )}
                                            <Button size="sm" variant="ghost" onClick={() => openEditPeca(p)} className="h-8 w-8 p-0">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeletePeca(p.id)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Modal: Add/Edit Peça */}
                <Modal
                    isOpen={isPecaModalOpen}
                    onClose={() => setIsPecaModalOpen(false)}
                    title={editingPeca ? "Editar Peça" : "Registrar Nova Peça"}
                    className="max-w-lg"
                >
                    <form onSubmit={handleSavePeca} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <Label>Nome da Peça *</Label>
                                <Input placeholder="Ex: Motor de Partida" value={pecaForm.nome}
                                    onChange={e => setPecaForm({ ...pecaForm, nome: e.target.value })} required />
                            </div>
                            <div className="space-y-1">
                                <Label>Part Number</Label>
                                <Input placeholder="12345-67890" value={pecaForm.part_number}
                                    onChange={e => setPecaForm({ ...pecaForm, part_number: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Condição</Label>
                                <Select value={pecaForm.condicao} onChange={e => setPecaForm({ ...pecaForm, condicao: e.target.value })}>
                                    {["Ótima", "Boa", "Regular", "Danificada"].map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Custo Estimado (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={pecaForm.custo_estimado}
                                    onChange={e => setPecaForm({ ...pecaForm, custo_estimado: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Preço de Venda (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={pecaForm.preco_venda}
                                    onChange={e => setPecaForm({ ...pecaForm, preco_venda: e.target.value })} />
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label>Localização (WMS)</Label>
                                <Select value={pecaForm.localizacao_id} onChange={e => setPecaForm({ ...pecaForm, localizacao_id: e.target.value })}>
                                    <option value="">Sem localização</option>
                                    {locations.map(l => (
                                        <option key={l.id} value={l.id}>{l.sigla || l.nome} — {l.nome}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label>Status</Label>
                                <Select value={pecaForm.status} onChange={e => setPecaForm({ ...pecaForm, status: e.target.value })}>
                                    {["Disponível", "Cadastrada no Estoque", "Vendida", "Descartada"].map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label>Descrição</Label>
                                <textarea
                                    className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Detalhes adicionais..."
                                    value={pecaForm.descricao}
                                    onChange={e => setPecaForm({ ...pecaForm, descricao: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPecaModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>
                                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {editingPeca ? " Atualizar" : " Registrar"}
                            </Button>
                        </div>
                    </form>
                </Modal>
            </div>
        )
    }

    // ────────────────────────────────────────────────────────────────────────────
    // RENDER — LIST VIEW
    // ────────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Car className="w-8 h-8 text-primary" /> Sucatas
                    </h1>
                    <p className="text-muted-foreground mt-1">Gestão de veículos comprados em leilão e suas peças desmontadas.</p>
                </div>
                <Button className="gap-2" onClick={openNewSucata}>
                    <Plus className="w-4 h-4" /> Nova Sucata
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total de Sucatas", value: stats.total, icon: Car, color: "text-blue-500" },
                    { label: "Em Desmontagem", value: stats.ativas, icon: Wrench, color: "text-amber-500" },
                    { label: "Custo Total", value: fmtMoney(stats.custo), icon: DollarSign, color: "text-rose-500" },
                    { label: "Peças Registradas", value: stats.pecas, icon: Layers, color: "text-emerald-500" },
                ].map(s => (
                    <Card key={s.label} className="hover:shadow-sm transition-shadow">
                        <CardContent className="pt-4 flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="font-bold text-lg leading-tight">{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por código, marca, modelo, placa..." className="pl-9"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="todos">Todos os Status</option>
                    {["Aguardando", "Em Desmontagem", "Concluída", "Alienada"].map(s =>
                        <option key={s} value={s}>{s}</option>
                    )}
                </Select>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" /> Carregando sucatas...
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                    <Car className="w-16 h-16 opacity-15" />
                    <p className="text-sm">Nenhuma sucata encontrada.</p>
                    <Button variant="outline" onClick={openNewSucata} className="gap-2">
                        <Plus className="w-4 h-4" /> Cadastrar primeira sucata
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(s => {
                        const pct = s.pecas_count ? Math.round(((s.pecas_count - (s.pecas_disponiveis || 0)) / s.pecas_count) * 100) : 0
                        return (
                            <Card key={s.id} className="flex flex-col hover:shadow-md transition-shadow border border-border">
                                <CardHeader className="pb-2 pt-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-base">{s.codigo}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[s.status]}`}>
                                                    {s.status}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold mt-0.5">
                                                {s.marca} {s.modelo} {s.ano_modelo || ""}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {s.placa || "S/ Placa"} · {s.cor || "—"} · {s.combustivel || "—"}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-muted-foreground">Custo total</p>
                                            <p className="font-bold text-sm text-rose-600">{fmtMoney(s.custo_total)}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-3 pb-4">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>Comprado: {fmtDate(s.data_compra)}</span>
                                        {s.condicao && <span className="text-foreground font-medium">{s.condicao}</span>}
                                    </div>

                                    {/* Desmontagem progress */}
                                    <div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Progresso</span>
                                            <span className="font-bold">{s.pecas_count} peças</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" variant="outline" className="flex-1 gap-2 text-xs" onClick={() => openEditSucata(s)}>
                                            <Pencil className="w-3 h-3" /> Editar
                                        </Button>
                                        <Button size="sm" className="flex-1 gap-2 text-xs" onClick={() => openDetail(s)}>
                                            <Wrench className="w-3 h-3" /> Gerenciar Peças
                                            <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal: Add/Edit Sucata */}
            <Modal
                isOpen={isSucataModalOpen}
                onClose={() => setIsSucataModalOpen(false)}
                title={editingSucata ? `Editar ${editingSucata.codigo}` : "Cadastrar Nova Sucata"}
                className="max-w-2xl"
            >
                <form onSubmit={handleSaveSucata} className="space-y-5">
                    {/* Section: Veiculo */}
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1">
                            <Car className="w-3 h-3" /> Dados do Veículo
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Marca *</Label>
                                <Input value={sucataForm.marca} onChange={e => setSucataForm({ ...sucataForm, marca: e.target.value })} placeholder="Fiat, VW, Ford..." required />
                            </div>
                            <div className="space-y-1">
                                <Label>Modelo *</Label>
                                <Input value={sucataForm.modelo} onChange={e => setSucataForm({ ...sucataForm, modelo: e.target.value })} placeholder="Palio, Gol, Ka..." required />
                            </div>
                            <div className="space-y-1">
                                <Label>Ano Fabricação</Label>
                                <Input type="number" min="1950" max="2099" value={sucataForm.ano_fabricacao} onChange={e => setSucataForm({ ...sucataForm, ano_fabricacao: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Ano Modelo</Label>
                                <Input type="number" min="1950" max="2099" value={sucataForm.ano_modelo} onChange={e => setSucataForm({ ...sucataForm, ano_modelo: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Placa</Label>
                                <Input value={sucataForm.placa} onChange={e => setSucataForm({ ...sucataForm, placa: e.target.value })} placeholder="ABC-1234" />
                            </div>
                            <div className="space-y-1">
                                <Label>Chassi / RENAVAM</Label>
                                <Input value={sucataForm.chassi} onChange={e => setSucataForm({ ...sucataForm, chassi: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Cor</Label>
                                <Input value={sucataForm.cor} onChange={e => setSucataForm({ ...sucataForm, cor: e.target.value })} placeholder="Branco, Prata..." />
                            </div>
                            <div className="space-y-1">
                                <Label>Combustível</Label>
                                <Select value={sucataForm.combustivel} onChange={e => setSucataForm({ ...sucataForm, combustivel: e.target.value })}>
                                    {["Flex", "Gasolina", "Diesel", "Elétrico", "GNV", "Híbrido"].map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>KM na Entrada</Label>
                                <Input type="number" min="0" value={sucataForm.km_entrada} onChange={e => setSucataForm({ ...sucataForm, km_entrada: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Condição</Label>
                                <Select value={sucataForm.condicao} onChange={e => setSucataForm({ ...sucataForm, condicao: e.target.value })}>
                                    {["Batida", "Queimada", "Afogada", "Desmontada", "Outros"].map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Section: Compra */}
                    <div className="border-t border-border pt-4">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Dados da Compra
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Data da Compra</Label>
                                <Input type="date" value={sucataForm.data_compra} onChange={e => setSucataForm({ ...sucataForm, data_compra: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Status</Label>
                                <Select value={sucataForm.status} onChange={e => setSucataForm({ ...sucataForm, status: e.target.value })}>
                                    {["Aguardando", "Em Desmontagem", "Concluída", "Alienada"].map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Valor de Compra (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={sucataForm.valor_compra} onChange={e => setSucataForm({ ...sucataForm, valor_compra: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Frete (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={sucataForm.valor_frete} onChange={e => setSucataForm({ ...sucataForm, valor_frete: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Outros Custos (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={sucataForm.outros_custos} onChange={e => setSucataForm({ ...sucataForm, outros_custos: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Custo Total Estimado</Label>
                                <div className="h-9 flex items-center px-3 rounded-md bg-muted border border-input text-sm font-bold text-primary">
                                    {fmtMoney(
                                        (parseFloat(sucataForm.valor_compra) || 0) +
                                        (parseFloat(sucataForm.valor_frete) || 0) +
                                        (parseFloat(sucataForm.outros_custos) || 0)
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label>Lote de Leilão (opcional)</Label>
                                <Select value={sucataForm.auction_lot_id} onChange={e => setSucataForm({ ...sucataForm, auction_lot_id: e.target.value })}>
                                    <option value="">Sem vínculo</option>
                                    {auctionLots.map(l => (
                                        <option key={l.id} value={l.id}>#{l.lot_number} — {l.lot_name}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label>Local de Armazenagem</Label>
                                <Input value={sucataForm.local_armazenagem} onChange={e => setSucataForm({ ...sucataForm, local_armazenagem: e.target.value })} placeholder="Pátio A, Box 3..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 border-t border-border pt-4">
                        <Label>Observações</Label>
                        <textarea
                            className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Informações adicionais sobre o veículo..."
                            value={sucataForm.observacoes}
                            onChange={e => setSucataForm({ ...sucataForm, observacoes: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setIsSucataModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="flex-1" disabled={submitting}>
                            {submitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {editingSucata ? "Salvar Alterações" : "Cadastrar Sucata"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
