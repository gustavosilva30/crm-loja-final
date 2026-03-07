import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, FileJson, FileSpreadsheet, ArrowRight, Check, AlertCircle, Database, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface Mapping {
    target: string
    source: string
    label: string
    required: boolean
}

const TARGET_COLUMNS: Mapping[] = [
    { target: 'descricao', label: 'Descrição/Nome', source: '', required: true },
    { target: 'valor', label: 'Valor (R$)', source: '', required: true },
    { target: 'data_vencimento', label: 'Data de Vencimento', source: '', required: true },
    { target: 'tipo', label: 'Tipo (Receita/Despesa)', source: '', required: true },
    { target: 'categoria_financeira', label: 'Categoria', source: '', required: false },
    { target: 'forma_pagamento', label: 'Forma de Pagamento', source: '', required: false },
    { target: 'status', label: 'Status (Pago/Pendente)', source: '', required: false },
]

export function Importador() {
    const [rawData, setRawData] = useState<any[]>([])
    const [columns, setColumns] = useState<string[]>([])
    const [mappings, setMappings] = useState<Record<string, string>>({})
    const [preview, setPreview] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<1 | 2 | 3>(1)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string
                let data: any[] = []

                if (file.name.endsWith('.json')) {
                    data = JSON.parse(text)
                } else if (file.name.endsWith('.csv')) {
                    const lines = text.split('\n')
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
                    data = lines.slice(1).filter(line => line.trim()).map(line => {
                        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
                        return headers.reduce((obj: any, header, i) => {
                            obj[header] = values[i]
                            return obj
                        }, {})
                    })
                }

                if (data.length > 0) {
                    setRawData(data)
                    setColumns(Object.keys(data[0]))
                    setStep(2)
                }
            } catch (err) {
                alert("Erro ao processar arquivo. Verifique o formato.")
            }
        }
        reader.readAsText(file)
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text')
        try {
            const data = JSON.parse(text)
            if (Array.isArray(data) && data.length > 0) {
                setRawData(data)
                setColumns(Object.keys(data[0]))
                setStep(2)
            }
        } catch (err) {
            // Se não for JSON, tenta CSV
            const lines = text.split('\n')
            if (lines.length > 1) {
                const headers = lines[0].split('\t').length > 1 ? lines[0].split('\t') : lines[0].split(',') // Suporta Tabs do Excel
                const separator = lines[0].split('\t').length > 1 ? '\t' : ','
                const data = lines.slice(1).filter(line => line.trim()).map(line => {
                    const values = line.split(separator).map(v => v.trim())
                    return headers.reduce((obj: any, header, i) => {
                        obj[header] = values[i]
                        return obj
                    }, {})
                })
                setRawData(data)
                setColumns(headers)
                setStep(2)
            }
        }
    }

    const updateMapping = (target: string, source: string) => {
        setMappings(prev => ({ ...prev, [target]: source }))
    }

    const generatePreview = () => {
        const transformed = rawData.slice(0, 10).map(item => {
            const entry: any = {}
            TARGET_COLUMNS.forEach(col => {
                const sourceVal = item[mappings[col.target]]

                // Transformações Básicas
                if (col.target === 'valor') {
                    entry[col.target] = parseFloat(String(sourceVal).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
                } else if (col.target === 'data_vencimento') {
                    // Tenta converter datas comuns
                    const date = new Date(sourceVal)
                    entry[col.target] = isNaN(date.getTime()) ? sourceVal : date.toISOString().split('T')[0]
                } else if (col.target === 'tipo') {
                    const val = String(sourceVal).toUpperCase()
                    entry[col.target] = (val.includes('INFLOW') || val.includes('RECEITA') || val.includes('ENTRADA')) ? 'Receita' : 'Despesa'
                } else if (col.target === 'status') {
                    const val = String(sourceVal).toUpperCase()
                    entry[col.target] = (val.includes('PAID') || val.includes('PAGO') || val.includes('RECEBIDO')) ? 'Pago' : 'Pendente'
                } else {
                    entry[col.target] = sourceVal || (col.target === 'categoria_financeira' ? 'Geral' : '')
                }
            })
            return entry
        })
        setPreview(transformed)
        setStep(3)
    }

    const handleImport = async () => {
        setLoading(true)
        try {
            const finalData = rawData.map(item => {
                const entry: any = {}
                TARGET_COLUMNS.forEach(col => {
                    const sourceVal = item[mappings[col.target]]
                    if (col.target === 'valor') {
                        entry[col.target] = parseFloat(String(sourceVal).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
                    } else if (col.target === 'data_vencimento') {
                        const date = new Date(sourceVal)
                        entry[col.target] = isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0]
                    } else if (col.target === 'tipo') {
                        const val = String(sourceVal).toUpperCase()
                        entry[col.target] = (val.includes('INFLOW') || val.includes('RECEITA') || val.includes('ENTRADA')) ? 'Receita' : 'Despesa'
                    } else if (col.target === 'status') {
                        const val = String(sourceVal).toUpperCase()
                        entry[col.target] = (val.includes('PAID') || val.includes('PAGO') || val.includes('RECEBIDO')) ? 'Pago' : 'Pendente'
                    } else {
                        entry[col.target] = sourceVal || (col.target === 'categoria_financeira' ? 'Geral' : '')
                    }
                })
                return entry
            })

            const { error } = await supabase.from('financeiro_lancamentos').insert(finalData)
            if (error) throw error

            alert(`${finalData.length} registros importados com sucesso!`)
            setStep(1)
            setRawData([])
            setMappings({})
        } catch (err: any) {
            alert("Erro na importação: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Importador de Dados</h1>
                    <p className="text-muted-foreground mt-1">Migre seus dados financeiros de forma simples e intuitiva.</p>
                </div>
                <div className="flex gap-2">
                    <Badge variant={step >= 1 ? "default" : "outline"}>1. Upload</Badge>
                    <Badge variant={step >= 2 ? "default" : "outline"}>2. Mapeamento</Badge>
                    <Badge variant={step >= 3 ? "default" : "outline"}>3. Preview</Badge>
                </div>
            </div>

            {step === 1 && (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="w-8 h-8 text-primary" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">Carregue seus dados</h3>
                            <p className="text-sm text-muted-foreground">Arraste um arquivo CSV/JSON ou cole dados do Excel aqui.</p>
                        </div>
                        <div className="flex gap-4">
                            <label className="cursor-pointer">
                                <div className={cn(
                                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2"
                                )}>
                                    <FileJson className="w-4 h-4" /> Importar JSON
                                </div>
                                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                            </label>
                            <label className="cursor-pointer">
                                <div className={cn(
                                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2"
                                )}>
                                    <FileSpreadsheet className="w-4 h-4" /> Importar CSV
                                </div>
                                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                        <div className="w-full max-w-md">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou cole os dados abaixo</span></div>
                            </div>
                            <textarea
                                className="w-full mt-4 h-32 p-3 text-xs bg-muted/50 rounded-lg border font-mono focus:ring-1 focus:ring-primary outline-none"
                                placeholder="Cole aqui o conteúdo do seu JSON ou linhas do Excel..."
                                onPaste={handlePaste}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mapeamento de Colunas</CardTitle>
                            <CardDescription>Diga ao sistema qual coluna do seu arquivo corresponde aos nossos campos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {TARGET_COLUMNS.map(col => (
                                <div key={col.target} className="grid grid-cols-2 items-center gap-4 p-2 rounded-lg border bg-muted/20">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium flex items-center gap-1.5">
                                            {col.label}
                                            {col.required && <span className="text-rose-500">*</span>}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{col.target}</span>
                                    </div>
                                    <Select
                                        value={mappings[col.target] || ""}
                                        onChange={e => updateMapping(col.target, e.target.value)}
                                    >
                                        <option value="">Selecione a coluna...</option>
                                        {columns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </Select>
                                </div>
                            ))}
                            <div className="flex justify-between pt-4">
                                <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                                <Button
                                    className="gap-2"
                                    onClick={generatePreview}
                                    disabled={TARGET_COLUMNS.filter(c => c.required).some(c => !mappings[c.target])}
                                >
                                    Visualizar Dados <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Database className="w-4 h-4" /> Amostra dos Dados Originais
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {columns.slice(0, 4).map(c => <TableHead key={c} className="text-[10px]">{c}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rawData.slice(0, 5).map((row, i) => (
                                            <TableRow key={i}>
                                                {columns.slice(0, 4).map(c => <TableCell key={c} className="text-[10px] truncate max-w-[100px]">{row[c]}</TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-4 italic">Exibindo os primeiros 5 de {rawData.length} registros.</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {step === 3 && (
                <Card className="animate-in fade-in zoom-in-95">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Preview da Importação</CardTitle>
                            <CardDescription>Confira como os dados serão salvos no sistema.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(2)}>Ajustar Mapeamento</Button>
                            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleImport} disabled={loading}>
                                {loading ? "Importando..." : <><Check className="w-4 h-4" /> Confirmar Importação</>}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs">{new Date(row.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell className="font-medium">{row.descricao}</TableCell>
                                            <TableCell>
                                                <Badge variant={row.tipo === 'Receita' ? 'default' : 'destructive'} className="text-[10px]">
                                                    {row.tipo}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-blue-500">Pronto para importar!</p>
                                <p className="text-muted-foreground">Ao clicar em confirmar, **{rawData.length}** registros serão adicionados ao seu Financeiro.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
