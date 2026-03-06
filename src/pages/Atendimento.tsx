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
    StopCircle, Filter, Users, LayoutDashboard, Target,
    CheckCircle2, Clock, AlertCircle, TrendingUp, Menu
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import axios from "axios"
import { useAuthStore } from "@/store/authStore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNavigate } from "react-router-dom"

interface Conversa {
    id: string
    cliente_nome: string
    telefone: string
    status_aberto: boolean
    updated_at: string
    etapa_funil?: string
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

interface Contato {
    id: string
    nome: string
    telefone: string
    email?: string
}

const ETAPAS_FUNIL = [
    { label: 'Novo Lead', color: 'bg-blue-500', icon: AlertCircle },
    { label: 'Qualificação', color: 'bg-yellow-500', icon: Clock },
    { label: 'Orçamento', color: 'bg-purple-500', icon: FileText },
    { label: 'Negociação', color: 'bg-orange-500', icon: TrendingUp },
    { label: 'Fechamento', color: 'bg-emerald-500', icon: CheckCircle2 },
    { label: 'Pós-Venda', color: 'bg-indigo-500', icon: Target }
]

export function Atendimento() {
    const navigate = useNavigate()
    const [conversas, setConversas] = useState<Conversa[]>([])
    const [contatos, setContatos] = useState<Contato[]>([])
    const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null)
    const [mensagens, setMensagens] = useState<Mensagem[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [loadingConv, setLoadingConv] = useState(true)
    const [loadingMsg, setLoadingMsg] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState("")

    // UI State
    const [showSidebar, setShowSidebar] = useState(true)
    const [showRightPanel, setShowRightPanel] = useState(false)
    const [showNewContactModal, setShowNewContactModal] = useState(false)
    const [newContact, setNewContact] = useState({ nome: "", telefone: "", email: "" })

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

    // 1. Buscar Conversas e Contatos
    const fetchData = async () => {
        setLoadingConv(true)
        const { data: convs } = await supabase.from('conversas').select('*').order('updated_at', { ascending: false })
        const { data: conts } = await supabase.from('contatos').select('*').order('nome', { ascending: true })
        setConversas(convs || [])
        setContatos(conts || [])
        setLoadingConv(false)
    }

    // 2. Buscar Mensagens
    const fetchMensagens = async (conversaId: string) => {
        setLoadingMsg(true)
        const { data } = await supabase.from('mensagens').select('*').eq('conversa_id', conversaId).order('timestamp', { ascending: true })
        setMensagens(data || [])
        setLoadingMsg(false)
    }

    useEffect(() => {
        if (selectedConversa) fetchMensagens(selectedConversa.id)
    }, [selectedConversa])

    useEffect(() => {
        fetchData()
        const channel = supabase.channel('whatsapp-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as Mensagem
                    if (selectedConversa && newMsg.conversa_id === selectedConversa.id) {
                        setMensagens(prev => [...prev, newMsg])
                    }
                }
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, () => fetchData())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [selectedConversa])

    // Auto-scroll
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

    // Audio Logic
    const startRecording = async () => {
        try {
            // Check for Secure Context or Permissions
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return alert("Seu navegador não suporta gravação de áudio ou o site não está em HTTPS seguro.")
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data)
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' })
                if (audioBlob.size > 0) {
                    const reader = new FileReader()
                    reader.onloadend = () => sendAudioMessage(reader.result as string)
                    reader.readAsDataURL(audioBlob)
                }
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
        } catch (err) {
            console.error("Mic error:", err)
            alert("Erro ao acessar microfone. Verifique as permissões de privacidade do seu navegador.")
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
            console.error("Audio send error:", err)
        }
    }

