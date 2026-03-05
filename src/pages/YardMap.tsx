import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, MapPin, Box, Layers, Search, RefreshCw, ZoomIn, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LocationStats {
    id: string;
    nome: string;
    sigla: string | null;
    parent_id: string | null;
    productCount: number;
}

export function YardMap() {
    const [locations, setLocations] = useState<LocationStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<LocationStats | null>(null);
    const [locationItems, setLocationItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    const fetchMapData = async () => {
        setLoading(true);
        try {
            // Fetch all locations
            const { data: locs } = await supabase
                .from('localizacoes')
                .select('*')
                .order('nome');

            // Fetch product counts per location
            const { data: counts } = await supabase
                .from('produtos')
                .select('localizacao_id');

            const stats = (locs || []).map(loc => {
                const count = counts?.filter(c => c.localizacao_id === loc.id).length || 0;
                return { ...loc, productCount: count };
            });

            setLocations(stats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMapData();
    }, []);

    const handleSelectLocation = async (loc: LocationStats) => {
        setSelectedLocation(loc);
        setLoadingItems(true);
        try {
            const { data } = await supabase
                .from('produtos')
                .select('*')
                .eq('localizacao_id', loc.id)
                .limit(50);
            setLocationItems(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingItems(false);
        }
    };

    // Group by parent to create "Sectors"
    const sectors = useMemo(() => {
        const mainSectors = locations.filter(l => !l.parent_id);
        return mainSectors.map(s => ({
            ...s,
            boxes: locations.filter(l => l.parent_id === s.id)
        }));
    }, [locations]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Map className="w-8 h-8 text-primary" /> Yard Map <span className="text-xs bg-emerald-500/20 text-emerald-600 px-2 py-1 rounded-full uppercase tracking-widest font-black">WMS Visual</span>
                    </h1>
                    <p className="text-muted-foreground mt-1">Mapa visual do pátio e estoque. Monitore a ocupação de cada box em tempo real.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMapData} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar Mapa
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 space-y-8">
                    {loading ? (
                        <div className="flex items-center justify-center py-40 text-muted-foreground gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin" /> Carregando mapa...
                        </div>
                    ) : sectors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed rounded-3xl opacity-40 grayscale">
                            <MapPin className="w-20 h-20 mb-4" />
                            <p className="font-bold">Nenhuma localização cadastrada</p>
                            <p className="text-xs">Configure o WMS nas configurações para ver o mapa.</p>
                        </div>
                    ) : (
                        sectors.map(sector => (
                            <div key={sector.id} className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-border pb-2">
                                    <span className="w-3 h-3 rounded-full bg-primary" />
                                    <h2 className="font-extrabold text-lg uppercase tracking-tight">{sector.nome}</h2>
                                    <Badge variant="secondary" className="ml-2 font-mono text-[10px]">
                                        {sector.boxes.length} BOXES
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {sector.boxes.map(box => {
                                        const density = box.productCount > 10 ? 'bg-red-500/20 border-red-500/50' :
                                            box.productCount > 5 ? 'bg-amber-500/20 border-amber-500/50' :
                                                box.productCount > 0 ? 'bg-emerald-500/20 border-emerald-500/50' :
                                                    'bg-muted/10 border-border/50 opacity-60';

                                        const textColor = box.productCount > 10 ? 'text-red-700' :
                                            box.productCount > 5 ? 'text-amber-700' :
                                                box.productCount > 0 ? 'text-emerald-700' :
                                                    'text-muted-foreground';

                                        return (
                                            <button
                                                key={box.id}
                                                onClick={() => handleSelectLocation(box)}
                                                className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:scale-110 hover:shadow-xl hover:z-10 ${density} ${selectedLocation?.id === box.id ? 'ring-2 ring-primary ring-offset-2 scale-105' : ''}`}
                                            >
                                                <Box className={`w-8 h-8 mb-2 group-hover:animate-bounce ${textColor}`} />
                                                <span className="font-black text-xs uppercase tracking-tighter truncate w-full text-center">
                                                    {box.sigla || box.nome}
                                                </span>
                                                <div className={`mt-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-background/50 border border-current/20 ${textColor}`}>
                                                    {box.productCount} ITENS
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="sticky top-24 border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Box className="w-5 h-5 text-primary" /> Detalhes do Box
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {selectedLocation ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-black text-xl text-primary">{selectedLocation.sigla || selectedLocation.nome}</h3>
                                        <p className="text-xs text-muted-foreground">{selectedLocation.nome}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ocupação</p>
                                            <p className="font-bold text-sm tracking-tight">{selectedLocation.productCount} Itens</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-right">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Capacidade</p>
                                            <p className="font-bold text-sm tracking-tight opacity-50">~50</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Últimos Itens Guardados</p>
                                        {loadingItems ? (
                                            <div className="py-10 flex justify-center"><RefreshCw className="w-4 h-4 animate-spin opacity-30" /></div>
                                        ) : locationItems.length === 0 ? (
                                            <p className="text-xs text-center py-10 text-muted-foreground italic">Nenhum item neste box.</p>
                                        ) : (
                                            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2">
                                                {locationItems.map(item => (
                                                    <div key={item.id} className="p-2 rounded-lg bg-background border border-border/50 text-xs flex justify-between items-center group hover:border-primary/50 transition-colors">
                                                        <span className="truncate font-medium">{item.nome}</span>
                                                        <Badge variant="outline" className="text-[9px] font-mono shrink-0 px-1 bg-muted group-hover:bg-primary/10">{item.sku}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Button className="w-full gap-2 shadow-lg" size="sm">
                                        <ZoomIn className="w-4 h-4" /> Abrir no Estoque
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 space-y-4">
                                    <Info className="w-12 h-12" />
                                    <p className="text-center text-xs font-bold px-4 uppercase tracking-tighter">Selecione um BOX no mapa para ver o conteúdo</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
