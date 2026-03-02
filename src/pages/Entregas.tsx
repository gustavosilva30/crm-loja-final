import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Filter, MoreHorizontal, Truck, PackageCheck, Package, MapPin, Calendar, Clock, AlertTriangle, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Entrega {
    id: string
    venda_id: string
    transportadora_id: string | null
    codigo_rastreio: string | null
    status: string
    status_pagamento: 'Pago' | 'A Receber' | string
    data_envio: string | null
    data_entrega: string | null
    created_at: string
    vendas?: {
        id: string
        clientes: { nome: string }
    }
}

export function Entregas() {
    const [searchTerm, setSearchTerm] = useState("")
    const [entregas, setEntregas] = useState<Entrega[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const fetchEntregas = async () => {
        try {
            const { data, error } = await supabase
                .from('entregas')
                .select(`
                    *, 
                    vendas ( id, clientes ( nome ) )
                `)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching entregas:', error)
            } else {
                setEntregas(data || [])
            }
        } catch (err) {
            console.error('Unexpected error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchEntregas() }, [])

    const updateStatus = async (id: string, currentStatus: string) => {
        const statuses = ['Preparando', 'Em Trânsito', 'Entregue']
        const nextIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length
        const nextStatus = statuses[nextIndex]

        const { error } = await supabase.from('entregas').update({
            status: nextStatus,
            data_envio: nextStatus === 'Em Trânsito' ? new Date().toISOString() : undefined,
            data_entrega: nextStatus === 'Entregue' ? new Date().toISOString() : undefined
        }).eq('id', id)

        if (!error) fetchEntregas()
    }

    const togglePaymentStatus = async (id: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'Pago' ? 'A Receber' : 'Pago'
        const { error } = await supabase.from('entregas').update({
            status_pagamento: nextStatus
        }).eq('id', id)

        if (!error) fetchEntregas()
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir registro de entrega?")) return
        const { error } = await supabase.from('entregas').delete().eq('id', id)
        if (!error) fetchEntregas()
    }

    const filteredEntregas = entregas.filter(e =>
        e.vendas?.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.codigo_rastreio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.venda_id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const entregasAtivas = entregas.filter(e => e.status !== 'Entregue' && e.status !== 'Cancelado').length
    const entregasAtrasadas = entregas.filter(e => e.status === 'Atrasado').length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Entregas</h1>
                    <p className="text-muted-foreground mt-1">Gerencie a logística, rastreio e prazos de entrega.</p>
                </div>
                <Button className="gap-2" onClick={() => navigate('/configuracoes')}>
                    <Truck className="w-4 h-4" />
                    Configurar Logística
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Entregas em Trânsito</CardTitle>
                        <Truck className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{entregasAtivas}</div>
                        <p className="text-xs text-muted-foreground mt-1">Pedidos saindo ou na rua</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Aguardando Coleta</CardTitle>
                        <Package className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">0</div>
                        <p className="text-xs text-muted-foreground mt-1">Status: Preparando</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Entregas Críticas</CardTitle>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-500">{entregasAtrasadas}</div>
                        <p className="text-xs text-muted-foreground mt-1">Potencial atraso ou problema</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="relative w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente, rastrear..."
                                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" />
                            Filtros
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            Carregando logística...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pedido</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Rastreio</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead>Saída</TableHead>
                                    <TableHead>Previsão</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntregas.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Nenhuma entrega registrada.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredEntregas.map((entrega) => (
                                    <TableRow key={entrega.id}>
                                        <TableCell className="font-mono text-xs italic shrink-0">
                                            #{entrega.vendas?.id.slice(0, 8)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{entrega.vendas?.clientes?.nome || "Consumidor Final"}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono tracking-tighter">
                                                {entrega.codigo_rastreio || "-"}
                                                {entrega.codigo_rastreio && <Button variant="ghost" size="icon" className="h-6 w-6"><PackageCheck className="w-3 h-3" /></Button>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={entrega.status_pagamento === 'Pago' ? 'default' : 'outline'}
                                                className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${entrega.status_pagamento === 'Pago' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                                                onClick={() => togglePaymentStatus(entrega.id, entrega.status_pagamento)}
                                            >
                                                {entrega.status_pagamento || 'A Receber'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {entrega.data_envio ? new Date(entrega.data_envio).toLocaleDateString("pt-BR") : "-"}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {entrega.data_entrega ? new Date(entrega.data_entrega).toLocaleDateString("pt-BR") : "Calculando..."}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    entrega.status === 'Entregue' ? 'default' :
                                                        entrega.status === 'Em Trânsito' ? 'secondary' : 'outline'
                                                }
                                                className="text-[10px] uppercase font-bold tracking-tight"
                                            >
                                                {entrega.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => updateStatus(entrega.id, entrega.status)} title="Próximo Status">
                                                    <PackageCheck className="w-4 h-4 text-emerald-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(entrega.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
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
        </div>
    )
}
