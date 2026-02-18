import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PassaGeneIcon } from '@/components/icons/PassaGeneIcons';
import { ChevronRight, Filter, Calendar, Search } from 'lucide-react';

export default function ClienteEmbrioes() {
    const [filter, setFilter] = useState('todos');

    // Dados mockados para demonstração
    const embrioes = [
        { id: 'E-847', doadora: 'Estrela FIV', raca: 'Girolando', estagio: 'Blastocisto', qualidade: 'Grau 1', status: 'congelado', data: '14/02/2026' },
        { id: 'E-848', doadora: 'Estrela FIV', raca: 'Girolando', estagio: 'Blastocisto Exp.', qualidade: 'Grau 1', status: 'congelado', data: '14/02/2026' },
        { id: 'E-849', doadora: 'Mimosa Te', raca: 'Gir Leiteiro', estagio: 'Mórula', qualidade: 'Grau 2', status: 'transferido', data: '10/02/2026' },
        { id: 'E-850', doadora: 'Mimosa Te', raca: 'Gir Leiteiro', estagio: 'Blastocisto', qualidade: 'Grau 1', status: 'transferido', data: '10/02/2026' },
        { id: 'E-851', doadora: 'Bela Vista', raca: 'Nelore', estagio: 'Blastocisto', qualidade: 'Grau 3', status: 'descartado', data: '05/02/2026' },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'congelado': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'transferido': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'descartado': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getIconForStage = (estagio: string) => {
        if (estagio.includes('Exp')) return 'prenhe'; // Metáfora visual para expandido
        if (estagio.includes('Mórula')) return 'touro'; // Placeholder: ideal seria ícone específico
        return 'prenhe'; // Padrão
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0f0d] text-[#e6eeea] font-sans pb-20">
            {/* Header Fixo */}
            <header className="sticky top-0 z-10 bg-[#0a0f0d]/90 backdrop-blur-md border-b border-[#1e2e28] px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white font-heading">
                            Meus Embriões
                        </h1>
                        <p className="text-[#8a9e94] text-lg mt-1">
                            Hub de Genética
                        </p>
                    </div>
                    <div className="h-16 w-16 bg-[#34d399]/10 rounded-2xl flex items-center justify-center border border-[#34d399]/20">
                        <PassaGeneIcon name="prenhe" size={40} className="text-[#34d399]" />
                    </div>
                </div>

                {/* Barra de Pesquisa/Filtro */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8a9e94]" />
                        <input
                            type="text"
                            placeholder="Buscar doadora ou lote..."
                            className="w-full bg-[#131c18] border border-[#1e2e28] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-[#566b62] focus:outline-none focus:border-[#34d399]/50 transition-colors text-lg"
                        />
                    </div>
                    <Button variant="outline" size="icon" className="h-12 w-12 border-[#1e2e28] bg-[#131c18]">
                        <Filter className="h-6 w-6 text-[#34d399]" />
                    </Button>
                </div>
            </header>

            {/* Conteúdo Scrollável */}
            <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4">
                    {/* Card de Resumo (KPI) */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <Card className="bg-[#1a2722] border-[#1e2e28] p-4 flex flex-col items-center justify-center text-center shadow-lg">
                            <span className="text-[#8a9e94] text-sm uppercase tracking-wider font-semibold">Congelados</span>
                            <span className="text-4xl font-bold text-white mt-1 font-heading">847</span>
                        </Card>
                        <Card className="bg-[#1a2722] border-[#1e2e28] p-4 flex flex-col items-center justify-center text-center shadow-lg">
                            <span className="text-[#8a9e94] text-sm uppercase tracking-wider font-semibold">Produção Mês</span>
                            <span className="text-4xl font-bold text-[#34d399] mt-1 font-heading">+12%</span>
                        </Card>
                    </div>

                    {/* Lista de Embriões */}
                    <h2 className="text-[#34d399] text-xs font-bold uppercase tracking-widest px-1 mb-2">Últimas Produções</h2>

                    {embrioes.map((embriao) => (
                        <Card key={embriao.id} className="bg-[#131c18] border-[#1e2e28] hover:bg-[#182520] transition-colors overflow-hidden group relative">
                            {/* Indicador lateral de status */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${embriao.status === 'congelado' ? 'bg-blue-500' : embriao.status === 'transferido' ? 'bg-emerald-500' : 'bg-red-500'}`} />

                            <div className="p-5 pl-7 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    {/* Ícone Grande */}
                                    <div className="h-16 w-16 bg-[#0a0f0d] rounded-2xl flex items-center justify-center border border-[#1e2e28] shrink-0">
                                        <PassaGeneIcon
                                            name={embriao.raca.includes('Girolando') ? 'doadora' : 'bezerro'}
                                            size={44}
                                            className={embriao.status === 'descartado' ? 'text-gray-600' : 'text-white'}
                                        />
                                    </div>

                                    {/* Informações Principais */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-bold text-xl">{embriao.id}</span>
                                            <Badge variant="outline" className={`text-xs font-bold border-0 ${getStatusColor(embriao.status)}`}>
                                                {embriao.status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-[#8a9e94] text-base font-medium flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                                            {embriao.doadora}
                                        </p>
                                        <p className="text-[#566b62] text-sm flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {embriao.data} • {embriao.qualidade}
                                        </p>
                                    </div>
                                </div>

                                <ChevronRight className="text-[#1e2e28] group-hover:text-[#34d399] w-8 h-8 transition-colors" />
                            </div>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
