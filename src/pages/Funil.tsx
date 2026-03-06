import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Search, Plus, MoreHorizontal, MessageSquare,
    User, DollarSign, Calendar, ChevronRight, Pencil,
    Filter, LayoutGrid as KanbanIcon, List as ListIcon, X
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, Reorder } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Conversa {
    id: string
    telefone: string
    cliente_nome: string
    etapa_funil: string
    valor_estimado: number
    updated_at: string
    unread_count?: number
    is_group?: boolean
    nota_interna?: string
    last_message_text?: string
    foto_url?: string
    atendente_id?: string
}

const COLUNAS = [
    { id: 'Novo Lead', label: 'Novo Lead', color: 'border-blue-500 bg-blue-500/10 text-blue-700' },
    { id: 'Qualificação', label: 'Qualificação', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-700' },
    { id: 'Orçamento', label: 'Orçamento', color: 'border-purple-500 bg-purple-500/10 text-purple-700' },
    { id: 'Negociação', label: 'Negociação', color: 'border-orange-500 bg-orange-500/10 text-orange-700' },
    { id: 'Fechamento', label: 'Fechamento', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' }
]

export function Funil() {
    const navigate = useNavigate()
    const [conversas, setConversas] = useState<Conversa[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [activeColMenu, setActiveColMenu] = useState<string | null>(null)
    const [editingColumn, setEditingColumn] = useState<any>(null)
    const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() => {
        const labels: any = {}
        COLUNAS.forEach(c => labels[c.id] = c.label)
        return labels
    })
    const { atendente } = useAuthStore()

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('cardId', id)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDrop = async (e: React.DragEvent, novaEtapa: string) => {
        e.preventDefault()
        const cardId = e.dataTransfer.getData('cardId')
        if (cardId) {
            updateEtapa(cardId, novaEtapa)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const fetchConversas = async () => {
        setLoading(true)

        let query = supabase.from('conversas').select('*').order('updated_at', { ascending: false })
        if (!atendente?.perm_config) {
            if (atendente?.id) query = query.eq('atendente_id', atendente.id)
        } else {
            query = query.eq('legacy', false)
        }

        const { data, error } = await query

        if (!error && data) {
            setConversas(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchConversas()

        const sub = supabase
            .channel('funil_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, () => {
                fetchConversas()
            })
            .subscribe()

        return () => { supabase.removeChannel(sub) }
    }, [])

    const updateEtapa = async (id: string, novaEtapa: string) => {
        const { error } = await supabase
            .from('conversas')
            .update({ etapa_funil: novaEtapa })
            .eq('id', id)

        if (error) alert("Erro ao mover card")
        else {
            setConversas(prev => prev.map(c => c.id === id ? { ...c, etapa_funil: novaEtapa } : c))
        }
    }

    const filteredConversas = useMemo(() => {
        return conversas.filter(c =>
            c.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.telefone.includes(searchTerm)
        )
    }, [conversas, searchTerm])

    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                        <KanbanIcon className="w-6 h-6 text-emerald-600" /> Funil de Vendas
                    </h1>
                    <p className="text-muted-foreground text-sm">Gerencie seus leads e negociações de forma visual</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou número..."
                            className="pl-9 w-[300px] h-10 rounded-full bg-background"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="h-10 rounded-full gap-2">
                        <Filter className="w-4 h-4" /> Filtros
                    </Button>
                    <Button className="h-10 rounded-full gap-2 bg-emerald-600 hover:bg-emerald-700 font-bold shrink-0">
                        <Plus className="w-4 h-4" /> Criar Card
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar overflow-y-hidden">
                <div className="flex gap-4 h-full min-w-max px-1">
                    {COLUNAS.map(coluna => {
                        const cards = filteredConversas.filter(c => (c.etapa_funil || 'Novo Lead') === coluna.id)
                        const totalValor = cards.reduce((acc, curr) => acc + (curr.valor_estimado || 0), 0)

                        return (
                            <div key={coluna.id} className="w-[320px] flex flex-col gap-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/40 p-3 border border-slate-200 dark:border-slate-800 shadow-sm group h-full">
                                <div className="flex items-center justify-between px-1 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Badge className={`font-black uppercase text-[10px] py-1 px-3 ${coluna.color}`}>
                                            {columnLabels[coluna.id]}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground bg-muted p-1 px-2 rounded-full">
                                            {cards.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                                        <Search className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                                        <MoreHorizontal
                                            className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => setActiveColMenu(activeColMenu === coluna.id ? null : coluna.id)}
                                        />

                                        {activeColMenu === coluna.id && (
                                            <div className="absolute top-5 right-0 w-40 bg-card border border-border rounded-lg shadow-xl z-[100] py-1 animate-in fade-in zoom-in-95 duration-100">
                                                <button
                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted font-medium transition-colors"
                                                    onClick={() => {
                                                        setEditingColumn({ id: coluna.id, label: columnLabels[coluna.id] })
                                                        setActiveColMenu(null)
                                                    }}
                                                >
                                                    <Pencil className="w-3 h-3" /> Editar Etapa
                                                </button>
                                                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted font-medium text-destructive transition-colors">
                                                    Arrumar automação
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="px-2 py-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg flex justify-between items-center border border-slate-300 dark:border-slate-700 shrink-0 shadow-sm text-foreground">
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total:</span>
                                    <span className="text-sm font-black text-foreground">{formatarMoeda(totalValor)}</span>
                                </div>

                                <div
                                    className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar"
                                    onDrop={(e) => handleDrop(e, coluna.id)}
                                    onDragOver={handleDragOver}
                                >
                                    {cards.length === 0 ? (
                                        <div className="h-20 flex items-center justify-center border-2 border-dashed border-muted rounded-xl text-xs text-muted-foreground italic">
                                            Arraste aqui
                                        </div>
                                    ) : (
                                        cards.map(card => (
                                            <motion.div
                                                key={card.id}
                                                layoutId={card.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="cursor-pointer"
                                                draggable
                                                onDragStart={(e: any) => handleDragStart(e, card.id)}
                                                onClick={() => navigate('/atendimento', { state: { selectedConversaId: card.id } })}
                                            >
                                                <Card className="border-border/50 hover:border-emerald-500/50 transition-all hover:shadow-md active:scale-[0.98] group/card cursor-grab active:cursor-grabbing">
                                                    <CardContent className="p-3 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {card.foto_url ? (
                                                                    <div className="w-8 h-8 rounded-full border border-border overflow-hidden">
                                                                        <img src={card.foto_url} alt="" className="w-full h-full object-cover" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-black text-sm uppercase">
                                                                        {card.cliente_nome.substring(0, 1)}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black truncate max-w-[140px]">{card.cliente_nome}</span>
                                                                    <span className="text-[9px] text-muted-foreground font-mono">{card.telefone}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[11px] font-black text-emerald-600">{formatarMoeda(card.valor_estimado)}</span>
                                                                <span className="text-[8px] text-muted-foreground uppercase">
                                                                    {card.updated_at ? format(new Date(card.updated_at), 'dd/MM', { locale: ptBR }) : '--/--'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {(card.last_message_text || card.nota_interna) && (
                                                            <div className="text-[10px] text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded italic border-l-2 border-emerald-500/30">
                                                                {card.last_message_text || card.nota_interna}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                                            <div className="flex items-center gap-1.5">
                                                                <MessageSquare className="w-3 h-3 text-emerald-500" />
                                                                <span className="text-[10px] text-muted-foreground uppercase font-medium">Chat</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full">
                                                                <User className="w-2.5 h-2.5 text-muted-foreground" />
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                                                                    {card.atendente_id === atendente?.id ? 'Você' : 'Operador'}
                                                                </span>
                                                            </div>
                                                            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Modal para Editar Etapa */}
            {editingColumn && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-emerald-600" /> Editar Nome da Etapa
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setEditingColumn(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Nome da Coluna</label>
                                <Input
                                    value={editingColumn.label}
                                    onChange={e => setEditingColumn({ ...editingColumn, label: e.target.value })}
                                    className="h-12 font-bold"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setEditingColumn(null)}>Cancelar</Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                                    onClick={() => {
                                        setColumnLabels({ ...columnLabels, [editingColumn.id]: editingColumn.label })
                                        setEditingColumn(null)
                                    }}
                                >
                                    Salvar Alteração
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
