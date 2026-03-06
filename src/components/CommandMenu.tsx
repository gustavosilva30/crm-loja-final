import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Users, ShoppingBag, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SearchResult {
    id: string
    type: 'produto' | 'cliente' | 'venda'
    title: string
    subtitle: string
    url: string
}

export function CommandMenu() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 100)
        } else {
            setQuery('')
            setResults([])
            setSelectedIndex(0)
        }
    }, [open])

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            return
        }

        const search = async () => {
            setLoading(true)
            try {
                const q = `%${query}%`
                const [prodRes, cliRes, vendRes] = await Promise.all([
                    supabase.from('produtos').select('id, nome, codigo_sku, preco_venda').or(`nome.ilike.${q},codigo_sku.ilike.${q}`).limit(3),
                    supabase.from('clientes').select('id, nome, telefone').or(`nome.ilike.${q},telefone.ilike.${q}`).limit(3),
                    supabase.from('vendas').select('id, total, status, clientes(nome)').eq('id', query).limit(3).then(res => res, () => ({ data: [] }))
                ])

                const newResults: SearchResult[] = []

                if (prodRes.data) {
                    prodRes.data.forEach(p => newResults.push({
                        id: `p-${p.id}`, type: 'produto', title: p.nome,
                        subtitle: `SKU: ${p.codigo_sku} | R$ ${p.preco_venda}`, url: `/produtos`
                    }))
                }

                if (cliRes.data) {
                    cliRes.data.forEach(c => newResults.push({
                        id: `c-${c.id}`, type: 'cliente', title: c.nome,
                        subtitle: `Tel: ${c.telefone}`, url: `/clientes`
                    }))
                }

                // if query is exact number for sales
                if (!isNaN(Number(query))) {
                    const numFetch = await supabase.from('vendas').select('id, total, status, clientes(nome)').eq('id', query).limit(3);
                    if (numFetch.data) {
                        numFetch.data.forEach((v: any) => newResults.push({
                            id: `v-${v.id}`, type: 'venda', title: `Venda #${v.id}`,
                            subtitle: `Cliente: ${v.clientes?.nome || 'N/I'} | R$ ${v.total}`, url: `/vendas`
                        }))
                    }
                }

                setResults(newResults)
                setSelectedIndex(0)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        const throttle = setTimeout(search, 300)
        return () => clearTimeout(throttle)
    }, [query])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
        } else if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault()
            handleSelect(results[selectedIndex])
        } else if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    const handleSelect = (res: SearchResult) => {
        setOpen(false)
        navigate(res.url)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
                onClick={() => setOpen(false)}
            />

            {/* Modal Principal (Glassmorphism) */}
            <div className="relative w-full max-w-2xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center border-b border-border/50 px-4">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        className="flex h-14 w-full bg-transparent py-4 mx-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Buscar produtos, clientes ou nº da venda..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border uppercase tracking-widest hidden sm:block">ESC</div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                    {!query && (
                        <div className="py-14 text-center text-sm text-muted-foreground">
                            Digite para começar a buscar.
                        </div>
                    )}

                    {query && loading && results.length === 0 && (
                        <div className="py-14 text-center text-sm text-muted-foreground animate-pulse">
                            Buscando...
                        </div>
                    )}

                    {query && !loading && results.length === 0 && (
                        <div className="py-14 text-center text-sm text-muted-foreground">
                            Nenhum resultado encontrado para "{query}"
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-1">
                            {results.map((res, idx) => {
                                const isSelected = idx === selectedIndex
                                const Icon = res.type === 'produto' ? Package : res.type === 'cliente' ? Users : ShoppingBag

                                return (
                                    <div
                                        key={res.id}
                                        onClick={() => handleSelect(res)}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${isSelected
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'hover:bg-muted text-foreground'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-md ${isSelected ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col">
                                            <span className="text-sm font-bold truncate">{res.title}</span>
                                            <span className={`text-[10px] truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                {res.subtitle}
                                            </span>
                                        </div>
                                        <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-black/10 dark:bg-white/10`}>
                                            {res.type}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
