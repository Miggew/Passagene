import { useState, useEffect } from 'react';
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
    const [data, setData] = useState<GlobalHubData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            setIsLoading(true);
            setError(null);

            try {
                // Passo 1: Buscar Fazendas
                // Se for cliente, filtra restritamente pelas fazendas vinculadas ao seu ID
                // Se for admin/operacional, pega todas as fazendas ativas (o RLS do Supabase garantirá o escopo de visão correto do usuário logado)
                let queryFazendas = supabase
                    .from('fazendas')
                    .select('id, nome');

                if (isCliente && clienteId) {
                    queryFazendas = queryFazendas.eq('cliente_id', clienteId);
                }

                const { data: fazendasData, error: fazendaErr } = await queryFazendas;
                if (fazendaErr) throw fazendaErr;

                if (!fazendasData || fazendasData.length === 0) {
                    if (isMounted) {
                        setData({
                            fazendaIds: [],
                            receptoraIds: [],
                            fazendaNomeMap: new Map(),
                            receptoraFazendaMap: new Map(),
                            receptoras: []
                        });
                        setIsLoading(false);
                    }
                    return;
                }

                const fazendaIds = fazendasData.map(f => f.id);
                const fazendaNomeMap = new Map<string, string>();
                fazendasData.forEach(f => fazendaNomeMap.set(f.id, f.nome));

                // Passo 2: Buscar Receptoras dessas fazendas
                // Trazendo apenas o mínimo necessário para alimentar a inteligência artificial (Córtex)
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

                if (isMounted) {
                    setData({
                        fazendaIds,
                        receptoraIds,
                        fazendaNomeMap,
                        receptoraFazendaMap,
                        receptoras: resReceptoras
                    });
                }
            } catch (err: any) {
                console.error("Erro ao carregar Córtex Global de Fazendas:", err);
                if (isMounted) setError(err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [isCliente, clienteId]);

    return { data, isLoading, error };
}
