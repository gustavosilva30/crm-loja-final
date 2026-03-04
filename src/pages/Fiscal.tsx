import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FileText, FileCode, Download, Printer, Search, Plus, Filter, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Fiscal() {
    const [notas, setNotas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [isEmitModalOpen, setIsEmitModalOpen] = useState(false)
    const [vendasConcluidas, setVendasConcluidas] = useState<any[]>([])
    const [selectedVendaId, setSelectedVendaId] = useState<string>("")
    const [emitting, setEmitting] = useState(false)

    useEffect(() => {
        fetchNotas()
    }, [])

    const fetchNotas = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('fiscal_notas')
            .select(`
                *,
                clientes (nome)
            `)
            .order('created_at', { ascending: false })

        if (!error) setNotas(data || [])
        setLoading(false)
    }

    const fetchVendasConcluidas = async () => {
        const { data, error } = await supabase
            .from('vendas')
            .select(`
                id,
                created_at,
                total,
                clientes (nome)
            `)
            .in('status', ['Pago', 'Enviado', 'Entregue'])
            .order('created_at', { ascending: false })

        if (!error) setVendasConcluidas(data || [])
    }

    const handleEmitirNota = async () => {
        if (!selectedVendaId) return
        setEmitting(true)

        const venda = vendasConcluidas.find(v => v.id === selectedVendaId)

        try {
            // Busca o cliente_id da venda
            const { data: vendaData } = await supabase.from('vendas').select('cliente_id').eq('id', selectedVendaId).single()

            // Simulação de emissão
            const { error } = await supabase.from('fiscal_notas').insert([{
                venda_id: selectedVendaId,
                cliente_id: vendaData?.cliente_id,
                numero_nota: Math.floor(1000 + Math.random() * 9000).toString(),
                serie: "1",
                chave_acesso: Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join(''),
                status: 'Emitida',
                tipo: 'NFe',
                valor_total: venda?.total || 0,
                ambiente: 'Homologação'
            }])

            if (error) throw error

            alert("Nota Fiscal emitida com sucesso!")
            setIsEmitModalOpen(false)
            setSelectedVendaId("")
            fetchNotas()
        } catch (err: any) {
            alert("Erro ao emitir nota: " + err.message)
        } finally {
            setEmitting(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Emitida': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            case 'Pendente': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            case 'Erro': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            case 'Cancelada': return 'bg-slate-500/10 text-slate-500 border-slate-500/20'
            default: return 'bg-primary/10 text-primary border-primary/20'
        }
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Módulo <span className="text-primary-foreground bg-primary px-2 rounded-lg">Fiscal</span></h1>
                    <p className="text-muted-foreground">Gestão de notas fiscais (NFe/NFce) e arquivos XML.</p>
                </div>
                <Button
                    className="font-bold bg-primary text-primary-foreground shadow-sm"
                    onClick={() => {
                        fetchVendasConcluidas()
                        setIsEmitModalOpen(true)
                    }}
                >
                    <Plus className="w-4 h-4 mr-2" /> Emitir Nota Fiscal
                </Button>
            </div>

            <div className="flex gap-4 mb-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por número, chave ou cliente..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" /> Filtros
                </Button>
            </div>

            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        Histórico de Emissões
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-sm font-medium">Carregando registros fiscais...</p>
                        </div>
                    ) : notas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground border-2 border-dashed rounded-xl">
                            <AlertCircle className="w-12 h-12 opacity-20" />
                            <div className="text-center">
                                <p className="text-lg font-bold">Nenhuma nota emitida</p>
                                <p className="text-sm">As notas fiscais geradas aparecerão aqui.</p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-primary/10">
                                    <TableHead>Data</TableHead>
                                    <TableHead>Nota / Série</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {notas.map((nota) => (
                                    <TableRow key={nota.id} className="border-primary/5 hover:bg-primary/5 transition-colors">
                                        <TableCell className="text-xs">
                                            {new Date(nota.created_at).toLocaleDateString()}
                                            <span className="block text-[10px] opacity-50">{new Date(nota.created_at).toLocaleTimeString()}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold">{nota.numero_nota || "---"}</span>
                                            <span className="text-[10px] block opacity-60">Série: {nota.serie || "0"}</span>
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            {nota.clientes?.nome || "Consumidor"}
                                        </TableCell>
                                        <TableCell className="font-mono font-bold text-foreground">
                                            R$ {nota.valor_total?.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(nota.status)} variant="outline">
                                                {nota.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" title="Imprimir PDF" disabled={!nota.url_pdf}>
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Baixar XML" disabled={!nota.url_xml}>
                                                    <FileCode className="w-4 h-4 text-amber-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Download">
                                                    <Download className="w-4 h-4 text-sky-500" />
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

            <Modal isOpen={isEmitModalOpen} onClose={() => setIsEmitModalOpen(false)} title="Nova Emissão Fiscal">
                <div className="space-y-6">
                    <p className="text-sm text-muted-foreground -mt-2">
                        Selecione uma venda concluída para gerar a Nota Fiscal Eletrônica.
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Selecionar Venda</Label>
                            <Select value={selectedVendaId} onChange={(e) => setSelectedVendaId(e.target.value)}>
                                <option value="">Busque por pedido ou cliente...</option>
                                {vendasConcluidas.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        Venda #{v.id.substring(0, 8)} - {v.clientes?.nome || "Consumidor"} (R$ {v.total?.toFixed(2)})
                                    </option>
                                ))}
                            </Select>
                            {vendasConcluidas.length === 0 && (
                                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Nenhuma venda concluída disponível para emissão.
                                </p>
                            )}
                        </div>

                        {selectedVendaId && (
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-border">
                                    <div className="p-1.5 rounded-lg bg-muted">
                                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                                    </div>
                                    <p className="text-xs font-black uppercase text-foreground tracking-widest">Resumo da Emissão</p>
                                </div>
                                <div className="grid grid-cols-2 gap-y-3 text-xs">
                                    <span className="text-muted-foreground">Modelo de Nota:</span>
                                    <span className="font-bold text-right">NFe (Eletrônica)</span>
                                    <span className="text-muted-foreground">Ambiente:</span>
                                    <span className="font-bold text-right">Homologação</span>
                                    <span className="text-muted-foreground">Série da Nota:</span>
                                    <span className="font-bold text-right">001</span>
                                    <span className="text-muted-foreground">Previsão de Valor:</span>
                                    <span className="font-bold text-right font-mono text-foreground">
                                        R$ {vendasConcluidas.find(v => v.id === selectedVendaId)?.total?.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => setIsEmitModalOpen(false)} disabled={emitting}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-primary hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/20"
                            disabled={!selectedVendaId || emitting}
                            onClick={handleEmitirNota}
                        >
                            {emitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processando...
                                </>
                            ) : "Confirmar Emissão"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