    // Enviar Mensagem
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
        } catch (err) {
            alert("Erro ao enviar mensagem via backend.")
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
            await supabase.from('contatos').upsert({ nome: newContact.nome, telefone: tel, email: newContact.email })
            if (convErr) throw convErr
            setShowNewContactModal(false)
            setNewContact({ nome: "", telefone: "", email: "" })
            fetchData()
            setSelectedConversa(convData)
        } catch (err) {
            alert("Erro ao criar contato.")
        }
    }

    const updateFunnelStage = async (stage: string) => {
        if (!selectedConversa) return
        const { error } = await supabase.from('conversas').update({ etapa_funil: stage }).eq('id', selectedConversa.id)
        if (!error) {
            setSelectedConversa({ ...selectedConversa, etapa_funil: stage })
            fetchData()
        }
    }

    const handleGenerateVenda = () => {
        if (!selectedConversa) return
        // Tentar buscar ID do cliente pelo telefone para preencher
        supabase.from('clientes').select('id').eq('telefone', selectedConversa.telefone).maybeSingle().then(({ data }) => {
            const clienteId = data?.id || ""
            const cartData = {
                items: [],
                cliente_id: clienteId,
                atendente_id: atendente?.id,
                autoOpenCheckout: true
            }
            localStorage.setItem('crm_venda_cart', JSON.stringify(cartData))
            navigate('/vendas')
        })
    }

    const handleGenerateOrcamento = () => {
        if (!selectedConversa) return
        supabase.from('clientes').select('id').eq('telefone', selectedConversa.telefone).maybeSingle().then(({ data }) => {
            const clienteId = data?.id || ""
            // Lógica similar para orçamentos se houver sistema de rascunho
            navigate('/orcamentos')
        })
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
        <div className="fixed inset-0 top-0 flex bg-[#f0f2f5] dark:bg-[#0c1317] overflow-hidden">

            {/* BARRA LATERAL (FULL HEIGHT) */}
            <div className={`border-r border-[#d1d7db] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col z-20 shrink-0 transition-all duration-300 ${showSidebar ? 'w-[420px]' : 'w-0 overflow-hidden border-none'}`}>
                <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg dark:text-white">CRM Dourados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowNewContactModal(true)}>
                            <UserPlus className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowSidebar(false)}>
                            <Menu className="w-5 h-5 rotate-90" />
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="conversas" className="flex-1 flex flex-col">
                    <div className="px-4 py-2 bg-white dark:bg-[#111b21]">
                        <TabsList className="w-full bg-[#f0f2f5] dark:bg-[#202c33] p-1 rounded-xl">
                            <TabsTrigger value="conversas" className="flex-1 gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-[#374248]">
                                <MessageCircle className="w-4 h-4" /> Chats
                            </TabsTrigger>
                            <TabsTrigger value="contatos" className="flex-1 gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-[#374248]">
                                <Users className="w-4 h-4" /> Contatos
                            </TabsTrigger>
                        </TabsList>
                        <div className="mt-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg h-10 flex items-center px-3 gap-3">
                            <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
                            <input placeholder="Procurar diálogo ou lead..." className="bg-transparent border-none outline-none text-sm flex-1 text-foreground" />
                        </div>
                    </div>

                    <TabsContent value="conversas" className="flex-1 overflow-y-auto custom-scrollbar m-0">
                        {loadingConv ? (
                            <div className="p-10 text-center"><Loader2 className="animate-spin inline text-primary" /></div>
                        ) : conversas.map(conv => (
                            <div key={conv.id} onClick={() => setSelectedConversa(conv)}
                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-[#f2f2f2] dark:border-[#222d34]
                                    ${selectedConversa?.id === conv.id ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`}>
                                <div className="w-12 h-12 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0"><User className="w-7 h-7 text-[#adb5bd]" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium truncate text-[#111b21] dark:text-[#e9edef]">{conv.cliente_nome}</span>
                                        <span className="text-[10px] text-[#8696a0]">{new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex gap-1 items-center mt-1">
                                        {conv.etapa_funil && (
                                            <Badge className={`text-[8px] h-3.5 px-1.5 border-none leading-none shadow-sm ${ETAPAS_FUNIL.find(e => e.label === conv.etapa_funil)?.color || 'bg-gray-400'}`}>
                                                {conv.etapa_funil}
                                            </Badge>
                                        )}
                                        <div className="text-xs text-[#667781] dark:text-[#8696a0] truncate">{conv.telefone}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </TabsContent>

                    <TabsContent value="contatos" className="flex-1 overflow-y-auto custom-scrollbar m-0">
                        {contatos.map(cont => (
                            <div key={cont.id} onClick={() => {
                                const existing = conversas.find(c => c.telefone === cont.telefone)
                                if (existing) setSelectedConversa(existing)
                                else handleCreateContact({ preventDefault: () => { }, target: {} } as any)
                            }}
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] border-b border-[#f2f2f2] dark:border-[#222d34]">
                                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0"><User className="w-5 h-5 text-[#adb5bd]" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-[#111b21] dark:text-[#e9edef]">{cont.nome}</div>
                                    <div className="text-xs text-[#667781] dark:text-[#8696a0]">{cont.telefone}</div>
                                </div>
                            </div>
                        ))}
                    </TabsContent>
                </Tabs>
            </div>

            {/* BOTÃO PARA REABRIR SIDEBAR QUANDO FECHADO */}
            {!showSidebar && (
                <div className="absolute left-4 top-4 z-[50]">
                    <Button variant="default" size="icon" className="rounded-full shadow-2xl scale-110" onClick={() => setShowSidebar(true)}>
                        <Menu className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {/* CHAT (FULL WIDTH) */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative">
                {selectedConversa ? (
                    <>
                        <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0 z-10 border-l border-white/5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0"><User className="w-6 h-6 text-[#adb5bd]" /></div>
                                <div>
                                    <div className="font-medium text-[#111b21] dark:text-[#e9edef]">{selectedConversa.cliente_nome}</div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">WhatsApp CRM Ativo</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex items-center bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-full gap-2 border border-black/5 dark:border-white/5">
                                    <Target className="w-3.5 h-3.5 text-primary" />
                                    <select
                                        className="bg-transparent text-[11px] border-none outline-none font-bold text-foreground cursor-pointer"
                                        value={selectedConversa.etapa_funil || 'Novo Lead'}
                                        onChange={(e) => updateFunnelStage(e.target.value)}
                                    >
                                        {ETAPAS_FUNIL.map(e => <option key={e.label} value={e.label} className="dark:bg-[#202c33]">{e.label}</option>)}
                                    </select>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(!showRightPanel)} className={`rounded-full transition-all ${showRightPanel ? 'bg-primary text-primary-foreground shadow-lg' : 'text-[#54656f] dark:text-[#aebac1]'}`}>
                                    <PanelsRightBottom className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:opacity-[0.03] custom-scrollbar">
                            {mensagens.map((msg, i) => {
                                const isSent = msg.tipo_envio === 'sent'
                                return (
                                    <div key={msg.id} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] px-2.5 py-1.5 rounded-lg shadow-sm text-[13px] md:text-sm relative 
                                            ${isSent ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'}`}>
                                            {renderMedia(msg)}
                                            <div className="whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef] pr-14 min-h-[1.2rem]">{msg.conteudo || msg.mensagem}</div>
                                            <div className="absolute bottom-1 right-1.5 flex items-center gap-1 text-[9px] text-[#667781] dark:text-[#8696a0b3] font-mono">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {isSent && <svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-500"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 flex items-center gap-3 shrink-0 border-t border-black/5 z-20">
                            {isRecording ? (
                                <div className="flex-1 flex items-center gap-4 bg-white dark:bg-[#2a3942] rounded-full px-6 py-3 shadow-xl border border-red-500/20">
                                    <StopCircle className="w-8 h-8 text-red-500 cursor-pointer animate-pulse" onClick={stopRecording} />
                                    <div className="flex-1 text-red-500 font-bold flex items-center gap-3">
                                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                                        GRAVANDO MENSAGEM {formatTime(recordingTime)}
                                    </div>
                                    <Button variant="ghost" className="text-xs hover:bg-red-500/10 rounded-full" onClick={() => setIsRecording(false)}>Cancelar</Button>
                                </div>
                            ) : (
                                <>
                                    <Smile className="w-6 h-6 text-[#54656f] dark:text-[#aebac1] cursor-pointer hover:text-primary transition-colors" />
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                    <Paperclip className={`w-6 h-6 rotate-45 cursor-pointer transition-colors ${selectedFile ? 'text-primary' : 'text-[#54656f] dark:text-[#aebac1] hover:text-primary'}`} onClick={() => fileInputRef.current?.click()} />

                                    <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                                        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-5 py-2.5 relative border border-black/10 dark:border-white/5 shadow-inner">
                                            {selectedFile && (
                                                <div className="mb-2 p-2 bg-primary/5 rounded-lg flex items-center justify-between border border-primary/20 animate-in slide-in-from-bottom-2">
                                                    <span className="text-xs font-bold truncate max-w-[250px]">{selectedFile.name}</span>
                                                    <X className="w-4 h-4 cursor-pointer text-red-500 hover:scale-110" onClick={removeFile} />
                                                </div>
                                            )}
                                            <input placeholder="Escreva uma mensagem profissional..." className="bg-transparent border-none outline-none w-full text-sm text-foreground" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                                        </div>
                                        {newMessage || selectedFile ? (
                                            <Button type="submit" variant="default" size="icon" className="rounded-full w-11 h-11 shadow-lg hover:scale-110 transition-transform"><Send className="w-5 h-5 translate-x-[1px] -translate-y-[1px]" /></Button>
                                        ) : (
                                            <Mic className="w-6 h-6 text-[#54656f] dark:text-[#aebac1] cursor-pointer hover:text-primary transition-colors" onClick={startRecording} />
                                        )}
                                    </form>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
                        <div className="w-56 h-56 opacity-10 bg-[url('https://whatsapp.com/apple-touch-icon.png')] bg-center bg-no-repeat bg-contain filter grayscale animate-pulse"></div>
                        <h2 className="text-4xl font-black text-[#41525d] dark:text-[#e9edef] mt-10 tracking-tight">WhatsApp CRM</h2>
                        <p className="text-sm text-[#667781] dark:text-[#8696a0] mt-3 max-w-md text-center leading-relaxed">Selecione uma conversa ou contato no painel lateral para iniciar o atendimento integrado ao catálogo.</p>
                        <div className="flex items-center gap-3 mt-24 text-[11px] text-[#8696a0] font-bold uppercase tracking-widest opacity-30">
                            <TrendingUp className="w-4 h-4" /> Inteligência Comercial Ativa
                        </div>
                    </div>
                )}

                {/* PAINEL DIREITO (DESLIZANTE) */}
                <div className={`absolute right-0 top-0 bottom-0 w-[400px] bg-white dark:bg-[#111b21] border-l border-[#d1d7db] dark:border-[#222d34] shadow-[0_-15px_60px_-15px_rgba(0,0,0,0.3)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-30 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center gap-4 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(false)} className="rounded-full"><X className="w-5 h-5" /></Button>
                        <span className="font-black text-xs uppercase tracking-widest">Painel de Negócios</span>
                    </div>

                    <div className="p-6 space-y-8 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
                        {/* Ações */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Filter className="w-3 h-3" /> Ações do Comercial
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={handleGenerateVenda}
                                    variant="outline"
                                    className="h-24 flex-col gap-2 rounded-2xl border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group transition-all hover:scale-105"
                                >
                                    <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    <span className="text-[11px] font-black">GERAR VENDA</span>
                                </Button>
                                <Button
                                    onClick={handleGenerateOrcamento}
                                    variant="outline"
                                    className="h-24 flex-col gap-2 rounded-2xl border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-400 group transition-all hover:scale-105"
                                >
                                    <FileText className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    <span className="text-[11px] font-black">ORÇAMENTO</span>
                                </Button>
                            </div>
                        </div>

                        {/* FUNIL VISUAL NO PAINEL */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Target className="w-3 h-3" /> Estágio Comercial
                            </h4>
                            <div className="grid grid-cols-1 gap-2.5">
                                {ETAPAS_FUNIL.map(e => {
                                    const isCurrent = selectedConversa?.etapa_funil === e.label;
                                    return (
                                        <button
                                            key={e.label}
                                            onClick={() => updateFunnelStage(e.label)}
                                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left shadow-sm
                                                ${isCurrent ? 'bg-primary/10 border-primary ring-1 ring-primary/20' : 'border-border/60 hover:border-primary/40 bg-card hover:bg-muted/30'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${e.color} text-white shadow-lg`}>
                                                    <e.icon className="w-4 h-4" />
                                                </div>
                                                <span className={`text-xs font-black ${isCurrent ? 'text-primary' : 'text-foreground/80'}`}>{e.label}</span>
                                            </div>
                                            {isCurrent && <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Estoque */}
                        <div className="space-y-4 pt-6 border-t border-border/50">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Package className="w-3 h-3" /> Consulta Rápida Peças
                            </h4>
                            <div className="flex gap-2">
                                <Input placeholder="Ref ou SKU..." className="h-10 text-xs bg-muted/20 rounded-xl" value={productSearch} onChange={e => setProductSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
                                <Button size="icon" className="h-10 w-10 shrink-0 shadow-lg" onClick={searchProducts}><Search className="w-4 h-4" /></Button>
                            </div>
                            <div className="space-y-2.5">
                                {products.map(p => (
                                    <div key={p.id} className="p-3.5 border border-border/40 rounded-2xl bg-card hover:border-primary/40 transition-all shadow-sm cursor-pointer group">
                                        <div className="font-black text-xs truncate group-hover:text-primary">{p.nome}</div>
                                        <div className="flex justify-between items-center mt-3">
                                            <Badge variant="secondary" className="text-[9px] h-4.5 px-2 bg-muted">Estoque: {p.estoque_atual}</Badge>
                                            <span className="font-black text-xs text-primary">R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL NOVO CONTATO */}
            {showNewContactModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-md rounded-[32px] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.5)] p-10 border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-3xl font-black tracking-tight flex items-center gap-3">
                                    Novo Lead
                                </h3>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">Cadastre o cliente para iniciar a negociação.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-red-500/10 hover:text-red-500 transition-colors" onClick={() => setShowNewContactModal(false)}><X className="w-6 h-6" /></Button>
                        </div>
                        <form onSubmit={handleCreateContact} className="space-y-7">
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">NOME DO CLIENTE</label>
                                <Input required className="h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary text-base px-5" placeholder="Digite o nome completo" value={newContact.nome} onChange={e => setNewContact({ ...newContact, nome: e.target.value })} />
                            </div>
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">WHATSAPP (DDD)</label>
                                <Input required placeholder="Ex: 5567999887766" className="h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary text-base px-5" value={newContact.telefone} onChange={e => setNewContact({ ...newContact, telefone: e.target.value })} />
                            </div>
                            <Button type="submit" className="w-full h-16 rounded-[24px] text-lg font-black shadow-2xl shadow-primary/40 transition-all hover:scale-[1.03] active:scale-95 mt-6 bg-primary text-white">
                                CRIAR E INICIAR CHAT
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.2); }
            `}</style>
        </div>
    )
}
