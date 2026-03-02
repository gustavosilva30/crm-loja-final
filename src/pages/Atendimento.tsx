import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Send, User, MessageCircle, Package, ShoppingCart, Loader2, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import axios from "axios"

interface Conversa {
    id: string
    cliente_nome: string
    telefone: string
    status_aberto: boolean
    updated_at: string
}

interface Mensagem {
    id: string
    conversa_id: string
    conteudo: string
    tipo_envio: 'sent' | 'received'
    timestamp: string
}

export function Atendimento() {
    const [conversas, setConversas] = useState<Conversa[]>([])
    const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null)
    const [mensagens, setMensagens] = useState<Mensagem[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [loadingConv, setLoadingConv] = useState(true)
    const [loadingMsg, setLoadingMsg] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // 1. Buscar Conversas
    const fetchConversas = async () => {
        const { data } = await supabase
            .from('conversas')
            .select('*')
            .order('updated_at', { ascending: false })
        setConversas(data || [])
        setLoadingConv(false)
    }

    // 2. Buscar Mensagens
    const fetchMensagens = async (conversaId: string) => {
        setLoadingMsg(true)
        const { data } = await supabase
            .from('mensagens')
            .select('*')
            .eq('conversa_id', conversaId)
            .order('timestamp', { ascending: true })
        setMensagens(data || [])
        setLoadingMsg(false)
    }

    // Effect to fetch messages when selectedConversa changes
    useEffect(() => {
        if (selectedConversa) {
            fetchMensagens(selectedConversa.id)
        }
    }, [selectedConversa])

    // 3. Realtime Subscription
    useEffect(() => {
        fetchConversas()

        const channel = supabase
            .channel('whatsapp-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
                const newMsg = payload.new as Mensagem
                if (selectedConversa && newMsg.conversa_id === selectedConversa.id) {
                    setMensagens(prev => [...prev, newMsg])
                }
                fetchConversas() // Atualiza lista lateral
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas' }, () => {
                fetchConversas()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [selectedConversa])

    // 4. Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [mensagens])

    // 5. Enviar Mensagem
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !selectedConversa) return

        const msgContent = newMessage
        setNewMessage("")

        try {
            // Chama o backend Node.js
            await axios.post('http://localhost:5000/api/whatsapp/send', {
                conversa_id: selectedConversa.id,
                telefone: selectedConversa.telefone,
                conteudo: msgContent
            })
            // A mensagem aparecerá via Realtime
        } catch (err) {
            console.error(err)
            alert("Erro ao enviar mensagem. Certifique-se que o backend Node.js está rodando na porta 5000.")
        }
    }

    // 6. Busca de Produtos (Coluna Direita)
    const searchProducts = async () => {
        if (!productSearch) return
        const { data } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${productSearch}%`)
            .limit(5)
        setProducts(data || [])
    }

    return (
        <div className="flex h-[calc(100vh-140px)] gap-4 bg-background overflow-hidden">

            {/* COLUNA 1: LISTA DE CONVERSAS */}
            <div className="w-1/4 border border-border rounded-xl bg-card flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                        <MessageCircle className="w-4 h-4 text-primary" /> Conversas
                    </h2>
                    <Badge variant="secondary" className="text-[10px]">{conversas.length}</Badge>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-border/50">
                    {loadingConv ? (
                        <div className="p-8 text-center text-muted-foreground text-xs">
                            <Loader2 className="animate-spin inline mr-2 w-3 h-3" /> Carregando...
                        </div>
                    ) : conversas.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs italic">Nenhuma conversa ativa</div>
                    ) : conversas.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedConversa(conv)}
                            className={`p-4 cursor-pointer transition-all hover:bg-muted/50 relative ${selectedConversa?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${selectedConversa?.id === conv.id ? 'border-primary/50 bg-primary/10' : 'border-muted bg-muted/30'}`}>
                                    <User className={`w-5 h-5 ${selectedConversa?.id === conv.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="font-bold text-sm truncate">{conv.cliente_nome}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{conv.telefone}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUNA 2: JANELA DE CHAT */}
            <div className="flex-1 border border-border rounded-xl bg-card flex flex-col overflow-hidden shadow-md">
                {selectedConversa ? (
                    <>
                        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm">{selectedConversa.cliente_nome}</div>
                                    <div className="text-[10px] text-emerald-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Em atendimento
                                    </div>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono">{selectedConversa.telefone}</Badge>
                        </div>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5 relative"
                            style={{ backgroundImage: 'radial-gradient(#ffffff05 1px, transparent 0)', backgroundSize: '20px 20px' }}
                        >
                            {loadingMsg ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                                    <Loader2 className="animate-spin mr-2 w-4 h-4" /> Carregando histórico...
                                </div>
                            ) : mensagens.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">
                                    Inicie a conversa enviando uma mensagem.
                                </div>
                            ) : (
                                mensagens.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.tipo_envio === 'sent' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm text-sm relative group ${msg.tipo_envio === 'sent'
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-muted/80 text-foreground rounded-tl-none border border-border/50'
                                            }`}>
                                            {msg.conteudo}
                                            <div className={`text-[9px] mt-1 opacity-60 text-right font-mono`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-muted/20 flex gap-2">
                            <Input
                                placeholder="Escreva sua resposta..."
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                className="bg-background border-border/50 focus-visible:ring-primary"
                            />
                            <Button type="submit" size="icon" className="shrink-0 shadow-lg shadow-primary/20">
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                            <MessageCircle className="w-10 h-10 opacity-20" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Central de Atendimento</h3>
                        <p className="max-w-xs text-sm mt-3 opacity-60">Selecione um cliente ao lado para visualizar o histórico de mensagens e responder em tempo real.</p>
                    </div>
                )}
            </div>

            {/* COLUNA 3: DASHBOARD / MINI ESTOQUE */}
            <div className="w-1/4 space-y-4 overflow-y-auto pr-1">
                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-primary">
                            <Package className="w-3 h-3" /> Estoque de Peças
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-1">
                            <Input
                                placeholder="Buscar peça..."
                                className="h-8 text-xs bg-background"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchProducts()}
                            />
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={searchProducts}><Search className="w-3 h-3" /></Button>
                        </div>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                            {products.length === 0 && productSearch && <div className="text-[10px] text-center text-muted-foreground py-2">Nenhum resultado</div>}
                            {products.map(p => (
                                <div key={p.id} className="p-2 border border-border/50 rounded-lg bg-background/50 text-[11px] group hover:border-primary/50 transition-colors">
                                    <div className="font-bold truncate group-hover:text-primary transition-colors">{p.nome}</div>
                                    <div className="flex justify-between mt-1 text-muted-foreground">
                                        <span className={p.estoque_atual <= p.estoque_minimo ? "text-rose-500 font-bold" : ""}>Disp: {p.estoque_atual}</span>
                                        <span className="text-foreground font-black">R${p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-amber-600">
                            <ShoppingCart className="w-3 h-3" /> Ações Rápidas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start gap-2 h-8 text-[11px] border-amber-500/20 hover:bg-amber-500/10 font-medium">
                            <ShoppingCart className="w-3 h-3" /> Novo Pedido de Venda
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2 h-8 text-[11px] border-amber-500/20 hover:bg-amber-500/10 font-medium">
                            <FileText className="w-3 h-3" /> Criar Orçamento
                        </Button>
                        <div className="mt-4 pt-4 border-t border-amber-500/10 pt-2 space-y-1">
                            <p className="text-[10px] font-bold text-amber-700/70 uppercase px-1">Links Úteis</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-background/50 rounded text-[9px] text-center border border-border/50">Tabela FIPE</div>
                                <div className="p-2 bg-background/50 rounded text-[9px] text-center border border-border/50">Catálogo TecDoc</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    )
}
