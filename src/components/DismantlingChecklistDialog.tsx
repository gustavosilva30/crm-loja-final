import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, ListChecks, ArrowRight, ShieldCheck, Info, MapPin } from 'lucide-react';

interface PartTemplate {
    id: string;
    name: string;
    category: string;
    suggestedPriceFactor: number; // Factor of vehicle cost
}

const COMMON_PARTS: PartTemplate[] = [
    { id: '1', name: 'Motor Completo', category: 'Mecânica', suggestedPriceFactor: 0.4 },
    { id: '2', name: 'Câmbio / Transmissão', category: 'Mecânica', suggestedPriceFactor: 0.15 },
    { id: '3', name: 'Kit Airbag', category: 'Segurança', suggestedPriceFactor: 0.1 },
    { id: '4', name: 'Farol Dianteiro LE', category: 'Iluminação', suggestedPriceFactor: 0.03 },
    { id: '5', name: 'Farol Dianteiro LD', category: 'Iluminação', suggestedPriceFactor: 0.03 },
    { id: '6', name: 'Lanterna Traseira LE', category: 'Iluminação', suggestedPriceFactor: 0.02 },
    { id: '7', name: 'Lanterna Traseira LD', category: 'Iluminação', suggestedPriceFactor: 0.02 },
    { id: '8', name: 'Porta Dianteira LE', category: 'Lataria', suggestedPriceFactor: 0.05 },
    { id: '9', name: 'Porta Dianteira LD', category: 'Lataria', suggestedPriceFactor: 0.05 },
    { id: '10', name: 'Capô Panela', category: 'Lataria', suggestedPriceFactor: 0.04 },
];

interface DismantlingChecklistDialogProps {
    isOpen: boolean;
    onClose: () => void;
    sucata: any;
    onComplete: (selectedParts: any[]) => void;
    locations: any[];
}

export const DismantlingChecklistDialog: React.FC<DismantlingChecklistDialogProps> = ({
    isOpen,
    onClose,
    sucata,
    onComplete,
    locations
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [partsData, setPartsData] = useState<Record<string, { condition: string, price: number, locationId: string }>>({});
    const [defaultLocation, setDefaultLocation] = useState(sucata?.local_armazenagem || '');

    const togglePart = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            const template = COMMON_PARTS.find(p => p.id === id);
            const suggestedPrice = (sucata?.valor_compra || 0) * (template?.suggestedPriceFactor || 0.1);
            setPartsData(d => ({
                ...d,
                [id]: {
                    condition: 'Boa',
                    price: Math.round(suggestedPrice),
                    locationId: defaultLocation
                }
            }));
            return [...prev, id];
        });
    };

    const updatePart = (id: string, field: string, value: any) => {
        setPartsData(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleFinish = () => {
        const finalParts = selectedIds.map(id => {
            const template = COMMON_PARTS.find(p => p.id === id);
            return {
                nome: template?.name,
                condicao: partsData[id].condition,
                preco_venda: partsData[id].price,
                custo_estimado: partsData[id].price * 0.5,
                localizacao_id: partsData[id].locationId || defaultLocation || null,
                status: 'Disponível'
            };
        });
        onComplete(finalParts);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Checklist Rápido de Desmontagem" className="max-w-2xl">
            <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <div className="bg-amber-500/10 p-3 rounded-full">
                        <ListChecks className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-sm">Padronização de Desmonte</h3>
                        <p className="text-xs text-muted-foreground">Selecione as peças que serão aproveitadas deste veículo.</p>
                    </div>
                    <div className="min-w-[150px]">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Local Padrão</label>
                        <select
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={defaultLocation}
                            onChange={(e) => setDefaultLocation(e.target.value)}
                        >
                            <option value="">Sem local</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.sigla || l.nome}</option>)}
                        </select>
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                    {COMMON_PARTS.map((part) => (
                        <div key={part.id} className={`p-3 rounded-xl border transition-all ${selectedIds.includes(part.id) ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 bg-muted/20'}`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={selectedIds.includes(part.id)}
                                    onChange={() => togglePart(part.id)}
                                />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm">{part.name}</span>
                                        <Badge variant="outline" className="text-[9px] uppercase">{part.category}</Badge>
                                    </div>

                                    {selectedIds.includes(part.id) && (
                                        <div className="mt-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Condição</label>
                                                <select
                                                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                    value={partsData[part.id]?.condition}
                                                    onChange={(e) => updatePart(part.id, 'condition', e.target.value)}
                                                >
                                                    <option value="Ótima">Ótima</option>
                                                    <option value="Boa">Boa</option>
                                                    <option value="Regular">Regular</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Preço Sugerido (R$)</label>
                                                <input
                                                    type="number"
                                                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                    value={partsData[part.id]?.price}
                                                    onChange={(e) => updatePart(part.id, 'price', parseFloat(e.target.value))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-4 border-t border-border">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
                    <Button className="flex-1 gap-2" disabled={selectedIds.length === 0} onClick={handleFinish}>
                        <Wrench className="w-4 h-4" /> Finalizar Desmonte
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>

                {selectedIds.length > 0 && (
                    <p className="text-center text-[10px] text-muted-foreground uppercase font-bold">
                        Isso irá gerar {selectedIds.length} registros automáticos de peças.
                    </p>
                )}
            </div>
        </Modal>
    );
};
