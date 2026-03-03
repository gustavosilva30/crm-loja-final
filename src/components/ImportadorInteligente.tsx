import { useState } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileType, Check, AlertCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ColumnMapping {
    fileColumn: string;
    dbColumn: string;
}

const DB_TABLES = [
    { value: 'produtos', label: 'Produtos', columns: ['nome', 'sku', 'part_number', 'marca', 'modelo', 'ano', 'preco', 'custo', 'estoque_atual', 'localizacao', 'ncm', 'cfop', 'cst', 'unidade_medida', 'descricao'] },
    { value: 'clientes', label: 'Clientes', columns: ['nome', 'documento', 'telefone', 'email', 'endereco'] },
    { value: 'fornecedores', label: 'Fornecedores', columns: ['nome', 'documento', 'razao_social', 'email', 'telefone'] },
]

export function ImportadorInteligente() {
    const [fileData, setFileData] = useState<any[]>([])
    const [fileHeaders, setFileHeaders] = useState<string[]>([])
    const [selectedTable, setSelectedTable] = useState('')
    const [mappings, setMappings] = useState<ColumnMapping[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<{ success: number, error: number } | null>(null)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (evt) => {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: 'binary' })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const data = XLSX.utils.sheet_to_json(ws)
            if (data.length > 0) {
                setFileData(data)
                setFileHeaders(Object.keys(data[0] as any))
                autoMap(Object.keys(data[0] as any))
            }
        }
        reader.readAsBinaryString(file)
    }

    const autoMap = (headers: string[]) => {
        if (!selectedTable) return
        const table = DB_TABLES.find(t => t.value === selectedTable)
        if (!table) return

        const newMappings: ColumnMapping[] = []
        table.columns.forEach(dbCol => {
            const match = headers.find(h =>
                h.toLowerCase() === dbCol.toLowerCase() ||
                h.toLowerCase().includes(dbCol.toLowerCase())
            )
            if (match) {
                newMappings.push({ fileColumn: match, dbColumn: dbCol })
            }
        })
        setMappings(newMappings)
    }

    const handleTableChange = (val: string) => {
        setSelectedTable(val)
        if (fileHeaders.length > 0) {
            const table = DB_TABLES.find(t => t.value === val)
            if (table) {
                const newMappings: ColumnMapping[] = []
                table.columns.forEach(dbCol => {
                    const match = fileHeaders.find(h =>
                        h.toLowerCase() === dbCol.toLowerCase()
                    )
                    if (match) newMappings.push({ fileColumn: match, dbColumn: dbCol })
                })
                setMappings(newMappings)
            }
        }
    }

    const updateMapping = (dbCol: string, fileCol: string) => {
        const filtered = mappings.filter(m => m.dbColumn !== dbCol)
        if (fileCol) {
            setMappings([...filtered, { dbColumn: dbCol, fileColumn: fileCol }])
        } else {
            setMappings(filtered)
        }
    }

    const startImport = async () => {
        if (!selectedTable || mappings.length === 0) return
        setIsProcessing(true)
        setResult(null)

        let success = 0
        let error = 0

        const itemsToInsert = fileData.map(row => {
            const obj: any = {}
            mappings.forEach(m => {
                let val = row[m.fileColumn]
                // Intelligent cleaning
                if (m.dbColumn === 'preco' || m.dbColumn === 'custo' || m.dbColumn === 'estoque_atual') {
                    val = typeof val === 'string' ? parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.')) : val
                }
                obj[m.dbColumn] = val
            })

            // Generate SKU if missing for products
            if (selectedTable === 'produtos' && !obj.sku) {
                obj.sku = `IMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
            }

            return obj
        })

        // Chunking inserts to avoid payload limits
        const chunkSize = 100
        for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
            const chunk = itemsToInsert.slice(i, i + chunkSize)
            const { error: insertError } = await supabase.from(selectedTable).insert(chunk)
            if (insertError) {
                console.error('Import error:', insertError)
                error += chunk.length
            } else {
                success += chunk.length
            }
        }

        setResult({ success, error })
        setIsProcessing(false)
    }

    return (
        <div className="space-y-6">
            <Card className="border-indigo-500/20 bg-indigo-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-600">
                        <Upload className="w-5 h-5" /> Importador Inteligente
                    </CardTitle>
                    <CardDescription>Envie arquivos Excel (.xlsx, .xls) ou CSV para alimentar seu banco de dados automaticamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>1. Selecione o que deseja importar</Label>
                                <Select
                                    value={selectedTable}
                                    onChange={(e) => handleTableChange(e.target.value)}
                                >
                                    <option value="">Selecione uma tabela...</option>
                                    {DB_TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>2. Upload do Arquivo (Excel ou CSV)</Label>
                                <div className="border-2 border-dashed border-indigo-500/30 rounded-xl p-8 text-center hover:bg-indigo-500/10 transition-colors relative cursor-pointer">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <FileType className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Clique ou arraste o arquivo aqui</p>
                                    <p className="text-xs text-muted-foreground mt-1">Formatos suportados: .xlsx, .xls, .csv</p>
                                </div>
                            </div>
                        </div>

                        {fileHeaders.length > 0 && selectedTable && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <Label>3. Mapeamento de Colunas</Label>
                                <div className="border rounded-lg bg-background p-4 space-y-3">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground mb-4">Relacione as colunas da sua planilha com o sistema:</p>
                                    {DB_TABLES.find(t => t.value === selectedTable)?.columns.map(dbCol => (
                                        <div key={dbCol} className="grid grid-cols-2 gap-4 items-center">
                                            <span className="text-sm font-bold capitalize">{dbCol.replace('_', ' ')}</span>
                                            <Select
                                                value={mappings.find(m => m.dbColumn === dbCol)?.fileColumn || ''}
                                                onChange={(e) => updateMapping(dbCol, e.target.value)}
                                                className="h-9 text-xs bg-muted/30"
                                            >
                                                <option value="">--- Ignorar ---</option>
                                                {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </Select>
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-12"
                                    disabled={isProcessing || mappings.length === 0}
                                    onClick={startImport}
                                >
                                    {isProcessing ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando Importação...</>
                                    ) : (
                                        <><Check className="w-4 h-4 mr-2" /> Iniciar Importação de {fileData.length} registros</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>

                    {result && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${result.error === 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                            {result.error === 0 ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <div>
                                <p className="font-bold">Resultado da Importação</p>
                                <p className="text-sm">{result.success} processados com sucesso. {result.error} falhas.</p>
                            </div>
                        </div>
                    )}

                    {fileData.length > 0 && !result && (
                        <div className="pt-6 border-t">
                            <Label className="mb-2 block">Prévia dos Dados (Primeiras 5 linhas)</Label>
                            <div className="overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {fileHeaders.slice(0, 6).map(h => <TableHead key={h}>{h}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fileData.slice(0, 5).map((row, idx) => (
                                            <TableRow key={idx}>
                                                {fileHeaders.slice(0, 6).map(h => (
                                                    <TableCell key={h} className="text-xs truncate max-w-[150px]">{String(row[h])}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
