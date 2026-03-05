import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import {
    QrCode, Camera, CameraOff, Package, MapPin, ShoppingCart,
    Search, CheckCircle2, AlertCircle, ArrowRight, RefreshCw,
    Zap, History, X, ChevronRight, Scan, Move, Eye
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/authStore"

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = "transfer" | "sale" | "lookup"
type ScanStep = "idle" | "product_scanned" | "location_scanned" | "success" | "error"

interface ScannedProduct {
    id: string
    nome: string
    sku: string
    codigo_etiqueta: string | null
    codigo_barras: string | null
    estoque_atual: number
    preco: number
    localizacao_id: string | null
    localizacao: string | null
    imagem_url: string | null
}

interface ScannedLocation {
    id: string
    nome: string
    sigla: string | null
    parent_id: string | null
}

interface HistoryItem {
    id: string
    type: "transfer" | "sale" | "lookup"
    message: string
    ts: Date
    success: boolean
}

// ─── QR Camera Component ─────────────────────────────────────────────────────

function QrCameraScanner({ onResult, active }: { onResult: (code: string) => void; active: boolean }) {
    const divRef = useRef<HTMLDivElement>(null)
    const scannerRef = useRef<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!active || !divRef.current) return

        let mounted = true;

        const initScanner = async () => {
            try {
                const { Html5Qrcode } = await import("html5-qrcode")
                if (!mounted || !divRef.current) return

                const scanner = new Html5Qrcode("qr-reader-div")
                scannerRef.current = scanner

                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 12, qrbox: { width: 260, height: 260 } },
                    (decodedText: string) => {
                        onResult(decodedText.trim())
                    },
                    () => { /* ignore scan failures */ }
                )
            } catch (e: any) {
                if (mounted) setError("Câmera não disponível: " + (e?.message || String(e)))
            }
        }

        initScanner()

        return () => {
            mounted = false
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { })
                scannerRef.current = null
            }
        }
    }, [active])

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-xl border border-dashed border-border gap-3 text-foreground text-sm p-4 text-center">
                <CameraOff className="w-8 h-8 text-destructive" />
                <p>{error}</p>
                <p className="text-xs text-muted-foreground">Use o campo manual abaixo para digitar o código.</p>
            </div>
        )
    }

    return (
        <div className="relative rounded-xl overflow-hidden bg-black">
            <div id="qr-reader-div" ref={divRef} className="w-full" />
            {/* Animated targeting overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-primary/80 rounded-lg relative">
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
                    {/* Scan line animation */}
                    <div className="scan-line absolute left-1 right-1 h-0.5 bg-primary/60 rounded-full" style={{ animation: "scanline 2s linear infinite" }} />
                </div>
            </div>
        </div>
    )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
    product,
    locations,
    onClear
}: {
    product: ScannedProduct
    locations: ScannedLocation[]
    onClear: () => void
}) {
    const loc = locations.find(l => l.id === product.localizacao_id)
    const locLabel = loc ? (loc.sigla || loc.nome) : (product.localizacao || "Sem localização")
    const stockColor = product.estoque_atual <= 0 ? "text-destructive" : product.estoque_atual <= 3 ? "text-amber-500" : "text-emerald-500"

    return (
        <div className="relative p-4 rounded-xl border-2 border-primary/40 bg-primary/5 space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <button onClick={onClear} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
            </button>
            {product.imagem_url && (
                <img src={product.imagem_url} alt={product.nome} className="w-16 h-16 object-cover rounded-lg border border-border" />
            )}
            <div>
                <p className="font-bold text-sm leading-tight">{product.nome}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {product.sku}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-[10px] gap-1">
                    <MapPin className="w-3 h-3" /> {locLabel}
                </Badge>
                <Badge variant="outline" className={`text-[10px] font-bold ${stockColor}`}>
                    Estoque: {product.estoque_atual}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                    R$ {product.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </Badge>
            </div>
        </div>
    )
}

// ─── Location Card ────────────────────────────────────────────────────────────

function LocationCard({
    location,
    allLocations,
    onClear
}: {
    location: ScannedLocation
    allLocations: ScannedLocation[]
    onClear: () => void
}) {
    const parent = allLocations.find(l => l.id === location.parent_id)
    const label = parent ? `${parent.sigla || parent.nome} › ${location.sigla || location.nome}` : (location.sigla || location.nome)

    return (
        <div className="relative p-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <button onClick={onClear} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                <div>
                    <p className="font-bold text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{location.nome}</p>
                </div>
            </div>
        </div>
    )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 3500)
        return () => clearTimeout(t)
    }, [msg])

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-bottom-4 ${type === "success" ? "bg-emerald-500 text-white border-emerald-600" : "bg-destructive text-white border-destructive/80"}`}>
            {type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QrScanner() {
    const { atendente } = useAuthStore()
    const [mode, setMode] = useState<Mode>("transfer")
    const [cameraActive, setCameraActive] = useState(false)
    const [manualCode, setManualCode] = useState("")

    // Transfer mode state
    const [step, setStep] = useState<ScanStep>("idle")
    const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null)
    const [scannedLocation, setScannedLocation] = useState<ScannedLocation | null>(null)

    // Sale mode state
    const [saleProduct, setSaleProduct] = useState<ScannedProduct | null>(null)
    const [saleQty, setSaleQty] = useState(1)
    const [saleModalOpen, setSaleModalOpen] = useState(false)

    // Lookup mode state
    const [lookupResult, setLookupResult] = useState<{ type: "product" | "location"; data: any } | null>(null)

    // Shared state
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [locations, setLocations] = useState<ScannedLocation[]>([])
    const [historyOpen, setHistoryOpen] = useState(false)

    const addToast = (msg: string, type: "success" | "error") => setToast({ msg, type })

    const addHistory = (type: HistoryItem["type"], message: string, success: boolean) => {
        setHistory(prev => [{ id: crypto.randomUUID(), type, message, ts: new Date(), success }, ...prev].slice(0, 20))
    }

    // Fetch locations once
    useEffect(() => {
        supabase.from("localizacoes").select("id, nome, sigla, parent_id").order("nome").then(({ data }) => {
            if (data) setLocations(data)
        })
    }, [])

    // Reset steps when mode changes
    useEffect(() => {
        resetAll()
        setCameraActive(false)
    }, [mode])

    const resetAll = () => {
        setStep("idle")
        setScannedProduct(null)
        setScannedLocation(null)
        setSaleProduct(null)
        setSaleQty(1)
        setLookupResult(null)
        setManualCode("")
    }

    // ── Lookup helpers ──────────────────────────────────────────────────────────

    const lookupProduct = useCallback(async (code: string): Promise<ScannedProduct | null> => {
        const { data } = await supabase
            .from("produtos")
            .select("id, nome, sku, codigo_etiqueta, codigo_barras, estoque_atual, preco, localizacao_id, localizacao, imagem_url")
            .or(`sku.eq.${code},codigo_etiqueta.eq.${code},codigo_barras.eq.${code}`)
            .limit(1)
            .maybeSingle()
        return data || null
    }, [])

    const lookupLocation = useCallback(async (code: string): Promise<ScannedLocation | null> => {
        const { data } = await supabase
            .from("localizacoes")
            .select("id, nome, sigla, parent_id")
            .or(`sigla.ilike.${code},nome.ilike.${code}`)
            .limit(1)
            .maybeSingle()
        return data || null
    }, [])

    // ── Main scan handler ───────────────────────────────────────────────────────

    const handleScan = useCallback(async (raw: string) => {
        if (loading) return
        const code = raw.trim()
        if (!code) return

        setLoading(true)
        try {
            if (mode === "transfer") {
                await handleTransferScan(code)
            } else if (mode === "sale") {
                await handleSaleScan(code)
            } else {
                await handleLookupScan(code)
            }
        } finally {
            setLoading(false)
            setManualCode("")
        }
    }, [mode, loading, scannedProduct, step])

    // ── Transfer mode ──────────────────────────────────────────────────────────

    const handleTransferScan = async (code: string) => {
        if (step === "idle" || step === "error" || step === "success") {
            // Step 1: Try to identify if it's a product or location
            const [prod, loc] = await Promise.all([lookupProduct(code), lookupLocation(code)])

            if (prod) {
                setScannedProduct(prod)
                setStep("product_scanned")
                addToast(`Produto encontrado: ${prod.nome}`, "success")
            } else if (loc) {
                setScannedLocation(loc)
                setStep("idle") // Start with location, wait for product
                addToast(`Localização lida: ${loc.sigla || loc.nome} — agora escaneie o produto`, "success")
            } else {
                addToast(`Código "${code}" não encontrado`, "error")
            }
        } else if (step === "product_scanned") {
            // Step 2: Product already scanned — expecting location
            const loc = await lookupLocation(code)

            if (loc) {
                // Execute transfer
                await doTransfer(scannedProduct!, loc)
            } else {
                // Maybe it's another product — replace
                const prod = await lookupProduct(code)
                if (prod) {
                    setScannedProduct(prod)
                    addToast(`Produto trocado: ${prod.nome}`, "success")
                } else {
                    addToast(`Código "${code}" não encontrado`, "error")
                }
            }
        }
    }

    const doTransfer = async (product: ScannedProduct, location: ScannedLocation) => {
        const { error } = await supabase
            .from("produtos")
            .update({
                localizacao_id: location.id,
                localizacao: location.nome
            })
            .eq("id", product.id)

        if (error) {
            addToast("Erro ao transferir: " + error.message, "error")
            addHistory("transfer", `ERRO ao mover ${product.sku} → ${location.sigla || location.nome}`, false)
        } else {
            const locLabel = location.sigla || location.nome
            const prevLabel = (() => {
                const prev = locations.find(l => l.id === product.localizacao_id)
                return prev ? (prev.sigla || prev.nome) : (product.localizacao || "sem local")
            })()
            addToast(`✅ ${product.nome} → ${locLabel}`, "success")
            addHistory("transfer", `${product.sku} — ${prevLabel} → ${locLabel}`, true)
            setStep("success")
            setScannedLocation(location)
            // Refresh locations list from supabase
            setLocations(prev => [...prev]) // trigger re-render; product update is in DB
            setTimeout(resetAll, 2500)
        }
    }

    // ── Sale mode ──────────────────────────────────────────────────────────────

    const handleSaleScan = async (code: string) => {
        const prod = await lookupProduct(code)
        if (!prod) {
            addToast(`Produto "${code}" não encontrado`, "error")
            return
        }
        if (prod.estoque_atual <= 0) {
            addToast(`${prod.nome} — sem estoque!`, "error")
            return
        }
        setSaleProduct(prod)
        setSaleQty(1)
        setSaleModalOpen(true)
        if (cameraActive) setCameraActive(false)
    }

    const handleAddToCart = async () => {
        if (!saleProduct || !atendente) {
            addToast("Você precisa estar logado para usar o carrinho.", "error")
            return
        }
        setLoading(true)
        try {
            const { data: existing } = await supabase
                .from("carrinho_itens")
                .select("quantidade")
                .eq("atendente_id", atendente.id)
                .eq("produto_id", saleProduct.id)
                .maybeSingle()

            if (existing) {
                await supabase
                    .from("carrinho_itens")
                    .update({ quantidade: existing.quantidade + saleQty })
                    .eq("atendente_id", atendente.id)
                    .eq("produto_id", saleProduct.id)
            } else {
                await supabase.from("carrinho_itens").insert({
                    atendente_id: atendente.id,
                    produto_id: saleProduct.id,
                    preco_unitario: saleProduct.preco,
                    quantidade: saleQty
                })
            }
            addHistory("sale", `${saleProduct.sku} × ${saleQty} → Carrinho`, true)
            addToast(`${saleQty}× ${saleProduct.nome} adicionado ao carrinho!`, "success")
            setSaleModalOpen(false)
            resetAll()
        } catch (e: any) {
            addToast("Erro ao adicionar: " + e.message, "error")
        } finally {
            setLoading(false)
        }
    }

    // ── Lookup mode ────────────────────────────────────────────────────────────

    const handleLookupScan = async (code: string) => {
        const [prod, loc] = await Promise.all([lookupProduct(code), lookupLocation(code)])
        if (prod) {
            setLookupResult({ type: "product", data: prod })
            addHistory("lookup", `Consultou: ${prod.sku} — ${prod.nome}`, true)
        } else if (loc) {
            // Also fetch products in that location
            const { data: prodsInLoc } = await supabase
                .from("produtos")
                .select("id, nome, sku, estoque_atual")
                .eq("localizacao_id", loc.id)
                .order("nome")
            setLookupResult({ type: "location", data: { ...loc, produtos: prodsInLoc || [] } })
            addHistory("lookup", `Consultou local: ${loc.sigla || loc.nome}`, true)
        } else {
            addToast(`Código "${code}" não encontrado`, "error")
        }
    }

    // ── Manual input handler ───────────────────────────────────────────────────

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!manualCode.trim()) return
        handleScan(manualCode.trim())
    }

    const handleCameraResult = useCallback((code: string) => {
        handleScan(code)
    }, [handleScan])

    // ── Step indicator for transfer mode ──────────────────────────────────────

    const stepInfo = () => {
        if (step === "idle" && !scannedLocation) return { label: "Aguardando scan do produto ou localização", color: "text-muted-foreground" }
        if (step === "idle" && scannedLocation) return { label: "Localização pronta — escaneia o produto agora", color: "text-amber-500" }
        if (step === "product_scanned") return { label: "Produto pronto — escaneia a localização de destino", color: "text-primary" }
        if (step === "success") return { label: "Transferência concluída! ✅", color: "text-emerald-500" }
        return { label: "", color: "" }
    }

    const si = stepInfo()

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Toast */}
            {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <QrCode className="w-8 h-8 text-primary" />
                        QR Code Scanner
                    </h1>
                    <p className="text-muted-foreground mt-1">Escaneie etiquetas para transferir localizações ou registrar vendas.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setHistoryOpen(true)} title="Histórico da sessão">
                        <History className="w-4 h-4" />
                        {history.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[9px] text-primary-foreground rounded-full flex items-center justify-center font-bold">{history.length > 9 ? "9+" : history.length}</span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Mode Tabs */}
            <div className="grid grid-cols-3 gap-2">
                {([
                    { id: "transfer", label: "Transferir / Locar", icon: Move, desc: "Mover produto entre locais" },
                    { id: "sale", label: "Venda Rápida", icon: ShoppingCart, desc: "Adicionar ao carrinho" },
                    { id: "lookup", label: "Consultar", icon: Eye, desc: "Ver dados do item" }
                ] as { id: Mode; label: string; icon: any; desc: string }[]).map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center group ${mode === m.id
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                            }`}
                    >
                        <m.icon className={`w-6 h-6 ${mode === m.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                        <div>
                            <p className={`text-xs font-bold leading-tight ${mode === m.id ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{m.desc}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Camera + Manual Input */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Scan className="w-4 h-4 text-primary" />
                            {cameraActive ? "Câmera Ativa" : "Leitor"}
                        </CardTitle>
                        <Button
                            variant={cameraActive ? "default" : "outline"}
                            size="sm"
                            className="gap-2"
                            onClick={() => setCameraActive(v => !v)}
                        >
                            {cameraActive ? <><CameraOff className="w-4 h-4" /> Fechar Câmera</> : <><Camera className="w-4 h-4" /> Abrir Câmera</>}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Camera */}
                    {cameraActive && <QrCameraScanner onResult={handleCameraResult} active={cameraActive} />}

                    {/* Manual input */}
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9 font-mono"
                                placeholder={
                                    mode === "transfer" ? "SKU, código de etiqueta ou sigla da localização..."
                                        : mode === "sale" ? "SKU ou código de barras do produto..."
                                            : "SKU, sigla da localização ou código de barras..."
                                }
                                value={manualCode}
                                onChange={e => setManualCode(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <Button type="submit" disabled={loading || !manualCode.trim()}>
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        </Button>
                    </form>

                    {/* Loading indicator */}
                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Buscando...
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── TRANSFER MODE UI ─────────────────────────────────────────────── */}
            {mode === "transfer" && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Move className="w-4 h-4 text-amber-500" />
                            Transferir / Locar Produto
                        </CardTitle>
                        {/* Step progress */}
                        <div className="flex items-center gap-2 mt-2">
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${scannedProduct ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground text-muted-foreground"}`}>
                                {scannedProduct ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                            </div>
                            <div className="text-xs text-muted-foreground">Produto</div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${scannedLocation ? "bg-amber-500 text-white border-amber-500" : "border-muted-foreground text-muted-foreground"}`}>
                                {scannedLocation ? <CheckCircle2 className="w-4 h-4" /> : "2"}
                            </div>
                            <div className="text-xs text-muted-foreground">Localização</div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${step === "success" ? "bg-emerald-500 text-white border-emerald-500" : "border-muted-foreground text-muted-foreground"}`}>
                                {step === "success" ? <CheckCircle2 className="w-4 h-4" /> : "✓"}
                            </div>
                            <div className="text-xs text-muted-foreground">Concluído</div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className={`text-sm font-medium ${si.color}`}>{si.label}</p>

                        {scannedProduct && (
                            <ProductCard
                                product={scannedProduct}
                                locations={locations}
                                onClear={() => { setScannedProduct(null); setStep("idle") }}
                            />
                        )}

                        {scannedLocation && (
                            <>
                                {scannedProduct && (
                                    <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm">
                                        <ArrowRight className="w-5 h-5" />
                                        <span>Mover para:</span>
                                    </div>
                                )}
                                <LocationCard
                                    location={scannedLocation}
                                    allLocations={locations}
                                    onClear={() => { setScannedLocation(null); if (step !== "product_scanned") setStep("idle") }}
                                />
                            </>
                        )}

                        {!scannedProduct && !scannedLocation && (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                                <QrCode className="w-12 h-12 opacity-20" />
                                <p className="text-sm">Escaneia a etiqueta do produto ou da prateleira</p>
                            </div>
                        )}

                        {/* Quick manual transfer: both scanned but not yet committed */}
                        {scannedProduct && scannedLocation && step !== "success" && (
                            <Button
                                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => doTransfer(scannedProduct, scannedLocation)}
                                disabled={loading}
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />}
                                Confirmar Transferência
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── SALE MODE UI ─────────────────────────────────────────────────── */}
            {mode === "sale" && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-emerald-500" />
                            Venda Rápida
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!saleProduct ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                                <Package className="w-12 h-12 opacity-20" />
                                <p className="text-sm">Escaneia o produto para adicionar ao carrinho</p>
                            </div>
                        ) : (
                            <ProductCard product={saleProduct} locations={locations} onClear={() => setSaleProduct(null)} />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── LOOKUP MODE UI ───────────────────────────────────────────────── */}
            {mode === "lookup" && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-500" />
                            Consulta
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!lookupResult ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                                <Search className="w-12 h-12 opacity-20" />
                                <p className="text-sm">Escaneia qualquer QR para ver informações</p>
                            </div>
                        ) : lookupResult.type === "product" ? (
                            <div className="space-y-4">
                                <ProductCard product={lookupResult.data} locations={locations} onClear={() => setLookupResult(null)} />
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Part Number</p>
                                        <p className="font-mono font-bold">{lookupResult.data.part_number || "—"}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Cód. Barras</p>
                                        <p className="font-mono font-bold">{lookupResult.data.codigo_barras || "—"}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Marca</p>
                                        <p className="font-bold">{lookupResult.data.marca || "—"}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Categoria</p>
                                        <p className="font-bold">{lookupResult.data.categoria_id ? "Cadastrada" : "—"}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <LocationCard location={lookupResult.data} allLocations={locations} onClear={() => setLookupResult(null)} />
                                <div>
                                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                        <Package className="w-3 h-3" /> Produtos nesta localização ({lookupResult.data.produtos?.length || 0})
                                    </p>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {lookupResult.data.produtos?.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Nenhum produto nesta localização</p>
                                        ) : (
                                            lookupResult.data.produtos.map((p: any) => (
                                                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm">
                                                    <div>
                                                        <span className="font-bold">{p.sku}</span>
                                                        <span className="text-muted-foreground ml-2 text-xs">{p.nome}</span>
                                                    </div>
                                                    <Badge variant="outline" className={`text-[10px] ${p.estoque_atual <= 0 ? "text-destructive" : "text-emerald-600"}`}>
                                                        {p.estoque_atual} un
                                                    </Badge>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── SALE CONFIRM MODAL ───────────────────────────────────────────── */}
            <Modal
                isOpen={saleModalOpen}
                onClose={() => { setSaleModalOpen(false); setSaleProduct(null) }}
                title="Adicionar ao Carrinho"
                className="max-w-sm"
            >
                {saleProduct && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-muted/30 border border-border">
                            <p className="font-bold">{saleProduct.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono">SKU: {saleProduct.sku}</p>
                            <p className="text-sm font-bold text-primary mt-1">
                                R$ {saleProduct.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / un
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Quantidade</Label>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="icon" onClick={() => setSaleQty(q => Math.max(1, q - 1))}>−</Button>
                                <Input
                                    type="number"
                                    min={1}
                                    max={saleProduct.estoque_atual}
                                    value={saleQty}
                                    onChange={e => setSaleQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="text-center font-bold text-lg w-24"
                                />
                                <Button variant="outline" size="icon" onClick={() => setSaleQty(q => Math.min(saleProduct.estoque_atual, q + 1))}>+</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Estoque disponível: {saleProduct.estoque_atual}</p>
                        </div>

                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-sm font-bold">Subtotal: R$ {(saleProduct.preco * saleQty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setSaleModalOpen(false); setSaleProduct(null) }}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddToCart} disabled={loading}>
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                Adicionar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── HISTORY MODAL ────────────────────────────────────────────────── */}
            <Modal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title="Histórico da Sessão"
                className="max-w-md"
            >
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Nenhuma operação realizada ainda.</p>
                    ) : (
                        history.map(h => (
                            <div key={h.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm ${h.success ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"}`}>
                                {h.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                                <div className="flex-1">
                                    <p className="leading-tight">{h.message}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {h.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        {" · "}
                                        {h.type === "transfer" ? "Transferência" : h.type === "sale" ? "Venda" : "Consulta"}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {history.length > 0 && (
                    <Button variant="outline" size="sm" className="w-full mt-3 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setHistory([])}>
                        Limpar Histórico
                    </Button>
                )}
            </Modal>

            {/* Scanline CSS */}
            <style>{`
        @keyframes scanline {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
        .scan-line { position: absolute; }
      `}</style>
        </div>
    )
}
