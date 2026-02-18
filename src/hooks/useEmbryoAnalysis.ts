
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { toast } from 'sonner';

export interface EnrichedEmbryoScore {
    id: string;
    embriao_id: string;
    embriao_identificacao: string;
    lote_codigo: string;
    media_id: string;
    classification: string;
    confidence: 'high' | 'medium' | 'low';
    embryo_score: number;

    // AI Reasoning
    reasoning?: string;
    gemini_reasoning?: string;
    stage_code?: string;
    quality_grade?: string;

    // Multi-Model Data
    knn_classification?: string;
    knn_confidence?: number;
    gemini_classification?: string;
    mlp_classification?: string;

    // Kinetics
    kinetic_intensity?: number;
    kinetic_harmony?: number;
    kinetic_symmetry?: number;
    kinetic_stability?: number;

    // Storage Paths
    crop_image_path?: string;
    motion_map_path?: string;
    composite_path?: string;
    composite_base64?: string; // New field from pipeline
    plate_frame_path?: string;

    // Validation
    biologo_nota?: string;
    biologo_concorda?: boolean;

    bbox_x_percent?: number | null;
    bbox_y_percent?: number | null;
    bbox_width_percent?: number | null;
    bbox_height_percent?: number | null;

    created_at: string;
}

export function useEmbryoAnalysis() {
    const [data, setData] = useState<EnrichedEmbryoScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function fetchScores() {
        setLoading(true);
        setError(null);

        try {
            // Step 1: Fetch scores with basic embryo info
            const { data: scores, error: scoreError } = await supabase
                .from('embryo_scores')
                .select(`
          *,
          embriao: embrioes (
            id,
            identificacao,
            lote_fiv_acasalamento_id,
            embryo_analysis_queue (
               plate_frame_path
            )
          )
        `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (scoreError) throw scoreError;

            if (!scores || scores.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch Lote Info manually (avoiding complex joins)
            const acasalamentoIds = [...new Set(
                scores
                    .map(s => (s.embriao as any)?.lote_fiv_acasalamento_id)
                    .filter(id => !!id)
            )];

            let loteMap: Record<string, string> = {};

            if (acasalamentoIds.length > 0) {
                const { data: lotes } = await supabase
                    .from('lote_fiv_acasalamentos')
                    .select('id')
                    .in('id', acasalamentoIds);

                if (lotes) {
                    lotes.forEach(l => {
                        loteMap[l.id] = l.id.slice(0, 8).toUpperCase();
                    });
                }
            }

            // Step 3: Normalize Data
            const enriched: EnrichedEmbryoScore[] = scores.map((s: any) => {
                // Safe access to nested relations
                const embriao = s.embriao || {};
                const queue = embriao.embryo_analysis_queue || {}; // Array or object depending on relation... usually object 1:1 if mapped correctly, but let's be safe.
                // Actually Supabase returns array for 1:N, but queue is unique per embryo?
                // Let's assume queue is an object if single, or take first if array.
                const queueObj = Array.isArray(queue) ? queue[0] : queue;

                const acasId = embriao.lote_fiv_acasalamento_id;
                const loteCode = acasId ? (loteMap[acasId] || 'N/A') : 'N/A';

                // Resolve URLs
                const cropPath = s.crop_image_path;
                const platePath = queueObj?.plate_frame_path; // From Queue (Source of Truth for Plate Frame)

                return {
                    ...s,
                    embriao_identificacao: embriao.identificacao || `Embrião #${s.id.slice(0, 4)}`,
                    lote_codigo: loteCode,
                    plate_frame_path: platePath,
                };
            });

            setData(enriched);

        } catch (err: any) {
            console.error('Error fetching embryo analysis:', err);
            setError(err.message);
            toast.error('Erro ao carregar análises: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchScores();
    }, []);

    // Helper to update a local item (e.g. after user feedback)
    const updateLocalItem = (id: string, updates: Partial<EnrichedEmbryoScore>) => {
        setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    return { data, loading, error, refresh: fetchScores, updateLocalItem };
}
