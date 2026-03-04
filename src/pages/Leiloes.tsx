import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import {
    Search, Plus, ExternalLink, Gavel, Globe, Filter,
    RefreshCcw, X, Building2, Calendar, Tag, Pencil, Trash2
} from "lucide-react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuctionSource {
    id: string
    name: string
    source_url: string
    is_active: boolean
    notes: string | null
    created_at: string
}

interface AuctionLot {
    id: string
    source_id: string | null
    lot_number: string
    lot_name: string
    city: string | null
    auction_start_at: string | null
    auction_end_at: string | null
    lot_url: string
    scrap_type: "aproveitavel" | "inservivel"
    created_at: string
    auction_sources?: { name: string; source_url: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const ScrapBadge = ({ type }: { type: string }) =>
    type === "aproveitavel" ? (
        <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] font-bold">
            ✅ Aproveitável
        </Badge>
    ) : (
        <Badge className="bg-rose-500/15 text-rose-600 border border-rose-500/30 text-[10px] font-bold">
            ☠️ Inservível
        </Badge>
    )

// ─── Component ────────────────────────────────────────────────────────────────

export function Leiloes() {
    const [activeTab, setActiveTab] = useState<"lots" | "sources">("lots")

    // ── Lotes ──────────────────────────────────────────────────────────────────
    const [lots, setLots] = useState<AuctionLot[]>([])
    const [loadingLots, setLoadingLots] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterScrap, setFilterScrap] = useState<string>("all")
    const [filterSource, setFilterSource] = useState<string>("all")

