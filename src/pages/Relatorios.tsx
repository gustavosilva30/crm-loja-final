import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Printer, TrendingUp, Users, ShoppingBag, Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react"

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '---'

type ReportType = 'vendas' | 'vendas_por_vendedor' | 'contas' | 'clientes' | 'fluxo_caixa'

export function Relatorios() {
    const [reportType, setReportType] = useState<ReportType>('vendas')
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any[]>([])
    const [clientes, setClientes] = useState<any[]>([])

    // Filtros
    const [filterDataInicio, setFilterDataInicio] = useState('')
    const [filterDataFim, setFilterDataFim] = useState('')
    const [filterCliente, setFilterCliente] = useState('')
    const [filterStatus, setFilterStatus] = useState('todos')

    // Totalizadores
    const [totals, setTotals] = useState<Record<string, number>>({})

    useEffect(() => {
        supabase.from('clientes').select('id, nome').then(({ data }) => {
            if (data) setClientes(data)
        })
    }, [])

    const fetchReport = useCallback(async () => {
        setLoading(true)
        setData([])
        setTotals({})

        try {
            if (reportType === 'vendas') {
                let q = supabase
                    .from('vendas')
                    .select(`
                        numero_pedido, data_venda, total, status, forma_pagamento,
                        clientes (nome),
                        atendentes (nome)
                    `)
                    .order('data_venda', { ascending: false })

                if (filterDataInicio) q = q.gte('data_venda', filterDataInicio)
                if (filterDataFim) q = q.lte('data_venda', filterDataFim + 'T23:59:59')
                if (filterCliente) q = q.eq('cliente_id', filterCliente)
                if (filterStatus !== 'todos') q = q.eq('status', filterStatus)

                const { data: rows } = await q
                setData(rows || [])
                const tot = (rows || []).filter((v: any) => v.status !== 'Cancelado').reduce((a: number, v: any) => a + (v.total || 0), 0)
                setTotals({ total: tot })
            }

            else if (reportType === 'vendas_por_vendedor') {
                let q = supabase
                    .from('vendas')
                    .select(`total, status, atendentes (nome), data_venda`)
                    .neq('status', 'Cancelado')

                if (filterDataInicio) q = q.gte('data_venda', filterDataInicio)
                if (filterDataFim) q = q.lte('data_venda', filterDataFim + 'T23:59:59')

                const { data: rows } = await q
                if (rows) {
                    const grouped: Record<string, { nome: string, qtd: number, total: number }> = {}
                    rows.forEach((v: any) => {
                        const nome = v.atendentes?.nome || 'Sem vendedor'
                        if (!grouped[nome]) grouped[nome] = { nome, qtd: 0, total: 0 }
                        grouped[nome].qtd++
                        grouped[nome].total += v.total || 0
                    })
                    const sorted = Object.values(grouped).sort((a, b) => b.total - a.total)
                    setData(sorted)
                    setTotals({ total: sorted.reduce((a, v) => a + v.total, 0) })
                }
            }

            else if (reportType === 'contas') {
                let q = supabase
                    .from('financeiro_lancamentos')
                    .select(`
                        descricao, tipo, valor, status, data_vencimento, data_pagamento,
                        clientes (nome)
                    `)
                    .order('data_vencimento', { ascending: true })

                if (filterDataInicio) q = q.gte('data_vencimento', filterDataInicio)
                if (filterDataFim) q = q.lte('data_vencimento', filterDataFim)
                if (filterCliente) q = q.eq('cliente_id', filterCliente)
                if (filterStatus !== 'todos') q = q.eq('status', filterStatus)

                const { data: rows } = await q
                const r = rows || []
                const receber = r.filter((x: any) => x.tipo === 'receita').reduce((a: number, x: any) => a + (x.valor || 0), 0)
                const pagar = r.filter((x: any) => x.tipo === 'despesa').reduce((a: number, x: any) => a + (x.valor || 0), 0)
                setData(r)
                setTotals({ receber, pagar, saldo: receber - pagar })
            }

            else if (reportType === 'clientes') {
                const { data: rows } = await supabase
                    .from('clientes')
                    .select(`id, nome, documento, telefone, email, created_at`)
                    .order('created_at', { ascending: false })

                setData(rows || [])
                setTotals({ total: (rows || []).length })
            }

            else if (reportType === 'fluxo_caixa') {
                let q = supabase
                    .from('financeiro_lancamentos')
                    .select('tipo, valor, data_pagamento, status')
                    .eq('status', 'Pago')

                if (filterDataInicio) q = q.gte('data_pagamento', filterDataInicio)
                if (filterDataFim) q = q.lte('data_pagamento', filterDataFim)

                const { data: rows } = await q
                if (rows) {
                    const grouped: Record<string, { mes: string, entradas: number, saidas: number }> = {}
                    rows.forEach((l: any) => {
                        if (!l.data_pagamento) return
                        const mes = l.data_pagamento.substring(0, 7) // YYYY-MM
                        if (!grouped[mes]) grouped[mes] = { mes, entradas: 0, saidas: 0 }
                        if (l.tipo === 'receita') grouped[mes].entradas += l.valor || 0
                        else grouped[mes].saidas += l.valor || 0
                    })
                    const sorted = Object.values(grouped).sort((a, b) => a.mes.localeCompare(b.mes))
                    setData(sorted)
                    const entradas = sorted.reduce((a, v) => a + v.entradas, 0)
                    const saidas = sorted.reduce((a, v) => a + v.saidas, 0)
                    setTotals({ entradas, saidas, saldo: entradas - saidas })
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [reportType, filterDataInicio, filterDataFim, filterCliente, filterStatus])

    const handlePrint = () => {
        const printContent = document.getElementById('report-printable')
        if (!printContent) return
        const w = window.open('', '_blank', 'width=1100,height=700')
        if (!w) return
        w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 16mm; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  h2 { font-size: 12px; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f0f0f0; font-weight: bold; border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
  td { border: 1px solid #ccc; padding: 4px 8px; }
  .totals { margin-top: 12px; font-weight: bold; font-size: 11px; }
  @media print { body { padding: 8mm; } }
</style></head><body>
${printContent.innerHTML}
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
</body></html>`)
        w.document.close()
    }

    const handleExportCSV = () => {
        if (!data.length) return
        const headers = Object.keys(data[0]).join(';')
        const rows = data.map((row: any) =>
            Object.values(row).map((v: any) =>
                typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
            ).join(';')
        ).join('\n')
        const csv = '\uFEFF' + headers + '\n' + rows
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const reportLabels: Record<ReportType, string> = {
        vendas: 'Relatório de Vendas',
        vendas_por_vendedor: 'Vendas por Vendedor',
        contas: 'Contas a Pagar / Receber',
        clientes: 'Cadastro de Clientes',
        fluxo_caixa: 'Fluxo de Caixa'
    }

    const reportIcons: Record<ReportType, JSX.Element> = {
        vendas: <ShoppingBag className="w-4 h-4" />,
        vendas_por_vendedor: <TrendingUp className="w-4 h-4" />,
        contas: <Wallet className="w-4 h-4" />,
        clientes: <Users className="w-4 h-4" />,
        fluxo_caixa: <ArrowUpCircle className="w-4 h-4" />,
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
                <p className="text-muted-foreground mt-1">Gere, filtre, imprima e exporte relatórios do sistema.</p>
            </div>

            {/* Report Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(Object.keys(reportLabels) as ReportType[]).map(type => (
                    <button
                        key={type}
                        onClick={() => setReportType(type)}
                        className={`p-3 rounded-xl border-2 text-left transition-all group ${reportType === type
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <div className="mb-1.5">{reportIcons[type]}</div>
                        <p className="text-xs font-bold leading-tight">{reportLabels[type]}</p>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold">{reportLabels[reportType]}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3 items-end mb-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Data Início</Label>
                            <Input
                                type="date"
                                className="h-8 text-xs w-36"
                                value={filterDataInicio}
                                onChange={e => setFilterDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Data Fim</Label>
                            <Input
                                type="date"
                                className="h-8 text-xs w-36"
                                value={filterDataFim}
                                onChange={e => setFilterDataFim(e.target.value)}
                            />
                        </div>
                        {(reportType === 'vendas' || reportType === 'contas') && (
                            <div className="space-y-1">
                                <Label className="text-xs">Cliente</Label>
                                <Select
                                    className="h-8 text-xs w-44"
                                    value={filterCliente}
                                    onChange={e => setFilterCliente(e.target.value)}
                                >
                                    <option value="">Todos os clientes</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </Select>
                            </div>
                        )}
                        {(reportType === 'vendas') && (
                            <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <Select
                                    className="h-8 text-xs w-36"
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="todos">Todos</option>
                                    <option value="Pendente">Pendente</option>
                                    <option value="Pago">Pago</option>
                                    <option value="Enviado">Enviado</option>
                                    <option value="Entregue">Entregue</option>
                                    <option value="Cancelado">Cancelado</option>
                                </Select>
                            </div>
                        )}
                        {reportType === 'contas' && (
                            <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <Select
                                    className="h-8 text-xs w-36"
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="todos">Todos</option>
                                    <option value="Pendente">Pendente</option>
                                    <option value="Pago">Pago</option>
                                    <option value="Vencido">Vencido</option>
                                    <option value="Cancelado">Cancelado</option>
                                </Select>
                            </div>
                        )}
                        <Button size="sm" className="h-8 gap-2" onClick={fetchReport} disabled={loading}>
                            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                            Gerar Relatório
                        </Button>
                        {data.length > 0 && (
                            <>
                                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={handlePrint}>
                                    <Printer className="w-3 h-3" /> Imprimir / PDF
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={handleExportCSV}>
                                    <Download className="w-3 h-3" /> Exportar Excel
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Totals Bar */}
                    {Object.keys(totals).length > 0 && (
                        <div className="flex gap-4 mb-4 flex-wrap">
                            {totals.total !== undefined && reportType === 'vendas' && (
                                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-muted-foreground text-xs">Total das Vendas:</span>
                                    <p className="font-black text-primary">{fmt(totals.total)}</p>
                                </div>
                            )}
                            {totals.total !== undefined && reportType === 'vendas_por_vendedor' && (
                                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-muted-foreground text-xs">Total Geral:</span>
                                    <p className="font-black text-primary">{fmt(totals.total)}</p>
                                </div>
                            )}
                            {totals.total !== undefined && reportType === 'clientes' && (
                                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-muted-foreground text-xs">Total de Clientes:</span>
                                    <p className="font-black text-primary">{totals.total}</p>
                                </div>
                            )}
                            {totals.receber !== undefined && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-xs text-muted-foreground flex gap-1 items-center"><ArrowDownCircle className="w-3 h-3 text-emerald-500" />A Receber / Entradas:</span>
                                    <p className="font-black text-emerald-500">{fmt(totals.receber)}</p>
                                </div>
                            )}
                            {totals.pagar !== undefined && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-xs text-muted-foreground flex gap-1 items-center"><ArrowUpCircle className="w-3 h-3 text-red-500" />A Pagar / Saídas:</span>
                                    <p className="font-black text-red-500">{fmt(totals.pagar)}</p>
                                </div>
                            )}
                            {totals.saldo !== undefined && (
                                <div className={`border rounded-lg px-4 py-2 text-sm ${totals.saldo >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <span className="text-xs text-muted-foreground">Saldo:</span>
                                    <p className={`font-black ${totals.saldo >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(totals.saldo)}</p>
                                </div>
                            )}
                            {totals.entradas !== undefined && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-xs text-muted-foreground flex gap-1 items-center"><ArrowDownCircle className="w-3 h-3 text-emerald-500" />Entradas:</span>
                                    <p className="font-black text-emerald-500">{fmt(totals.entradas)}</p>
                                </div>
                            )}
                            {totals.saidas !== undefined && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-xs text-muted-foreground flex gap-1 items-center"><ArrowUpCircle className="w-3 h-3 text-red-500" />Saídas:</span>
                                    <p className="font-black text-red-500">{fmt(totals.saidas)}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Printable Report Area */}
                    <div id="report-printable">
                        <div style={{ display: 'none' }} id="report-print-header">
                            <h1>{reportLabels[reportType]}</h1>
                            <h2>
                                Período: {filterDataInicio ? fmtDate(filterDataInicio) : '---'} até {filterDataFim ? fmtDate(filterDataFim) : '---'}
                                {' | '}Gerado em: {new Date().toLocaleString('pt-BR')}
                            </h2>
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando relatório...</div>
                        ) : data.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>Defina os filtros e clique em <strong>Gerar Relatório</strong> para visualizar os dados.</p>
                            </div>
                        ) : (
                            /* ===== RELATÓRIO: VENDAS ===== */
                            reportType === 'vendas' ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Pagamento</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((v: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono font-bold text-primary">
                                                    #{v.numero_pedido ? String(v.numero_pedido).padStart(6, '0') : '------'}
                                                </TableCell>
                                                <TableCell className="text-xs">{fmtDate(v.data_venda)}</TableCell>
                                                <TableCell>{v.clientes?.nome || 'Consumidor Final'}</TableCell>
                                                <TableCell>{v.atendentes?.nome || '---'}</TableCell>
                                                <TableCell className="text-xs">{v.forma_pagamento || '---'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={v.status === 'Cancelado' ? 'destructive' : v.status === 'Pago' || v.status === 'Entregue' ? 'default' : 'outline'} className="text-[10px]">
                                                        {v.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-bold">{fmt(v.total)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-primary/5 font-black">
                                            <TableCell colSpan={6} className="text-right text-sm">TOTAL GERAL</TableCell>
                                            <TableCell className="text-right text-sm text-primary">{fmt(totals.total || 0)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            ) : reportType === 'vendas_por_vendedor' ? (
                                /* ===== RELATÓRIO: VENDAS POR VENDEDOR ===== */
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead className="text-center">Qtd. Vendas</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">% do Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((v: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-bold">{v.nome}</TableCell>
                                                <TableCell className="text-center">{v.qtd}</TableCell>
                                                <TableCell className="text-right font-bold">{fmt(v.total)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {((v.total / (totals.total || 1)) * 100).toFixed(1)}%
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-primary/5 font-black">
                                            <TableCell colSpan={2} className="text-right text-sm">TOTAL</TableCell>
                                            <TableCell className="text-right text-sm text-primary">{fmt(totals.total || 0)}</TableCell>
                                            <TableCell className="text-right text-sm">100%</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            ) : reportType === 'contas' ? (
                                /* ===== RELATÓRIO: CONTAS ===== */
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Pagamento</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((v: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-sm">{v.descricao || '---'}</TableCell>
                                                <TableCell className="text-sm">{v.clientes?.nome || '---'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={v.tipo === 'receita' ? 'default' : 'destructive'} className="text-[10px]">
                                                        {v.tipo === 'receita' ? 'A Receber' : 'A Pagar'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">{fmtDate(v.data_vencimento)}</TableCell>
                                                <TableCell className="text-xs">{fmtDate(v.data_pagamento)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={v.status === 'Pago' ? 'default' : v.status === 'Vencido' ? 'destructive' : 'outline'} className="text-[10px]">
                                                        {v.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${v.tipo === 'receita' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {fmt(v.valor)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-primary/5">
                                            <TableCell colSpan={5} className="text-right text-sm font-black">Saldo (Receitas - Despesas)</TableCell>
                                            <TableCell className="text-right text-sm font-black text-primary">{fmt(totals.saldo || 0)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            ) : reportType === 'clientes' ? (
                                /* ===== RELATÓRIO: CLIENTES ===== */
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Telefone</TableHead>
                                            <TableHead>E-mail</TableHead>
                                            <TableHead>Cadastro</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((c: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{c.nome}</TableCell>
                                                <TableCell className="font-mono text-xs">{c.documento || '---'}</TableCell>
                                                <TableCell className="text-sm">{c.telefone || '---'}</TableCell>
                                                <TableCell className="text-sm">{c.email || '---'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : reportType === 'fluxo_caixa' ? (
                                /* ===== RELATÓRIO: FLUXO DE CAIXA ===== */
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mês</TableHead>
                                            <TableHead className="text-right text-emerald-500">Entradas</TableHead>
                                            <TableHead className="text-right text-red-500">Saídas</TableHead>
                                            <TableHead className="text-right">Saldo do Mês</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((m: any, i: number) => {
                                            const saldoMes = m.entradas - m.saidas
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-bold">
                                                        {new Date(m.mes + '-01').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                                    </TableCell>
                                                    <TableCell className="text-right text-emerald-500 font-bold">{fmt(m.entradas)}</TableCell>
                                                    <TableCell className="text-right text-red-500 font-bold">{fmt(m.saidas)}</TableCell>
                                                    <TableCell className={`text-right font-black ${saldoMes >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {fmt(saldoMes)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        <TableRow className="bg-primary/5 font-black text-sm">
                                            <TableCell>TOTAL PERÍODO</TableCell>
                                            <TableCell className="text-right text-emerald-500">{fmt(totals.entradas || 0)}</TableCell>
                                            <TableCell className="text-right text-red-500">{fmt(totals.saidas || 0)}</TableCell>
                                            <TableCell className={`text-right ${(totals.saldo || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(totals.saldo || 0)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            ) : null
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
