import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Search, Plus, MoreHorizontal, MessageSquare,
    User, DollarSign, Calendar, ChevronRight,
    Filter, LayoutGrid as KanbanIcon, List as ListIcon
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, Reorder } from 'framer-motion'

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
}

const COLUNAS = [
    { id: 'Novo Lead', label: 'Novo Lead', color: 'border-blue-500 bg-blue-500/10 text-blue-700' },
    { id: 'Qualificação', label: 'Qualificação', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-700' },
    { id: 'Orçamento', label: 'Orçamento', color: 'border-purple-500 bg-purple-500/10 text-purple-700' },
    { id: 'Negociação', label: 'Negociação', color: 'border-orange-500 bg-orange-500/10 text-orange-700' },
    { id: 'Fechamento', label: 'Fechamento', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' }
]

export function Funil() {
    const [conversas, setConversas] = useState<Conversa[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)

    const fetchConversas = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('conversas')
            .select('*')
            .order('updated_at', { ascending: false })

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
        <div className="h-full flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                <div className="flex gap-4 h-full min-w-max px-1">
                    {COLUNAS.map(coluna => {
                        const cards = filteredConversas.filter(c => (c.etapa_funil || 'Novo Lead') === coluna.id)
                        const totalValor = cards.reduce((acc, curr) => acc + (curr.valor_estimado || 0), 0)

                        return (
                            <div key={coluna.id} className="w-[320px] flex flex-col gap-3 rounded-xl bg-muted/30 p-3 border border-border/50 shadow-inner group">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className={`font-black uppercase text-[10px] py-1 px-3 ${coluna.color}`}>
                                            {coluna.label}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground bg-muted p-1 px-2 rounded-full">
                                            {cards.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Search className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                                        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                                    </div>
                                </div>

                                <div className="px-2 py-1.5 bg-background/40 rounded-lg flex justify-between items-center border border-border/10">
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total:</span>
                                    <span className="text-sm font-black text-foreground">{formatarMoeda(totalValor)}</span>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-[500px]">
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
                                            >
                                                <Card className="border-border/50 hover:border-emerald-500/50 transition-all hover:shadow-md active:scale-[0.98] group/card">
                                                    <CardContent className="p-3 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-black text-sm uppercase">
                                                                    {card.cliente_nome.substring(0, 1)}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black truncate w-[160px]">{card.cliente_nome}</span>
                                                                    <span className="text-[9px] text-muted-foreground font-mono">{card.telefone}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[11px] font-black text-emerald-600">{formatarMoeda(card.valor_estimado)}</span>
                                                                <span className="text-[8px] text-muted-foreground uppercase">{format(new Date(card.updated_at), 'dd/MM', { locale: ptBR })}</span>
                                                            </div>
                                                        </div>

                                                        {card.nota_interna && (
                                                            <p className="text-[10px] text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded italic">
                                                                "{card.nota_interna}"
                                                            </p>
                                                        )}

                                                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                                            <div className="flex items-center gap-1.5">
                                                                <MessageSquare className="w-3 h-3 text-muted-foreground" />
                                                                <span className="text-[10px] text-muted-foreground uppercase font-medium">Contatar</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full">
                                                                <User className="w-2.5 h-2.5 text-muted-foreground" />
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase whitespace-nowrap">Operador 1</span>
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
        </div>
    )
}
