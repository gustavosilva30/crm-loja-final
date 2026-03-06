import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Search, Send, User, MessageCircle, Package, ShoppingCart,
    Loader2, FileText, Paperclip, X, Image as ImageIcon,
    Headphones, FileDown, MoreVertical, Smile, Mic,
    ChevronRight, PanelsRightBottom, UserPlus, Phone, Mail,
    StopCircle
} from "lucide-react"
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
    mensagem?: string
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

    // Contatos
    const [showNewContactModal, setShowNewContactModal] = useState(false)
    const [newContact, setNewContact] = useState({ nome: "", telefone: "", email: "" })

    // UI State
    const [showRightPanel, setShowRightPanel] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fileBase64, setFileBase64] = useState<string>("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const { atendente } = useAuthStore()

    // Audio Recording
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

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

    useEffect(() => {
        if (selectedConversa) fetchMensagens(selectedConversa.id)
    }, [selectedConversa])

    // 3. Realtime
    useEffect(() => {
        fetchConversas()
        const channel = supabase.channel('whatsapp-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
                const newMsg = payload.new as Mensagem
                if (selectedConversa && newMsg.conversa_id === selectedConversa.id) {
                    setMensagens(prev => [...prev, newMsg])
                }
                fetchConversas()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, () => fetchConversas())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [selectedConversa])

    // 4. Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [mensagens])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 20 * 1024 * 1024) return alert("Máximo 20MB")
        setSelectedFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setFileBase64(reader.result as string)
        reader.readAsDataURL(file)
    }

    const removeFile = () => {
        setSelectedFile(null)
        setFileBase64("")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // Gravação de Áudio
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data)
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' })
                const reader = new FileReader()
                reader.onloadend = () => {
                    const base64 = reader.result as string
                    sendAudioMessage(base64)
                }
                reader.readAsDataURL(audioBlob)
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        } catch (err) {
            console.error("Erro ao acessar microfone:", err)
            alert("Não foi possível acessar seu microfone. Verifique as permissões do navegador.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const sendAudioMessage = async (base64: string) => {
        if (!selectedConversa) return
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/send`, {
                conversa_id: selectedConversa.id,
                telefone: selectedConversa.telefone,
                atendente_id: atendente?.id,
                mediaBase64: base64,
                mediaMimeType: 'audio/ogg; codecs=opus',
                mediaFileName: `audio-${Date.now()}.ogg`
            })
        } catch (err) {
            console.error(err)
            alert("Erro ao enviar áudio.")
        }
    }

    // 5. Enviar Mensagem
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!newMessage.trim() && !fileBase64) || !selectedConversa) return

        const payload = {
            conversa_id: selectedConversa.id,
            telefone: selectedConversa.telefone,
            conteudo: newMessage,
            atendente_id: atendente?.id,
            mediaBase64: fileBase64 || undefined,
            mediaMimeType: selectedFile?.type || undefined,
            mediaFileName: selectedFile?.name || undefined
        }

        setNewMessage("")
        removeFile()

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/send`, payload)
        } catch (err: any) {
            console.error("Erro ao enviar via API:", err.response?.data || err.message)
            alert(`Erro ao enviar mensagem: ${err.response?.data?.error || "Verifique o backend"}`)
        }
    }

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newContact.nome || !newContact.telefone) return
        const tel = newContact.telefone.replace(/\D/g, '')
        try {
            const { data: convData, error: convErr } = await supabase
                .from('conversas')
                .upsert({ telefone: tel, cliente_nome: newContact.nome, status_aberto: true }, { onConflict: 'telefone' })
                .select().single()
            if (convErr) throw convErr
            setShowNewContactModal(false)
            setNewContact({ nome: "", telefone: "", email: "" })
            fetchConversas()
            setSelectedConversa(convData)
        } catch (err) {
            console.error(err)
            alert("Erro ao criar contato.")
        }
    }

    const searchProducts = async () => {
        if (!productSearch) return
        const { data } = await supabase.from('produtos').select('*').ilike('nome', `%${productSearch}%`).limit(5)
        setProducts(data || [])
    }

    const renderMedia = (msg: Mensagem) => {
        if (!msg.media_url) return null;
        const mt = msg.media_type || msg.tipo;
        if (mt === 'image') return <img src={msg.media_url} className="max-w-xs rounded-lg mt-1 mb-1 border border-black/5" />;
        if (mt === 'audio') return <audio controls src={msg.media_url} className="h-8 mt-1 scale-90 -ml-4" />;
        if (mt === 'video') return <video controls src={msg.media_url} className="max-w-xs rounded-lg mt-1" />;
        return (
            <a href={msg.media_url} target="_blank" className="flex items-center gap-2 p-2 bg-black/5 rounded mt-1">
                <FileDown className="w-5 h-5 text-gray-500" />
                <span className="text-xs truncate">{msg.file_name || 'Arquivo'}</span>
            </a>
        )
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex h-[calc(100vh-140px)] bg-[#f0f2f5] dark:bg-[#0c1317] overflow-hidden rounded-lg shadow-2xl border border-border/10">

            {/* BARRA LATERAL */}
            <div className="w-[350px] sm:w-[400px] border-r border-[#d1d7db] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col z-20 shrink-0">
                <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-[#374248] flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowNewContactModal(true)}>
                            <UserPlus className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]"><MoreVertical className="w-5 h-5" /></Button>
                    </div>
                </div>

                <div className="p-2 bg-white dark:bg-[#111b21]">
                    <div className="bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg h-9 flex items-center px-3 gap-3">
                        <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
                        <input placeholder="Pesquisar conversa" className="bg-transparent border-none outline-none text-sm flex-1 text-foreground" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingConv ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                    ) : (
                        conversas.map(conv => (
                            <div key={conv.id} onClick={() => setSelectedConversa(conv)}
                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors 
                                    ${selectedConversa?.id === conv.id ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`}>
                                <div className="w-12 h-12 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0">
                                    <User className="w-7 h-7 text-[#adb5bd]" />
                                </div>
                                <div className="flex-1 min-w-0 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium truncate text-[#111b21] dark:text-[#e9edef]">{conv.cliente_nome}</span>
                                        <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">{new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="text-sm text-[#667781] dark:text-[#8696a0] truncate mt-0.5">{conv.telefone}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* CHAT */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative">
                {selectedConversa ? (
                    <>
                        <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0 z-10 border-l border-[#d1d7db] dark:border-[#222d34]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0"><User className="w-6 h-6 text-[#adb5bd]" /></div>
                                <div>
                                    <div className="font-medium text-[#111b21] dark:text-[#e9edef]">{selectedConversa.cliente_nome}</div>
                                    <div className="text-[11px] text-[#667781] dark:text-[#8696a0]">online</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-[#54656f] dark:text-[#aebac1]">
                                <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(!showRightPanel)} className={`rounded-full ${showRightPanel ? 'bg-primary/10 text-primary' : ''}`}><PanelsRightBottom className="w-5 h-5" /></Button>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:opacity-40 custom-scrollbar" style={{ backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
                            {mensagens.map(msg => {
                                const isSent = msg.tipo_envio === 'sent'
                                return (
                                    <div key={msg.id} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] px-2 py-1.5 rounded-lg shadow-sm text-sm relative ${isSent ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'}`}>
                                            {renderMedia(msg)}
                                            <div className="whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef] pr-12 min-h-[1.2rem]">{msg.conteudo || msg.mensagem}</div>
                                            <div className="absolute bottom-1 right-1 flex items-center gap-1 text-[10px] text-gray-500 dark:text-[#8696a0]">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {isSent && <svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-500"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* INPUT */}
                        <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-center gap-3 shrink-0">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

                            {isRecording ? (
                                <div className="flex-1 flex items-center gap-4 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2">
                                    <StopCircle className="w-6 h-6 text-red-500 cursor-pointer animate-pulse" onClick={stopRecording} />
                                    <div className="flex-1 text-red-500 font-medium">Gravando... {formatTime(recordingTime)}</div>
                                </div>
                            ) : (
                                <>
                                    <Smile className="w-6 h-6 text-[#54656f] dark:text-[#aebac1] cursor-pointer" />
                                    <Paperclip className={`w-6 h-6 rotate-45 cursor-pointer ${selectedFile ? 'text-primary' : 'text-[#54656f] dark:text-[#aebac1]'}`} onClick={() => fileInputRef.current?.click()} />

                                    <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                                        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2 relative">
                                            {selectedFile && (
                                                <div className="mb-2 p-2 bg-black/5 dark:bg-black/20 rounded-md flex items-center justify-between">
                                                    <span className="text-xs truncate max-w-[200px]">{selectedFile.name}</span>
                                                    <X className="w-4 h-4 cursor-pointer text-red-500" onClick={removeFile} />
                                                </div>
                                            )}
                                            <input placeholder="Digite uma mensagem" className="bg-transparent border-none outline-none w-full text-sm text-foreground" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                                        </div>

                                        {newMessage || selectedFile ? (
                                            <Button type="submit" variant="ghost" size="icon" className="text-primary hover:bg-transparent"><Send className="w-6 h-6" /></Button>
                                        ) : (
                                            <Mic className="w-6 h-6 text-[#54656f] dark:text-[#aebac1] cursor-pointer" onClick={startRecording} />
                                        )}
                                    </form>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 border-l border-[#d1d7db] dark:border-[#222d34]">
                        <div className="w-64 h-64 opacity-10 mb-8 bg-[url('https://whatsapp.com/apple-touch-icon.png')] bg-center bg-no-repeat bg-contain"></div>
                        <h2 className="text-2xl font-light text-[#41525d] dark:text-[#e9edef] mt-10">CRM Loja WhatsApp</h2>
                    </div>
                )}

                {/* PAINEL DIREITO */}
                <div className={`absolute right-0 top-0 bottom-0 w-[320px] bg-white dark:bg-[#111b21] border-l border-[#d1d7db] dark:border-[#222d34] shadow-2xl transition-transform duration-300 z-30 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center gap-6 shrink-0">
                        <X className="w-5 h-5 cursor-pointer text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowRightPanel(false)} />
                        <span className="font-medium text-foreground">Dados da Ferramenta</span>
                    </div>
                    <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="pb-2 p-3"><CardTitle className="text-xs uppercase flex items-center gap-2 text-primary font-bold"><Package className="w-4 h-4" /> Estoque</CardTitle></CardHeader>
                            <CardContent className="p-3 pt-0 space-y-3">
                                <div className="flex gap-1">
                                    <Input placeholder="Buscar..." className="h-8 text-xs bg-background" value={productSearch} onChange={e => setProductSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
                                    <Button size="icon" className="h-8 w-8" onClick={searchProducts}><Search className="w-3 h-3" /></Button>
                                </div>
                                <div className="space-y-2">{products.map(p => (<div key={p.id} className="p-2 border border-border/50 rounded bg-background text-[11px]"><div className="font-bold truncate">{p.nome}</div><div className="flex justify-between mt-1 text-primary"><span>E: {p.estoque_atual}</span><span className="font-bold">R$ {p.preco.toFixed(2)}</span></div></div>))}</div>
                            </CardContent>
                        </Card>
                        <Card className="border-amber-500/20 bg-amber-500/5">
                            <CardHeader className="pb-2 p-3"><CardTitle className="text-xs uppercase flex items-center gap-2 text-amber-600 font-bold"><ShoppingCart className="w-4 h-4" /> Ferramentas</CardTitle></CardHeader>
                            <CardContent className="p-3 pt-0 space-y-2">
                                <Button variant="outline" className="w-full justify-start h-8 text-[11px] gap-2 border-amber-500/30 text-amber-700"><ShoppingCart className="w-3 h-3" /> Gerar Venda</Button>
                                <Button variant="outline" className="w-full justify-start h-8 text-[11px] gap-2 border-amber-500/30 text-amber-700"><FileText className="w-3 h-3" /> Novo Orçamento</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* MODAL NOVO CONTATO */}
            {showNewContactModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 border border-border">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2"><UserPlus className="text-primary w-6 h-6" /> Novo Contato</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowNewContactModal(false)}><X /></Button>
                        </div>
                        <form onSubmit={handleCreateContact} className="space-y-4">
                            <div className="space-y-2"><label className="text-xs font-bold uppercase opacity-60">Nome</label><Input required value={newContact.nome} onChange={e => setNewContact({ ...newContact, nome: e.target.value })} /></div>
                            <div className="space-y-2"><label className="text-xs font-bold uppercase opacity-60">WhatsApp</label><Input required placeholder="Ex: 5567999887766" value={newContact.telefone} onChange={e => setNewContact({ ...newContact, telefone: e.target.value })} /></div>
                            <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 mt-6">Salvar e Abrir Chat</Button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </div>
    )
}
