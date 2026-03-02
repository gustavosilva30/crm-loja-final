import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Search, Filter, MoreHorizontal, ShoppingCart, TrendingUp, Trash2, Printer, Truck, Plus, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Venda {
    id: string
    numero_pedido?: number
    cliente_id: string | null
    total: number
    status: 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado'
    origem_ml: boolean
    ml_order_id: string | null
    data_venda: string
    created_at: string
    total_pago?: number
    valor_aberto?: number
    clientes?: { id: string, nome: string, documento?: string, email?: string, telefone?: string, endereco?: string, saldo_haver?: number }
    atendentes?: { nome: string }
    forma_pagamento?: string
    atendente_id?: string
    itens?: any[]
}

export function Vendas() {
    const [searchTerm, setSearchTerm] = useState("")
    const [vendas, setVendas] = useState<Venda[]>([])
    const [loading, setLoading] = useState(true)

    const [filterStatus, setFilterStatus] = useState<string>("todos")
    const [filterOrigem, setFilterOrigem] = useState<string>("todos")
    const [filterDataInicio, setFilterDataInicio] = useState<string>("")
    const [filterDataFim, setFilterDataFim] = useState<string>("")
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [selectedVendaForReceipt, setSelectedVendaForReceipt] = useState<any>(null)
    const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'cupom'>('a4')
    const [company, setCompany] = useState<any>(null)

    const fetchVendas = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`
                    *, 
                    clientes ( id, nome, documento, email, telefone, endereco ),
                    atendentes ( nome )
                `)
                .order('data_venda', { ascending: false })

            if (error) throw error
            setVendas(data || [])
        } catch (err) {
            console.error('Error fetching vendas:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVendas()
        supabase.from('configuracoes_empresa').select('*').maybeSingle().then(({ data }) => setCompany(data))
    }, [])

    const handleCancelVenda = async (id: string) => {
        if (!confirm('Deseja realmente EXCLUIR esta venda? Isso devolverá os produtos ao estoque e estornará pagamentos automaticamente.')) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('vendas').delete().eq('id', id);
            if (error) throw error;
            fetchVendas();
            alert('Venda excluída e valores estornados com sucesso.');
        } catch (e: any) {
            alert('Erro ao excluir: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const handleOpenReceipt = async (vendaId: string) => {
        setLoading(true)
        try {
            const { data: venda } = await supabase.from('vendas').select(`*, clientes(*), atendentes(nome)`).eq('id', vendaId).single()
            const { data: itens } = await supabase.from('vendas_itens').select(`*, produtos(nome, sku)`).eq('venda_id', vendaId)
            const { data: entrega } = await supabase.from('entregas').select(`*, transportadoras(nome)`).eq('venda_id', vendaId).maybeSingle()
            setSelectedVendaForReceipt({ ...venda, itens: itens || [], entrega: entrega || null })
            setIsReceiptModalOpen(true)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        const content = document.getElementById('printable-receipt')
        if (!content) return
        const win = window.open('', '_blank')
        win?.document.write(`<html><body>${content.innerHTML}</body></html>`)
        win?.document.close()
        win?.print()
    }

    const filteredVendas = vendas.filter(v => {
        const termLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || (v.clientes?.nome?.toLowerCase() || '').includes(termLower) || String(v.numero_pedido).includes(termLower);
        const matchesStatus = v.status === 'Pendente';
        return matchesSearch && matchesStatus;
    })

    const formatNumPedido = (num?: number) => num ? String(num).padStart(6, '0') : '------'

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendas Pendentes</h1>
                    <p className="text-muted-foreground mt-1">Gerencie suas vendas em aberto.</p>
                </div>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" /> Nova Venda
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar venda..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Button variant="outline" className="gap-2" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                            <Filter className="w-4 h-4" /> Filtros
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
                            ) : filteredVendas.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center">Nenhuma venda pendente.</TableCell></TableRow>
                            ) : filteredVendas.map((venda) => (
                                <TableRow key={venda.id}>
                                    <TableCell className="font-mono">#{formatNumPedido(venda.numero_pedido)}</TableCell>
                                    <TableCell>{venda.clientes?.nome || 'Consumidor Final'}</TableCell>
                                    <TableCell className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total)}</TableCell>
                                    <TableCell><Badge variant="outline">{venda.status}</Badge></TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenReceipt(venda.id)} title="Imprimir"><Printer className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleCancelVenda(venda.id)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Pedido" className="max-w-4xl">
                {selectedVendaForReceipt && (
                    <div className="space-y-4">
                        <div className="flex justify-end"><Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button></div>
                        <div id="printable-receipt" className="p-8 border bg-white text-black">
                            <h2 className="text-xl font-bold">Pedido #{formatNumPedido(selectedVendaForReceipt.numero_pedido)}</h2>
                            <p>Cliente: {selectedVendaForReceipt.clientes?.nome || '---'}</p>
                            <p>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVendaForReceipt.total)}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
