import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Send, User, MessageCircle, Package, ShoppingCart, Loader2, FileText, Paperclip, X, Image as ImageIcon, Headphones, FileDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import axios from "axios"
import { useAuthStore } from "@/store/authStore"

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
    mensagem?: string // Fallback
    remetente?: string
    tipo_envio: 'sent' | 'received'
    timestamp: string
    tipo?: string
    media_type?: string
    media_url?: string
    file_name?: string
    mime_type?: string
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

    // Anexos
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fileBase64, setFileBase64] = useState<string>("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const { atendente } = useAuthStore()

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
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas' }, (payload) => {
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

    // Lidar com arquivo selecionado
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 20 * 1024 * 1024) { // 20 MB max
            alert("O arquivo é muito grande. O tamanho máximo permitido é 20MB.")
            return
        }

        setSelectedFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
            setFileBase64(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const removeFile = () => {
        setSelectedFile(null)
        setFileBase64("")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // 5. Enviar Mensagem
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!newMessage.trim() && !fileBase64) || !selectedConversa) return

        const msgContent = newMessage
        const fileData = fileBase64
        const fileName = selectedFile?.name
        const fileMime = selectedFile?.type

        setNewMessage("")
        removeFile() // Limpa o imput imediatamente para melhor UX

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/send`, {
                conversa_id: selectedConversa.id,
                telefone: selectedConversa.telefone,
                conteudo: msgContent,
                atendente_id: atendente?.id,
                mediaBase64: fileData || undefined,
                mediaMimeType: fileMime || undefined,
                mediaFileName: fileName || undefined
            })
            // A mensagem aparecerá via Realtime
        } catch (err) {
            console.error(err)
            alert("Erro ao enviar mensagem. Certifique-se que o backend Node.js está rodando e a URL de API está correta.")
        }
    }

    // 6. Busca de Produtos
    const searchProducts = async () => {
        if (!productSearch) return
        const { data } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${productSearch}%`)
            .limit(5)
        setProducts(data || [])
    }

    // Helper URLs clicaveis
    const parseTextWithLinks = (text: string) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-400 break-all">{part}</a>;
            }
            return <span key={i}>{part}</span>;
        });
    }

    // Renderizar Mídia
    const renderMedia = (msg: Mensagem) => {
        if (!msg.media_url) return null;
        const mt = msg.media_type || msg.tipo;

        if (mt === 'image' || msg.mime_type?.startsWith('image/')) {
            return (
                <div className="mt-2 mb-1 cursor-pointer">
                    <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.media_url} alt="anexo" className="max-w-[200px] sm:max-w-xs max-h-64 object-cover rounded-lg shadow-sm border border-border/50 hover:opacity-90 transition-opacity" />
                    </a>
                </div>
            )
        }
        if (mt === 'audio' || msg.mime_type?.startsWith('audio/')) {
            return (
                <div className="mt-2 mb-1 w-full max-w-[240px]">
                    <audio controls src={msg.media_url} className="w-full h-10 custom-audio" />
                </div>
            )
        }
        if (mt === 'video' || msg.mime_type?.startsWith('video/')) {
            return (
                <div className="mt-2 mb-1">
                    <video controls src={msg.media_url} className="max-w-[200px] sm:max-w-xs max-h-64 rounded-lg bg-black" />
                </div>
            )
        }
        // Fallback p/ Documento
        return (
            <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 p-2 bg-background/50 border border-border/50 rounded-lg hover:bg-background/80 transition-colors max-w-xs">
                <FileDown className="w-8 h-8 text-primary" />
                <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">{msg.file_name || 'Documento Anexo'}</p>
                    <p className="text-[10px] opacity-70">Clique para baixar</p>
                </div>
            </a>
        )
    }

    return (
        <div className="flex h-[calc(100vh-140px)] gap-4 bg-background overflow-hidden relative">

            {/* COLUNA 1: LISTA DE CONVERSAS */}
            <div className="w-1/4 min-w-[250px] border border-border rounded-xl bg-card flex flex-col overflow-hidden shadow-sm hover:shadow-primary/5 transition-all">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between backdrop-blur-sm">
                    <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-primary">
                        <MessageCircle className="w-4 h-4" /> Chats
                    </h2>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">{conversas.length}</Badge>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-border/30 custom-scrollbar">
                    {loadingConv ? (
                        <div className="p-8 text-center text-foreground text-xs flex flex-col items-center">
                            <Loader2 className="animate-spin mb-2 w-5 h-5 text-primary" />
                            <span className="opacity-70">Carregando conversas...</span>
                        </div>
                    ) : conversas.length === 0 ? (
                        <div className="p-8 text-center text-foreground text-xs italic opacity-50">Nenhuma conversa ativa no momento</div>
                    ) : conversas.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedConversa(conv)}
                            className={`p-4 cursor-pointer transition-all duration-200 hover:bg-muted/50 relative overflow-hidden group 
                                ${selectedConversa?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                    ${selectedConversa?.id === conv.id ? 'border-primary/50 bg-primary/10 scale-105 shadow-md shadow-primary/20' : 'border-muted bg-muted/30 group-hover:border-primary/30'}`}>
                                    <User className={`w-6 h-6 transition-colors duration-300 ${selectedConversa?.id === conv.id ? 'text-primary' : 'text-foreground/70 group-hover:text-primary/70'}`} />
                                </div>
                                <div className="flex-1 overflow-hidden min-w-0">
                                    <div className="font-bold text-sm truncate text-foreground/90 group-hover:text-primary transition-colors">{conv.cliente_nome}</div>
                                    <div className="text-[11px] text-foreground/60 font-mono mt-0.5">{conv.telefone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 $2 $3-$4')}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUNA 2: JANELA DE CHAT */}
            <div className="flex-1 border border-border rounded-xl bg-card flex flex-col overflow-hidden shadow-md relative group/chat outline outline-1 outline-transparent focus-within:outline-primary/20 transition-all">
                {selectedConversa ? (
                    <>
                        <div className="p-4 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md z-10 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                                    <User className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <div className="font-bold text-base tracking-tight">{selectedConversa.cliente_nome}</div>
                                    <div className="text-[11px] text-emerald-500/90 flex items-center gap-1.5 font-medium mt-0.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Em atendimento contínuo
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[11px] font-mono py-1 px-3 border-border/50 bg-background/50 shadow-sm">{selectedConversa.telefone}</Badge>
                            </div>
                        </div>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#0a0f18]/40 relative custom-scrollbar scroll-smooth"
                        >
                            {/* Padrão de Fundo Estilo WhatsApp Escuro */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cpath d=\\"M54.627 0l.83.83-1.66 1.66-.83-.83.83-.83zM32.553 0l3.32 3.32-1.66 1.66-3.32-3.32 1.66-1.66zM24.253 10l.83.83-1.66 1.66-.83-.83.83-.83zM5.895 24.253l.83.83-1.66 1.66-.83-.83.83-.83zM0 32.553l3.32 3.32-1.66 1.66-3.32-3.32L0 32.553zm60 6.64l-3.32 3.32 1.66 1.66 3.32-3.32-1.66-1.66zm-45.747 0l.83.83-1.66 1.66-.83-.83.83-.83zM25.083 45.747l.83.83-1.66 1.66-.83-.83.83-.83zM54.627 60l.83-.83-1.66-1.66-.83.83.83.83zm-4.98 0l.83-.83-1.66-1.66-.83.83.83.83zm-4.98 0l.83-.83-1.66-1.66-.83.83.83.83zm-4.98 0l.83-.83-1.66-1.66-.83.83.83.83zm-4.98 0l.83-.83-1.66-1.66-.83.83.83.83z\\" fill=\\"%23ffffff\\" fill-opacity=\\"1\\" fill-rule=\\"evenodd\\"%3E%3C/path%3E%3C/svg%3E")', backgroundSize: '150px' }}></div>

                            {loadingMsg ? (
                                <div className="flex items-center justify-center h-full text-foreground text-xs flex-col z-10 relative">
                                    <Loader2 className="animate-spin mb-3 w-6 h-6 text-primary" />
                                    <span className="opacity-70 bg-background/50 px-3 py-1 rounded-full backdrop-blur-sm">Sincronizando histórico...</span>
                                </div>
                            ) : mensagens.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-foreground text-xs italic opacity-50 z-10 relative">
                                    <span className="bg-background/80 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm">A conversa está vazia. Envie uma mensagem ou arquivo para iniciar.</span>
                                </div>
                            ) : (
                                mensagens.map((msg, index) => {
                                    const isLast = index === mensagens.length - 1;
                                    const isSent = msg.tipo_envio === 'sent';
                                    return (
                                        <div key={msg.id} className={`flex w-full mb-3 z-10 relative ${isSent ? 'justify-end' : 'justify-start'} ${isLast ? 'animate-in slide-in-from-bottom-2 fade-in duration-300' : ''}`}>
                                            <div className={`max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] flex flex-col p-3 rounded-2xl shadow-sm text-[13px] md:text-sm relative group overflow-hidden break-words transition-transform hover:scale-[1.01] ${isSent
                                                ? 'bg-primary/95 text-primary-foreground rounded-br-sm backdrop-blur-sm shadow-primary/10 border border-primary/20'
                                                : 'bg-card text-foreground rounded-bl-sm border border-border/60 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]'
                                                }`}>

                                                {/* Pontinha do balão */}
                                                <div className={`absolute top-0 w-3 h-3 ${isSent ? 'right-[-5px] bg-primary/95 clip-path-sent' : 'left-[-5px] bg-card border-l border-t border-border/60 clip-path-received'} hidden sm:block`}></div>

                                                {renderMedia(msg)}

                                                <div className="whitespace-pre-wrap leading-relaxed mt-1">
                                                    {parseTextWithLinks(msg.conteudo || msg.mensagem || '')}
                                                </div>

                                                <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${isSent ? 'text-primary-foreground/70 justify-end' : 'text-foreground/50 justify-end'} font-mono`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isSent && (
                                                        <svg viewBox="0 0 16 15" width="12" height="11" fill="currentColor">
                                                            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path>
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Pré-visualização de anexo */}
                        {selectedFile && (
                            <div className="px-4 py-2 border-t border-border bg-card flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border overflow-hidden shrink-0 relative">
                                    {selectedFile.type.startsWith('image/') && fileBase64 ? (
                                        <img src={fileBase64} alt="preview" className="w-full h-full object-cover" />
                                    ) : selectedFile.type.startsWith('audio/') ? (
                                        <Headphones className="w-5 h-5 text-primary" />
                                    ) : (
                                        <FileText className="w-5 h-5 text-primary" />
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-bold truncate text-foreground/90">{selectedFile.name}</p>
                                    <p className="text-[10px] text-foreground/50">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-border bg-card flex items-end gap-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] relative z-20">

                            {/* Input oculto */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx"
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => fileInputRef.current?.click()}
                                className="shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-colors text-foreground/60"
                                title="Anexar arquivo"
                            >
                                <Paperclip className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                            </Button>

                            <Input
                                placeholder={selectedFile ? "Adicione uma legenda (opcional)..." : "Escreva sua mensagem profissional..."}
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                className="bg-background/50 h-10 sm:h-12 border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-sm shadow-inner min-w-0"
                            />

                            <Button
                                type="submit"
                                size="icon"
                                disabled={(!newMessage.trim() && !selectedFile) || loadingMsg}
                                className={`shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-xl shadow-lg transition-all duration-300 ${newMessage.trim() || selectedFile ? 'bg-primary hover:bg-primary/95 hover:scale-105 hover:shadow-primary/30' : 'bg-muted text-foreground/30 shadow-none'}`}
                            >
                                <Send className={`w-[18px] h-[18px] sm:w-5 sm:h-5 ${newMessage.trim() || selectedFile ? 'translate-x-[2px] -translate-y-[2px]' : ''} transition-transform`} />
                            </Button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-foreground p-10 text-center bg-gradient-to-b from-card to-background relative overflow-hidden">
                        {/* Background decorativo */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,theme(colors.primary.DEFAULT/0.05)_0%,transparent_100%)] pointer-events-none"></div>

                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-xl shadow-primary/5 border border-primary/10 relative">
                            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary/40"></div>
                            <MessageCircle className="w-10 h-10 text-primary opacity-60 ml-1" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground/90 tracking-tight">Atendimento Inteligente</h3>
                        <p className="max-w-md text-sm mt-3 text-foreground/60 leading-relaxed">
                            Selecione um cliente na lista à esquerda para visualizar o histórico completo de interações, enviar mensagens e gerenciar anexos em tempo real.
                        </p>
                    </div>
                )}
            </div>

            {/* COLUNA 3: DASHBOARD / MINI ESTOQUE */}
            <div className="w-[30%] min-w-[280px] space-y-4 overflow-y-auto pr-1 hidden lg:block custom-scrollbar">
                <Card className="border-primary/20 bg-card shadow-sm hover:shadow-primary/5 transition-shadow">
                    <CardHeader className="pb-3 border-b border-border/50 bg-primary/5">
                        <CardTitle className="text-[11px] uppercase tracking-widest flex items-center gap-2 text-primary font-bold">
                            <Package className="w-[14px] h-[14px]" /> Estoque Rápido
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="flex gap-2 relative group focus-within:z-10">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Procurar peça ou código..."
                                className="h-9 text-xs bg-background/50 pl-9 border-border/60 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all rounded-lg"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchProducts()}
                            />
                            <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg hover:bg-primary hover:text-primary-foreground shadow-sm transition-colors" variant="secondary" onClick={searchProducts}>
                                <Search className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar -mr-1">
                            {products.length === 0 && productSearch && (
                                <div className="text-[11px] text-center text-foreground/50 py-4 bg-muted/20 rounded-lg border border-border/30 border-dashed">Nenhuma peça encontrada</div>
                            )}
                            {products.map(p => (
                                <div key={p.id} className="p-3 border border-border/40 rounded-lg bg-background/40 hover:bg-background/80 text-[11px] group hover:border-primary/40 transition-all shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary transition-colors"></div>
                                    <div className="font-bold truncate group-hover:text-primary transition-colors text-foreground/90 pl-1">{p.nome}</div>
                                    <div className="flex justify-between items-end mt-2 pl-1">
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border-border/50 ${p.estoque_atual <= p.estoque_minimo ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
                                            Qtd: {p.estoque_atual}
                                        </Badge>
                                        <span className="text-foreground/90 font-black text-xs">R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-500/20 bg-card shadow-sm hover:shadow-amber-500/5 transition-shadow mt-4">
                    <CardHeader className="pb-3 border-b border-border/50 bg-amber-500/5">
                        <CardTitle className="text-[11px] uppercase tracking-widest flex items-center gap-2 text-amber-600 font-bold">
                            <ShoppingCart className="w-[14px] h-[14px]" /> Ferramentas de Vendas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5 pt-4">
                        <Button variant="outline" className="w-full justify-start gap-3 h-9 text-[11px] border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/40 font-semibold shadow-sm rounded-lg transition-all group">
                            <div className="bg-amber-500/10 p-1.5 rounded-md group-hover:bg-amber-500/20 transition-colors"><ShoppingCart className="w-3.5 h-3.5 text-amber-600" /></div>
                            Injetar no PDV
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-3 h-9 text-[11px] border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/40 font-semibold shadow-sm rounded-lg transition-all group">
                            <div className="bg-amber-500/10 p-1.5 rounded-md group-hover:bg-amber-500/20 transition-colors"><FileText className="w-3.5 h-3.5 text-amber-600" /></div>
                            Gerar Orçamento Rápido
                        </Button>

                        <div className="mt-5 pt-3 border-t border-border/50 space-y-3">
                            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">Links Externos</p>
                            <div className="grid grid-cols-2 gap-2">
                                <a href="#" target="_blank" className="p-2 bg-gradient-to-br from-background to-muted rounded-lg text-[10px] text-center border border-border/60 hover:border-primary/40 hover:text-primary transition-colors shadow-sm font-medium flex flex-col items-center gap-1">
                                    <Search className="w-3 h-3 opacity-50" /> FIPE
                                </a>
                                <a href="#" target="_blank" className="p-2 bg-gradient-to-br from-background to-muted rounded-lg text-[10px] text-center border border-border/60 hover:border-primary/40 hover:text-primary transition-colors shadow-sm font-medium flex flex-col items-center gap-1">
                                    <FileText className="w-3 h-3 opacity-50" /> TecDoc
                                </a>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Custom Styles that can't be easily done with tailwind utilities */}
            <style>{`
                .clip-path-sent { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 0); }
                .clip-path-received { clip-path: polygon(0 0, 100% 0, 0 100%, 0 0); }
                .custom-audio::-webkit-media-controls-panel { background-color: rgba(255,255,255,0.8); }
                .dark .custom-audio::-webkit-media-controls-panel { background-color: rgba(0,0,0,0.3); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(150, 150, 150, 0.4); }
            `}</style>
        </div>
    )
}