    // ── Fontes ─────────────────────────────────────────────────────────────────
    const [sources, setSources] = useState<AuctionSource[]>([])
    const [loadingSources, setLoadingSources] = useState(true)
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false)
    const [editingSource, setEditingSource] = useState<AuctionSource | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [sourceForm, setSourceForm] = useState({
        name: "",
        source_url: "",
        is_active: true,
        notes: "",
    })

    // ── Fetch functions ─────────────────────────────────────────────────────────

    const fetchLots = async () => {
        setLoadingLots(true)
        try {
            const { data, error } = await supabase
                .from("auction_lots")
                .select("*, auction_sources(name, source_url)")
                .order("auction_end_at", { ascending: true })
            if (error) throw error
            setLots(data || [])
        } catch (err) {
            console.error("Erro ao carregar lotes:", err)
        } finally {
            setLoadingLots(false)
        }
    }

    const fetchSources = async () => {
        setLoadingSources(true)
        try {
            const { data, error } = await supabase
                .from("auction_sources")
                .select("*")
                .order("name")
            if (error) throw error
            setSources(data || [])
        } catch (err) {
            console.error("Erro ao carregar fontes:", err)
        } finally {
            setLoadingSources(false)
        }
    }

    useEffect(() => {
        fetchLots()
        fetchSources()
    }, [])

    // ── Filtros de Lotes ────────────────────────────────────────────────────────

    const filteredLots = lots.filter((lot) => {
        const term = searchTerm.toLowerCase()
        const matchSearch =
            !searchTerm ||
            lot.lot_name.toLowerCase().includes(term) ||
            lot.lot_number.toLowerCase().includes(term) ||
            (lot.city || "").toLowerCase().includes(term)
        const matchScrap = filterScrap === "all" || lot.scrap_type === filterScrap
        const matchSource = filterSource === "all" || lot.source_id === filterSource
        return matchSearch && matchScrap && matchSource
    })

    // ── Source CRUD ─────────────────────────────────────────────────────────────

    const openCreateSource = () => {
        setEditingSource(null)
        setSourceForm({ name: "", source_url: "", is_active: true, notes: "" })
        setIsSourceModalOpen(true)
    }

    const openEditSource = (s: AuctionSource) => {
        setEditingSource(s)
        setSourceForm({ name: s.name, source_url: s.source_url, is_active: s.is_active, notes: s.notes || "" })
        setIsSourceModalOpen(true)
    }

    const handleSaveSource = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const payload = {
                name: sourceForm.name,
                source_url: sourceForm.source_url,
                is_active: sourceForm.is_active,
                notes: sourceForm.notes || null,
            }
            if (editingSource) {
                const { error } = await supabase
                    .from("auction_sources")
                    .update(payload)
                    .eq("id", editingSource.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from("auction_sources").insert([payload])
                if (error) throw error
            }
            setIsSourceModalOpen(false)
            fetchSources()
        } catch (err: any) {
            alert("Erro ao salvar fonte: " + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteSource = async (id: string) => {
        if (!confirm("Deseja realmente excluir esta fonte? Os lotes vinculados perderão a referência.")) return
        try {
            const { error } = await supabase.from("auction_sources").delete().eq("id", id)
            if (error) throw error
            fetchSources()
            fetchLots()
        } catch (err: any) {
            alert("Erro ao excluir: " + err.message)
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Gavel className="w-8 h-8 text-amber-500" />
                        Leilões
                    </h1>
                    <p className="text-foreground mt-1">
                        Lotes coletados automaticamente via n8n. Busque por nome, número ou cidade.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Tab switcher */}
                    <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50">
                        <Button
                            variant={activeTab === "lots" ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => setActiveTab("lots")}
                        >
                            <Gavel className="w-4 h-4" /> Lotes
                        </Button>
                        <Button
                            variant={activeTab === "sources" ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => setActiveTab("sources")}
                        >
                            <Globe className="w-4 h-4" /> Fontes
                        </Button>
                    </div>
                    {activeTab === "sources" && (
                        <Button className="gap-2" onClick={openCreateSource}>
                            <Plus className="w-4 h-4" /> Nova Fonte
                        </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => { fetchLots(); fetchSources() }} title="Atualizar">
                        <RefreshCcw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* ── TAB: LOTES ───────────────────────────────────────────────────────── */}
            {activeTab === "lots" && (
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            {/* Busca */}
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground" />
                                <Input
                                    placeholder="Buscar por nome, número, cidade..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {/* Filtros */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Filter className="w-4 h-4 text-foreground shrink-0" />
                                <select
                                    className="h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                                    value={filterScrap}
                                    onChange={(e) => setFilterScrap(e.target.value)}
                                >
                                    <option value="all">Todos os tipos</option>
                                    <option value="aproveitavel">✅ Aproveitável</option>
                                    <option value="inservivel">☠️ Inservível</option>
                                </select>
                                <select
                                    className="h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                                    value={filterSource}
                                    onChange={(e) => setFilterSource(e.target.value)}
                                >
                                    <option value="all">Todas as fontes</option>
                                    {sources.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {(searchTerm || filterScrap !== "all" || filterSource !== "all") && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => { setSearchTerm(""); setFilterScrap("all"); setFilterSource("all") }}
                                        title="Limpar filtros"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Contador */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-foreground">
                                {filteredLots.length} lote{filteredLots.length !== 1 ? "s" : ""} encontrado{filteredLots.length !== 1 ? "s" : ""}
                            </span>
                            {searchTerm && (
                                <Badge variant="outline" className="text-[10px]">
                                    busca: "{searchTerm}"
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent>
                        {loadingLots ? (
                            <div className="flex items-center justify-center p-12 text-foreground">
                                <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> Carregando lotes...
                            </div>
                        ) : filteredLots.length === 0 ? (
                            <div className="text-center py-16">
                                <Gavel className="w-12 h-12 mx-auto mb-4 text-amber-400 opacity-40" />
                                <p className="text-foreground font-medium">Nenhum lote encontrado.</p>
                                <p className="text-xs text-foreground mt-1">
                                    Os lotes são coletados automaticamente via n8n. Verifique as fontes configuradas.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lote</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Tipo de Sucata</TableHead>
                                        <TableHead>
                                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Cidade</span>
                                        </TableHead>
                                        <TableHead>
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Fim do Leilão</span>
                                        </TableHead>
                                        <TableHead>Fonte</TableHead>
                                        <TableHead className="text-right">Link</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLots.map((lot) => {
                                        const isEnding =
                                            lot.auction_end_at &&
                                            new Date(lot.auction_end_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
                                            new Date(lot.auction_end_at).getTime() > Date.now()

                                        return (
                                            <TableRow key={lot.id} className={isEnding ? "bg-amber-500/5" : ""}>
                                                <TableCell>
                                                    <span className="font-mono text-sm font-bold">{lot.lot_number}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-[260px]">
                                                        <p className="font-medium text-sm leading-snug line-clamp-2">{lot.lot_name}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <ScrapBadge type={lot.scrap_type} />
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {lot.city || <span className="text-foreground italic text-xs">—</span>}
                                                </TableCell>
                                                <TableCell>
                                                    {lot.auction_end_at ? (
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-medium ${isEnding ? "text-amber-600 font-bold" : ""}`}>
                                                                {fmtDate(lot.auction_end_at)}
                                                            </span>
                                                            {isEnding && (
                                                                <span className="text-[10px] text-amber-600 font-bold animate-pulse">⏰ Encerrando em breve!</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-foreground text-xs italic">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-foreground">
                                                        {lot.auction_sources?.name || "—"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <a
                                                        href={lot.lot_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Ver lote no site"
                                                    >
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <ExternalLink className="w-4 h-4 text-blue-500" />
                                                        </Button>
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── TAB: FONTES ──────────────────────────────────────────────────────── */}
            {activeTab === "sources" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-500" />
                            Fontes de Leilão
                        </CardTitle>
                        <p className="text-xs text-foreground">
                            Cada fonte representa um site/plataforma de leilão que o n8n monitora automaticamente.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {loadingSources ? (
                            <div className="flex items-center justify-center p-12 text-foreground">
                                <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> Carregando fontes...
                            </div>
                        ) : sources.length === 0 ? (
                            <div className="text-center py-12">
                                <Globe className="w-10 h-10 mx-auto mb-3 text-blue-400 opacity-40" />
                                <p className="text-foreground">Nenhuma fonte cadastrada.</p>
                                <Button className="mt-4 gap-2" onClick={openCreateSource}>
                                    <Plus className="w-4 h-4" /> Adicionar Primeira Fonte
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {sources.map((source) => {
                                    const lotsCount = lots.filter((l) => l.source_id === source.id).length
                                    return (
                                        <div
                                            key={source.id}
                                            className="p-4 border border-border rounded-xl bg-card hover:border-primary/30 transition-colors space-y-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm">{source.name}</p>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${source.is_active
                                                                ? "border-emerald-500/40 text-emerald-600"
                                                                : "border-rose-500/40 text-rose-600"
                                                                }`}
                                                        >
                                                            {source.is_active ? "Ativa" : "Inativa"}
                                                        </Badge>
                                                    </div>
                                                    <a
                                                        href={source.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                                    >
                                                        <Globe className="w-3 h-3 shrink-0" />
                                                        {source.source_url}
                                                    </a>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSource(source)}>
                                                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteSource(source.id)}>
                                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {source.notes && (
                                                <p className="text-xs text-foreground border-t border-border/50 pt-2">{source.notes}</p>
                                            )}

                                            <div className="flex items-center justify-between text-xs text-foreground border-t border-border/50 pt-2">
                                                <span className="flex items-center gap-1">
                                                    <Tag className="w-3 h-3" />
                                                    {lotsCount} lote{lotsCount !== 1 ? "s" : ""} coletado{lotsCount !== 1 ? "s" : ""}
                                                </span>
                                                <span>Desde {fmtDate(source.created_at)}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── MODAL: FONTE ─────────────────────────────────────────────────────── */}
            <Modal
                isOpen={isSourceModalOpen}
                onClose={() => setIsSourceModalOpen(false)}
                title={editingSource ? "Editar Fonte" : "Nova Fonte de Leilão"}
                className="max-w-md"
            >
                <form onSubmit={handleSaveSource} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome da Fonte *</Label>
                        <Input
                            required
                            placeholder="Ex: Sucata Leilões SP"
                            value={sourceForm.name}
                            onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>URL do Site *</Label>
                        <Input
                            required
                            type="url"
                            placeholder="https://exemplo-leilao.com.br"
                            value={sourceForm.source_url}
                            onChange={(e) => setSourceForm({ ...sourceForm, source_url: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Input
                            placeholder="Notas internas sobre esta fonte (opcional)"
                            value={sourceForm.notes}
                            onChange={(e) => setSourceForm({ ...sourceForm, notes: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={sourceForm.is_active}
                            onChange={(e) => setSourceForm({ ...sourceForm, is_active: e.target.checked })}
                            className="w-4 h-4 accent-primary"
                        />
                        <Label htmlFor="is_active" className="cursor-pointer font-medium">
                            Fonte ativa (o n8n coletará desta fonte)
                        </Label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsSourceModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Salvando..." : editingSource ? "Salvar Alterações" : "Criar Fonte"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
