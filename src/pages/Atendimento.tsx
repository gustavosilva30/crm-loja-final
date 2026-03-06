import { useState, useEffect, useRef, useMemo } from "react"
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
    CheckCircle2, Clock, AlertCircle, TrendingUp, Menu,
    Check, CheckCheck, ChevronDown, CornerUpLeft, Copy, SmilePlus,
    Download, Forward, Pin, Star, ThumbsDown, Trash2, Plus, Link as LinkIcon, MapPin, Camera, Video
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import axios from "axios"
import { useAuthStore } from "@/store/authStore"
import { useUIStore } from "@/store/uiStore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

interface Conversa {
    id: string
    cliente_nome: string
    telefone: string
    status_aberto: boolean
    updated_at: string
    etapa_funil?: string
    is_group?: boolean
    unread_count?: number
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
    lida?: boolean
    atendente_nome?: string
    wa_message_id?: string
    reply_to?: string
    reactions?: Record<string, string>
    is_deleted?: boolean
    is_pinned?: boolean
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
    const location = useLocation()
    const { toggleSidebar, sidebarOpen } = useUIStore()
    const [conversas, setConversas] = useState<Conversa[]>([])
    const [contatos, setContatos] = useState<Contato[]>([])
    const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null)
    const [mensagens, setMensagens] = useState<Mensagem[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [loadingConv, setLoadingConv] = useState(true)
    const [loadingMsg, setLoadingMsg] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState("")

    // Filtros e Busca
    const [searchTerm, setSearchTerm] = useState("")
    const [activeFilter, setActiveFilter] = useState<'tudo' | 'unread' | 'read' | 'groups'>('tudo')
    const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null)

    // UI State
    const [showRightPanel, setShowRightPanel] = useState(false)
    const [showNewContactModal, setShowNewContactModal] = useState(false)
    const [newContact, setNewContact] = useState({ nome: "", telefone: "", email: "" })

    // Action States
    const [replyingTo, setReplyingTo] = useState<Mensagem | null>(null)
    const [forwardingMsg, setForwardingMsg] = useState<Mensagem | null>(null)
    const [showForwardModal, setShowForwardModal] = useState(false)
    const [forwardTargets, setForwardTargets] = useState<string[]>([])

    // Attachments & Emojis
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showAttachMenu, setShowAttachMenu] = useState(false)
    const [showLinksModal, setShowLinksModal] = useState(false)
    const [savedLinks, setSavedLinks] = useState<{ title: string, url: string }[]>(() => {
        const s = localStorage.getItem('crm_saved_links')
        return s ? JSON.parse(s) : [{ title: 'Instagram', url: 'https://instagram.com/empresa' }]
    })
    const [newLink, setNewLink] = useState({ title: '', url: '' })

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

    // WhatsApp Connection state
    const [showConnectionModal, setShowConnectionModal] = useState(false)
    const [waConnectionState, setWaConnectionState] = useState<'open' | 'connecting' | 'close' | 'unknown'>('unknown')
    const [qrBase64, setQrBase64] = useState<string | null>(null)
    const [isCheckingConnection, setIsCheckingConnection] = useState(false)

    // 1. Buscar Conversas e Contatos
    const fetchData = async () => {
        setLoadingConv(true)
        const { data: convs } = await supabase.from('conversas').select('*').order('updated_at', { ascending: false })
        const { data: conts } = await supabase.from('contatos').select('*').order('nome', { ascending: true })
        setConversas(convs || [])
        setContatos(conts || [])
        setLoadingConv(false)

        if (location.state?.selectedConversaId && convs) {
            const initialConv = convs.find(c => c.id === location.state.selectedConversaId)
            if (initialConv && !selectedConversa) {
                setSelectedConversa(initialConv)
                window.history.replaceState({}, document.title) // Clear state
            }
        }
    }

    // 1.5 Fetch Connection status
    const fetchWaStatus = async () => {
        setIsCheckingConnection(true)
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            const { data } = await axios.get(`${apiUrl}/api/whatsapp/status`)
            setWaConnectionState(data.state)
        } catch (e) {
            setWaConnectionState('unknown')
        }
        setIsCheckingConnection(false)
    }

    const fetchQrCode = async () => {
        setQrBase64(null)
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            const { data } = await axios.get(`${apiUrl}/api/whatsapp/qr`)
            if (data?.qr_base64) {
                setQrBase64(data.qr_base64)
            } else if (data?.state === 'open') {
                setWaConnectionState('open')
            }
        } catch (e) {
            console.error('QR Error:', e)
        }
    }

    const handleDisconnectWa = async () => {
        if (!confirm('Tem certeza que deseja desconectar a sessão do WhatsApp?')) return;
        setIsCheckingConnection(true)
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/disconnect`)
            setWaConnectionState('close')
            fetchQrCode()
        } catch (e) {
            alert('Erro ao tentar desconectar.')
        }
        setIsCheckingConnection(false)
    }

    // 2. Buscar Mensagens
    const fetchMensagens = async (conversaId: string) => {
        setLoadingMsg(true)
        const { data } = await supabase.from('mensagens').select('*').eq('conversa_id', conversaId).order('timestamp', { ascending: true })
        setMensagens(data || [])
        setLoadingMsg(false)

        // Marcar conversa como lida ao abrir
        await supabase.from('conversas').update({ unread_count: 0 }).eq('id', conversaId)
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

    // Filtragem de conversas
    const filteredConversas = useMemo(() => {
        return conversas.filter(c => {
            const matchesSearch = c.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.telefone.includes(searchTerm)

            if (!matchesSearch) return false

            if (activeFilter === 'unread') return (c.unread_count || 0) > 0
            if (activeFilter === 'read') return (c.unread_count || 0) === 0
            if (activeFilter === 'groups') return c.is_group === true

            return true
        })
    }, [conversas, searchTerm, activeFilter])

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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert("Erro de permissão Mic")
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []
            mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data) }
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
            alert("Erro ao acessar microfone.")
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
        const nomeAtendente = atendente?.nome || "Vendedor";
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        await axios.post(`${apiUrl}/api/whatsapp/send`, {
            conversa_id: selectedConversa.id,
            telefone: selectedConversa.telefone,
            atendente_id: atendente?.id,
            atendente_nome: nomeAtendente,
            mediaBase64: base64,
            mediaMimeType: 'audio/ogg; codecs=opus',
            mediaFileName: `audio-${Date.now()}.ogg`
        })
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!newMessage.trim() && !fileBase64) || !selectedConversa) return

        // Nome do atendente prioritário: vindo do authStore, fallback para localStorage se disponível
        const nomeAtendente = atendente?.nome || "Vendedor";

        const payload = {
            conversa_id: selectedConversa.id,
            telefone: selectedConversa.telefone,
            conteudo: newMessage,
            atendente_id: atendente?.id,
            atendente_nome: nomeAtendente,
            mediaBase64: fileBase64 || undefined,
            mediaMimeType: selectedFile?.type || undefined,
            mediaFileName: selectedFile?.name || undefined
        }

        console.log("Enviando mensagem com atendente:", nomeAtendente);

        setNewMessage("")
        removeFile()
        setReplyingTo(null)
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/send`, payload)
        } catch (err) {
            alert("Erro ao enviar mensagem.")
        }
    }

    const handleReact = async (msg: Mensagem, emoji: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
            await axios.post(`${apiUrl}/api/whatsapp/reaction`, {
                telefone: selectedConversa?.telefone,
                wa_message_id: msg.wa_message_id,
                emoji
            })

            const userId = atendente?.id || 'vendedor'
            const currentReactions = msg.reactions || {}
            const newReactions = { ...currentReactions, [userId]: emoji }
            await supabase.from('mensagens').update({ reactions: newReactions }).eq('id', msg.id)
            setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: newReactions } : m))
            setActiveMenuMsgId(null)
        } catch (err) { console.error('Erro ao reagir', err) }
    }

    const handleDelete = async (msg: Mensagem) => {
        const isOptEveryone = msg.tipo_envio === 'sent' && confirm('Deseja apagar esta mensagem para TODOS? (Cancelar apagará apenas para você)');

        if (!isOptEveryone) {
            if (!confirm('Deseja realmente apagar esta mensagem apenas para você?')) return;
        }

        try {
            if (isOptEveryone) {
                // Chama a API para apagar de verdade lá no celular da pessoa
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
                await axios.post(`${apiUrl}/api/whatsapp/delete`, {
                    telefone: selectedConversa?.telefone,
                    wa_message_id: msg.wa_message_id, // assumindo que mensagens tem isso se precisar
                    deleteForEveryone: true
                });
            }

            // Atualiza banco local
            await supabase.from('mensagens').update({ is_deleted: true }).eq('id', msg.id)
            setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true } : m))
            setActiveMenuMsgId(null)
        } catch (err) { console.error('Erro ao apagar', err) }
    }

    const handlePin = async (msg: Mensagem) => {
        try {
            const newStatus = !msg.is_pinned
            await supabase.from('mensagens').update({ is_pinned: newStatus }).eq('id', msg.id)
            setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: newStatus } : m))
            setActiveMenuMsgId(null)
        } catch (err) { console.error('Erro ao fixar', err) }
    }

    const handleForwardSubmit = async () => {
        if (!forwardingMsg || forwardTargets.length === 0) return
        setShowForwardModal(false)
        setForwardTargets([])

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

        for (const convId of forwardTargets) {
            const targetConv = conversas.find(c => c.id === convId)
            if (!targetConv) continue

            const payload = {
                conversa_id: targetConv.id,
                telefone: targetConv.telefone,
                conteudo: forwardingMsg.conteudo || forwardingMsg.mensagem,
                atendente_id: atendente?.id,
                mediaBase64: undefined, // Requires fetching or backend support for forwarding media URL
                mediaMimeType: forwardingMsg.mime_type,
                mediaFileName: forwardingMsg.file_name
            }
            try {
                await axios.post(`${apiUrl}/api/whatsapp/send`, payload)
            } catch (err) { console.error("Erro forward", err) }
        }
        setForwardingMsg(null)
    }

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newContact.nome || !newContact.telefone) return
        const tel = newContact.telefone.replace(/\D/g, '')
        try {
            const { data: convData } = await supabase.from('conversas').upsert({ telefone: tel, cliente_nome: newContact.nome, status_aberto: true }, { onConflict: 'telefone' }).select().single()
            await supabase.from('contatos').upsert({ nome: newContact.nome, telefone: tel, email: newContact.email })
            setShowNewContactModal(false)
            setNewContact({ nome: "", telefone: "", email: "" })
            fetchData()
            if (convData) setSelectedConversa(convData)
        } catch (err) { alert("Erro contato") }
    }

    const updateFunnelStage = async (stage: string) => {
        if (!selectedConversa) return
        await supabase.from('conversas').update({ etapa_funil: stage }).eq('id', selectedConversa.id)
        setSelectedConversa({ ...selectedConversa, etapa_funil: stage })
        fetchData()
    }

    const handleGenerateVenda = () => {
        if (!selectedConversa) return
        supabase.from('clientes').select('id').eq('telefone', selectedConversa.telefone).maybeSingle().then(({ data }) => {
            localStorage.setItem('crm_venda_cart', JSON.stringify({ items: [], cliente_id: data?.id || "", atendente_id: atendente?.id, autoOpenCheckout: true }))
            navigate('/vendas')
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
        if (mt === 'audio' || msg.mime_type?.includes('audio')) return <audio controls src={msg.media_url} className="h-8 mt-1 scale-90 -ml-4" />;
        if (mt === 'video') return <video controls src={msg.media_url} className="max-w-xs rounded-lg mt-1" />;
        return <a href={msg.media_url} target="_blank" className="flex items-center gap-2 p-2 bg-black/5 rounded mt-1"><FileDown className="w-5 h-5 text-gray-500" /><span className="text-xs truncate">{msg.file_name || 'Doc'}</span></a>
    }

    const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

    return (
        <div className="flex w-full h-full bg-[#f0f2f5] dark:bg-[#0c1317]">

            {/* BARRA LATERAL (LISTA DE CONVERSAS) */}
            <div className="w-[420px] border-r border-[#d1d7db] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col z-20 shrink-0">
                <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={toggleSidebar}>
                            <Menu className={cn("w-5 h-5 transition-transform", !sidebarOpen && "rotate-180")} />
                        </Button>
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={() => {
                            setShowConnectionModal(true)
                            fetchWaStatus()
                            if (waConnectionState !== 'open') fetchQrCode()
                        }} title="Conexão WhatsApp">
                            <Phone className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]" onClick={() => setShowNewContactModal(true)} title="Novo Contato">
                            <UserPlus className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] dark:text-[#aebac1]">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Busca e Filtros Avançados */}
                <div className="px-4 py-2 bg-white dark:bg-[#111b21] space-y-3">
                    <div className="bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg h-9 flex items-center px-3 gap-3 focus-within:ring-1 focus-within:ring-primary/40 transition-shadow">
                        <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
                        <input
                            placeholder="Nome ou telefone..."
                            className="bg-transparent border-none outline-none text-sm flex-1 text-foreground"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                        <Badge
                            variant={activeFilter === 'tudo' ? 'default' : 'outline'}
                            className="cursor-pointer rounded-full text-[10px] px-3 py-1 uppercase font-bold"
                            onClick={() => setActiveFilter('tudo')}
                        >Tudo</Badge>
                        <Badge
                            variant={activeFilter === 'unread' ? 'default' : 'outline'}
                            className="cursor-pointer rounded-full text-[10px] px-3 py-1 uppercase font-bold flex gap-1 items-center"
                            onClick={() => setActiveFilter('unread')}
                        >
                            Não Lidas
                            {conversas.filter(c => (c.unread_count || 0) > 0).length > 0 &&
                                <span className="bg-emerald-500 w-2 h-2 rounded-full" />
                            }
                        </Badge>
                        <Badge
                            variant={activeFilter === 'read' ? 'default' : 'outline'}
                            className="cursor-pointer rounded-full text-[10px] px-3 py-1 uppercase font-bold"
                            onClick={() => setActiveFilter('read')}
                        >Lidas</Badge>
                        <Badge
                            variant={activeFilter === 'groups' ? 'default' : 'outline'}
                            className="cursor-pointer rounded-full text-[10px] px-3 py-1 uppercase font-bold"
                            onClick={() => setActiveFilter('groups')}
                        >Grupos</Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingConv ? (
                        <div className="p-10 text-center"><Loader2 className="animate-spin inline text-primary" /></div>
                    ) : filteredConversas.length === 0 ? (
                        <div className="p-10 text-center opacity-40 italic text-xs">Nenhuma conversa encontrada.</div>
                    ) : filteredConversas.map(conv => (
                        <div key={conv.id} onClick={() => setSelectedConversa(conv)}
                            className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-[#f2f2f2] dark:border-[#222d34] transition-all
                                ${selectedConversa?.id === conv.id ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`}>
                            <div className="w-12 h-12 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0 border border-black/5 relative">
                                {conv.is_group ? <Users className="w-6 h-6 text-[#adb5bd]" /> : <User className="w-7 h-7 text-[#adb5bd]" />}
                                {conv.unread_count && conv.unread_count > 0 ? (
                                    <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white dark:border-[#111b21]">
                                        {conv.unread_count}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold truncate text-[#111b21] dark:text-[#e9edef] text-sm">{conv.cliente_nome}</span>
                                    <span className={cn("text-[10px]", conv.unread_count ? "text-emerald-500 font-bold" : "text-[#8696a0]")}>
                                        {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                    <span className="text-[11px] text-[#667781] dark:text-[#8696a0] truncate flex-1">
                                        {conv.telefone}
                                    </span>
                                    {conv.etapa_funil && (
                                        <div className={cn("w-2 h-2 rounded-full ml-2", ETAPAS_FUNIL.find(e => e.label === conv.etapa_funil)?.color)} title={conv.etapa_funil} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ÁREA DO CHAT */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative border-l border-[#d1d7db] dark:border-[#222d34]">
                {selectedConversa ? (
                    <>
                        <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between shrink-0 z-10 border-b border-black/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#374248] flex items-center justify-center shrink-0">
                                    {selectedConversa.is_group ? <Users className="w-5 h-5 text-[#adb5bd]" /> : <User className="w-6 h-6 text-[#adb5bd]" />}
                                </div>
                                <div>
                                    <div className="font-bold text-[#111b21] dark:text-[#e9edef] leading-tight text-sm md:text-base">{selectedConversa.cliente_nome}</div>
                                    <div className="text-[11px] text-[#667781] dark:text-[#8696a0] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Disponível
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="hidden lg:flex items-center bg-white/40 dark:bg-black/20 px-3 py-1 rounded-full gap-2 border border-black/5">
                                    <Target className="w-3.5 h-3.5 text-primary" />
                                    <select
                                        className="bg-transparent text-[10px] font-bold outline-none cursor-pointer text-foreground"
                                        value={selectedConversa.etapa_funil || 'Novo Lead'}
                                        onChange={(e) => updateFunnelStage(e.target.value)}
                                    >
                                        {ETAPAS_FUNIL.map(e => <option key={e.label} value={e.label} className="dark:bg-[#202c33]">{e.label}</option>)}
                                    </select>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(!showRightPanel)} className={cn("rounded-full", showRightPanel && "text-primary bg-primary/10")}>
                                    <PanelsRightBottom className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:opacity-[0.03] custom-scrollbar scroll-smooth" onClick={() => setActiveMenuMsgId(null)}>
                            {mensagens.map((msg) => {
                                const isSent = msg.tipo_envio === 'sent'
                                const isActive = activeMenuMsgId === msg.id

                                return (
                                    <div key={msg.id} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] px-2.5 py-1.5 rounded-lg shadow-sm text-sm relative transition-all group
                                            ${isSent ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'}`}>

                                            {/* Chevron Menu Trigger */}
                                            <div
                                                className={`absolute top-1 right-1 cursor-pointer transition-opacity z-10 w-8 h-6 flex justify-end items-center pr-1 rounded-tr-lg
                                                    ${isSent ? 'bg-gradient-to-l from-[#dcf8c6] dark:from-[#005c4b] via-[#dcf8c6] dark:via-[#005c4b]' : 'bg-gradient-to-l from-white dark:from-[#202c33] via-white dark:via-[#202c33]'}
                                                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuMsgId(isActive ? null : msg.id);
                                                }}
                                            >
                                                <ChevronDown className="w-4 h-4 text-[#8696a0]" />
                                            </div>

                                            {/* WhatsApp Style Menu */}
                                            {isActive && (
                                                <div
                                                    className={`absolute top-6 ${isSent ? 'right-0 origin-top-right' : 'left-0 origin-top-left'} z-50 animate-in fade-in zoom-in-95 duration-100`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {/* Reactions Bar - Floating Above */}
                                                    <div className="absolute -top-[52px] right-0 bg-white dark:bg-[#233138] rounded-full shadow-lg py-1.5 px-3 flex items-center gap-2 border border-black/5 dark:border-white/5 w-max">
                                                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                            <button key={emoji} onClick={() => handleReact(msg, emoji)} className="hover:scale-125 hover:-translate-y-1 transition-all text-xl">{emoji}</button>
                                                        ))}
                                                        <button className="hover:bg-black/5 dark:hover:bg-white/10 rounded-full w-7 h-7 flex items-center justify-center transition-colors ml-1">
                                                            <Plus className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" />
                                                        </button>
                                                    </div>

                                                    {/* Context Menu Box */}
                                                    <div className="bg-white dark:bg-[#233138] rounded-2xl shadow-xl py-2 w-56 border border-black/5 dark:border-white/5 mt-1 relative text-[#3b4a54] dark:text-[#d1d7db]">
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => { setReplyingTo(msg); setActiveMenuMsgId(null); }}>
                                                            <CornerUpLeft className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Responder
                                                        </button>
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => { navigator.clipboard.writeText(msg.conteudo || msg.mensagem || ''); setActiveMenuMsgId(null); }}>
                                                            <Copy className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Copiar
                                                        </button>
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={(e) => { e.stopPropagation(); document.getElementById(`react-btn-${msg.id}`)?.click(); }}>
                                                            <SmilePlus className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Reagir
                                                        </button>
                                                        {(msg.media_url || msg.tipo === 'image' || msg.tipo === 'audio' || msg.tipo === 'video' || msg.tipo === 'document') && (
                                                            <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                                onClick={() => { window.open(msg.media_url, '_blank'); setActiveMenuMsgId(null); }}>
                                                                <Download className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Baixar
                                                            </button>
                                                        )}
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => { setForwardingMsg(msg); setShowForwardModal(true); setActiveMenuMsgId(null); }}>
                                                            <Forward className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Encaminhar
                                                        </button>
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => { handlePin(msg); }}>
                                                            <Pin className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> {msg.is_pinned ? 'Desfixar' : 'Fixar'}
                                                        </button>
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => setActiveMenuMsgId(null)}>
                                                            <Star className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Favoritar
                                                        </button>
                                                        <div className="border-t border-black/5 dark:border-white/5 my-1" />
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]">
                                                            <ThumbsDown className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Denunciar
                                                        </button>
                                                        <button className="w-full flex items-center gap-4 px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-left text-[14px]"
                                                            onClick={() => { handleDelete(msg); }}>
                                                            <Trash2 className="w-5 h-5 text-[#54656f] dark:text-[#aebac1]" /> Apagar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isSent && msg.atendente_nome && (
                                                <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 mb-0.5 uppercase tracking-wider flex items-center gap-1.5">
                                                    <div className="w-1 h-1 bg-current rounded-full" />
                                                    {msg.atendente_nome}
                                                </div>
                                            )}

                                            {msg.is_deleted ? (
                                                <div className="flex items-center gap-2 italic text-gray-500 min-h-[1.2rem] pr-16 bg-transparent">
                                                    <Trash2 className="w-4 h-4" /> Mensagem apagada
                                                </div>
                                            ) : (
                                                <>
                                                    {renderMedia(msg)}
                                                    <div className="whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef] pr-16 min-h-[1.2rem]">{msg.conteudo || msg.mensagem}</div>
                                                </>
                                            )}

                                            <div className="absolute bottom-1 right-1.5 flex items-center gap-1 text-[9px] text-[#667781] dark:text-[#8696a0b3] font-mono">
                                                {msg.is_pinned && <Pin className="w-3 h-3 text-gray-400" />}
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {isSent && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                                            </div>

                                            {/* Render Reactions below bubble */}
                                            {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
                                                <div className={`absolute -bottom-3 ${isSent ? 'right-0' : 'left-0'} bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 shadow-sm rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 z-10`}>
                                                    {Object.values(msg.reactions).map((emoji, idx) => <span key={idx}>{emoji}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="bg-[#f0f2f5] dark:bg-[#202c33] flex flex-col shrink-0 border-t border-black/5 relative">
                            {replyingTo && (
                                <div className="absolute top-[-54px] left-0 right-0 h-[54px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center shadow-sm z-20 border-t border-black/5">
                                    <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-lg border-l-4 border-emerald-500 pl-3 py-1.5 flex items-center justify-between">
                                        <div className="flex flex-col min-w-0 pr-2 overflow-hidden">
                                            <span className="font-bold text-emerald-500 text-xs truncate">
                                                {replyingTo.tipo_envio === 'sent' ? 'Você' : selectedConversa?.cliente_nome}
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 text-xs truncate">
                                                {replyingTo.conteudo || replyingTo.mensagem || 'Mídia'}
                                            </span>
                                        </div>
                                        <X className="w-4 h-4 text-gray-500 cursor-pointer mr-2 shrink-0 hover:text-black dark:hover:text-white" onClick={() => setReplyingTo(null)} />
                                    </div>
                                </div>
                            )}

                            <div className="p-3 flex items-center gap-3">
                                {isRecording ? (
                                    <div className="flex-1 flex items-center gap-4 bg-white dark:bg-[#2a3942] rounded-full px-6 py-2 shadow-sm border border-red-500/20">
                                        <StopCircle className="w-7 h-7 text-red-500 cursor-pointer animate-pulse" onClick={stopRecording} />
                                        <div className="flex-1 text-red-500 font-bold flex items-center gap-2 text-sm uppercase">
                                            Gravação em curso: {formatTime(recordingTime)}
                                        </div>
                                        <Button variant="ghost" onClick={() => setIsRecording(false)} className="text-xs h-7 hover:bg-red-500/10 rounded-full">Cancelar</Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Smile className={`w-6 h-6 ${showEmojiPicker ? 'text-primary' : 'text-[#54656f] dark:text-[#aebac1]'} cursor-pointer hover:text-primary transition-colors`} onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false) }} />
                                            {showEmojiPicker && (
                                                <div className="absolute bottom-10 left-0 bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 shadow-2xl rounded-2xl p-4 w-64 z-50 animate-in fade-in zoom-in-95">
                                                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-tight">Emojis</div>
                                                    <div className="grid grid-cols-6 gap-2">
                                                        {['😀', '😂', '❤️', '🙏', '👍', '😮', '😢', '🎉', '🔥', '✅', '❌', '👀'].map(e => (
                                                            <div key={e} className="cursor-pointer hover:scale-125 transition-transform text-xl flex items-center justify-center p-1 hover:bg-black/5 rounded" onClick={() => { setNewMessage(prev => prev + e); setShowEmojiPicker(false) }}>{e}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { handleFileChange(e); setShowAttachMenu(false) }} />

                                        <div className="relative">
                                            <Paperclip className={`w-6 h-6 ${showAttachMenu ? 'text-primary rotate-0' : 'text-[#54656f] dark:text-[#aebac1] -rotate-45'} cursor-pointer transition-all hover:text-primary ${selectedFile && "text-primary max-w-0"}`} onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false) }} />
                                            {showAttachMenu && (
                                                <div className="absolute bottom-12 left-0 bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/5 shadow-2xl rounded-2xl py-2 w-56 z-50 animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-1">
                                                    <div className="px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><ImageIcon className="w-4 h-4" /></div>
                                                        <span className="text-sm font-medium">Fotos e Vídeos</span>
                                                    </div>
                                                    <div className="px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500"><FileText className="w-4 h-4" /></div>
                                                        <span className="text-sm font-medium">Documento</span>
                                                    </div>
                                                    <div className="px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
                                                        onClick={() => {
                                                            setShowAttachMenu(false);
                                                            setShowLinksModal(true);
                                                        }}>
                                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><LinkIcon className="w-4 h-4" /></div>
                                                        <span className="text-sm font-medium">Links Rápidos</span>
                                                    </div>
                                                    <div className="px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
                                                        onClick={async () => {
                                                            setShowAttachMenu(false);
                                                            if (!confirm('Deseja enviar a localização da loja para este cliente?')) return;
                                                            try {
                                                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
                                                                await axios.post(`${apiUrl}/api/whatsapp/location`, {
                                                                    telefone: selectedConversa?.telefone,
                                                                    name: 'Nossa Loja',
                                                                    address: 'Rua Principal, 123 - Centro',
                                                                    latitude: -23.5505,
                                                                    longitude: -46.6333
                                                                });
                                                                // optionally save to db as system message or location message
                                                            } catch (e) { alert('Erro ao enviar localização') }
                                                        }}>
                                                        <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500"><MapPin className="w-4 h-4" /></div>
                                                        <span className="text-sm font-medium">Localização</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                                            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2 border border-black/5 dark:border-white/5 shadow-inner">
                                                {selectedFile && (
                                                    <div className="mb-2 p-1.5 bg-primary/5 rounded border border-primary/20 flex items-center justify-between">
                                                        <span className="text-[10px] font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                                                        <X className="w-3.5 h-3.5 cursor-pointer text-red-500" onClick={removeFile} />
                                                    </div>
                                                )}
                                                <input placeholder="Digite uma mensagem" className="bg-transparent border-none outline-none w-full text-sm text-foreground" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                                            </div>
                                            {newMessage || selectedFile ? (
                                                <Button type="submit" variant="ghost" size="icon" className="text-primary hover:bg-transparent hover:scale-110 active:scale-95 transition-all"><Send className="w-6 h-6" /></Button>
                                            ) : (
                                                <Mic className="w-6 h-6 text-[#54656f] dark:text-[#aebac1] cursor-pointer hover:text-primary transition-colors" onClick={startRecording} />
                                            )}
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 select-none">
                        <div className="w-48 h-48 opacity-[0.05] bg-[url('https://whatsapp.com/apple-touch-icon.png')] bg-center bg-no-repeat bg-contain filter grayscale animate-pulse"></div>
                        <h2 className="text-4xl font-black text-[#41525d] dark:text-[#e9edef] mt-10 tracking-tight opacity-10">WhatsApp CRM</h2>
                        <p className="text-sm text-[#667781] dark:text-[#8696a0] mt-4 opacity-50 max-w-xs text-center leading-relaxed">Selecione uma conversa ou lead comercial para iniciar a gestão estratégica.</p>
                        <div className="flex items-center gap-2 mt-20 opacity-20 text-[10px] font-bold uppercase tracking-widest">
                            <TrendingUp className="w-4 h-4" /> Inteligência de Dados Dourados
                        </div>
                    </div>
                )}

                {/* PAINEL DIREITO (COMERCIAL) */}
                <div className={`absolute right-0 top-0 bottom-0 w-[380px] bg-white dark:bg-[#111b21] border-l border-[#d1d7db] dark:border-[#222d34] shadow-2xl transition-all duration-500 ease-in-out z-30 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center gap-4 shrink-0 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={() => setShowRightPanel(false)} className="rounded-full"><X className="w-5 h-5" /></Button>
                        <span className="font-black text-xs uppercase tracking-widest text-[#54656f] dark:text-[#aebac1]">Ficha Comercial</span>
                    </div>

                    <div className="p-6 space-y-8 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Filter className="w-3 h-3" /> Ações Rápidas</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <Button onClick={handleGenerateVenda} variant="outline" className="h-24 flex-col gap-2 rounded-2xl border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group transition-all hover:scale-[1.03]">
                                    <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" /> <span className="text-[11px] font-black">PONTO DE VENDA</span>
                                </Button>
                                <Button onClick={() => navigate('/orcamentos')} variant="outline" className="h-24 flex-col gap-2 rounded-2xl border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-400 group transition-all hover:scale-[1.03]">
                                    <FileText className="w-6 h-6 group-hover:scale-110 transition-transform" /> <span className="text-[11px] font-black">GERAR ORÇAMENTO</span>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Target className="w-3 h-3" /> Funil de Conversão</h4>
                            <div className="grid grid-cols-1 gap-2.5">
                                {ETAPAS_FUNIL.map(e => {
                                    const isCurrent = selectedConversa?.etapa_funil === e.label;
                                    return (
                                        <button key={e.label} onClick={() => updateFunnelStage(e.label)}
                                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left shadow-sm ${isCurrent ? 'bg-primary/10 border-primary ring-1 ring-primary/20 scale-[1.02]' : 'border-border/60 hover:border-primary/40 bg-card hover:bg-muted/30'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${e.color} text-white shadow-lg`}><e.icon className="w-4 h-4" /></div>
                                                <span className={`text-xs font-black ${isCurrent ? 'text-primary' : 'text-foreground/80'}`}>{e.label}</span>
                                            </div>
                                            {isCurrent && <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-border/50">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Package className="w-3 h-3" /> Pesquisa de Estoque</h4>
                            <div className="flex gap-2">
                                <Input placeholder="Ref ou SKU..." className="h-10 text-xs bg-muted/20" value={productSearch} onChange={e => setProductSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
                                <Button size="icon" className="h-10 w-10 shrink-0 shadow-lg" onClick={searchProducts}><Search className="w-4 h-4" /></Button>
                            </div>
                            <div className="space-y-2.5">
                                {products.map(p => (
                                    <div key={p.id} className="p-3.5 border border-border/40 rounded-2xl bg-card hover:border-primary/40 transition-all shadow-sm cursor-pointer group">
                                        <div className="font-bold text-xs truncate group-hover:text-primary">{p.nome}</div>
                                        <div className="flex justify-between items-center mt-3">
                                            <Badge variant="secondary" className="text-[9px] h-4.5 px-2 bg-muted">Est: {p.estoque_atual}</Badge>
                                            <span className="font-black text-xs text-primary font-mono">R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL NOVO LEAD */}
            {
                showNewContactModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-card w-full max-w-sm rounded-[32px] shadow-2xl p-10 border border-white/10 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black tracking-tight">Novo Lead</h3>
                                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-red-500/10 hover:text-red-500" onClick={() => setShowNewContactModal(false)}><X /></Button>
                            </div>
                            <form onSubmit={handleCreateContact} className="space-y-6">
                                <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">NOME</label><Input required className="h-12 rounded-xl bg-muted/30 border-none px-4" value={newContact.nome} onChange={e => setNewContact({ ...newContact, nome: e.target.value })} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">WHATSAPP</label><Input required placeholder="Ex: 5567999887766" className="h-12 rounded-xl bg-muted/30 border-none px-4" value={newContact.telefone} onChange={e => setNewContact({ ...newContact, telefone: e.target.value })} /></div>
                                <Button type="submit" className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-primary/30 active:scale-95 transition-all mt-4">SALVAR E ABRIR CHAT</Button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* MODAL ENCAMINHAR */}
            {
                showForwardModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-card w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-white/10 relative overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-xl font-black tracking-tight">Encaminhar mensagem para...</h3>
                                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-red-500/10 hover:text-red-500" onClick={() => setShowForwardModal(false)}><X /></Button>
                            </div>

                            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 mb-6">
                                {conversas.map(conv => (
                                    <div key={conv.id}
                                        className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl transition-colors ${forwardTargets.includes(conv.id) ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                                        onClick={() => setForwardTargets(prev => prev.includes(conv.id) ? prev.filter(id => id !== conv.id) : [...prev, conv.id])}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                            {conv.is_group ? <Users className="w-5 h-5 text-muted-foreground" /> : <User className="w-5 h-5 text-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 font-bold text-sm block truncate">{conv.cliente_nome}</div>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${forwardTargets.includes(conv.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                                            {forwardTargets.includes(conv.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button
                                className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-primary/30 active:scale-95 transition-all mt-auto shrink-0"
                                disabled={forwardTargets.length === 0}
                                onClick={handleForwardSubmit}
                            >
                                <Send className="w-5 h-5 mr-2" /> ENCAMINHAR ({forwardTargets.length})
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* MODAL LINKS */}
            {showLinksModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-white/10 relative overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-xl font-black tracking-tight flex items-center gap-2"><LinkIcon className="w-5 h-5 text-emerald-500" /> Links Rápidos</h3>
                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-red-500/10 hover:text-red-500" onClick={() => setShowLinksModal(false)}><X /></Button>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 mb-6 space-y-3">
                            {savedLinks.length === 0 && <p className="text-center text-sm text-gray-400 mt-4">Nenhum link salvo ainda.</p>}
                            {savedLinks.map((link, i) => (
                                <div key={i} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-muted/50 border border-border/50 group">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-sm truncate pr-2">{link.title}</div>
                                        <div className="flex gap-1 opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => {
                                                setNewMessage(prev => prev + (prev ? '\n' : '') + link.url);
                                                setShowLinksModal(false);
                                            }}><Send className="w-3.5 h-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-red-500/10 hover:text-red-500" onClick={() => {
                                                if (!confirm('Excluir este link?')) return;
                                                const newLinks = savedLinks.filter((_, idx) => idx !== i);
                                                setSavedLinks(newLinks);
                                                localStorage.setItem('crm_saved_links', JSON.stringify(newLinks));
                                            }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                        </div>
                                    </div>
                                    <div className="text-xs text-primary font-mono truncate">{link.url}</div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-border mt-auto shrink-0 flex flex-col gap-3">
                            <div className="text-xs font-bold text-gray-500 uppercase">Adicionar Novo</div>
                            <div className="flex gap-2">
                                <Input placeholder="Título (ex: Catálogo)" className="flex-1 h-10 text-xs bg-muted/30" value={newLink.title} onChange={e => setNewLink({ ...newLink, title: e.target.value })} />
                                <Input placeholder="URL (https://...)" className="flex-[2] h-10 text-xs bg-muted/30" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} onKeyDown={e => {
                                    if (e.key === 'Enter' && newLink.title && newLink.url) {
                                        const nl = [...savedLinks, newLink];
                                        setSavedLinks(nl);
                                        localStorage.setItem('crm_saved_links', JSON.stringify(nl));
                                        setNewLink({ title: '', url: '' });
                                    }
                                }} />
                                <Button size="icon" className="h-10 w-10 shrink-0 shadow-sm" disabled={!newLink.title || !newLink.url} onClick={() => {
                                    const nl = [...savedLinks, newLink];
                                    setSavedLinks(nl);
                                    localStorage.setItem('crm_saved_links', JSON.stringify(nl));
                                    setNewLink({ title: '', url: '' });
                                }}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div >
    )
}
