import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';

export interface GlobalHubData {
    fazendaIds: string[];
    receptoraIds: string[];
    fazendaNomeMap: Map<string, string>;
    receptoraFazendaMap: Map<string, string>;
    receptoras: { id: string; status: string }[];
}

export function useGlobalFarmData() {
    const { isCliente, clienteId } = usePermissions();

    const query = useQuery<GlobalHubData | null>({
        queryKey: ['global-farm-data', isCliente, clienteId],
        queryFn: async () => {
            let queryFazendas = supabase
                .from('fazendas')
                .select('id, nome');

            if (isCliente && clienteId) {
                queryFazendas = queryFazendas.eq('cliente_id', clienteId);
            }

            const { data: fazendasData, error: fazendaErr } = await queryFazendas;
            if (fazendaErr) throw fazendaErr;

            if (!fazendasData || fazendasData.length === 0) {
                return {
                    fazendaIds: [],
                    receptoraIds: [],
                    fazendaNomeMap: new Map(),
                    receptoraFazendaMap: new Map(),
                    receptoras: []
                };
            }

            const fazendaIds = fazendasData.map(f => f.id);
            const fazendaNomeMap = new Map<string, string>();
            fazendasData.forEach(f => fazendaNomeMap.set(f.id, f.nome));

            const { data: receptorasData, error: recErr } = await supabase
                .from('receptoras')
                .select('id, fazenda_atual_id, status_reprodutivo')
                .in('fazenda_atual_id', fazendaIds);

            if (recErr) throw recErr;

            const receptoraIds = (receptorasData || []).map(r => r.id);
            const receptoraFazendaMap = new Map<string, string>();
            const resReceptoras = (receptorasData || []).map(r => {
                receptoraFazendaMap.set(r.id, r.fazenda_atual_id);
                return {
                    id: r.id,
                    status: r.status_reprodutivo || 'Desconhecido'
                };
            });

            return {
                fazendaIds,
                receptoraIds,
                fazendaNomeMap,
                receptoraFazendaMap,
                receptoras: resReceptoras
            };
        },
        staleTime: 5 * 60 * 1000, // 5 min — dados de fazenda mudam raramente
    });

    return { data: query.data ?? null, isLoading: query.isLoading, error: query.error as Error | null };
}
