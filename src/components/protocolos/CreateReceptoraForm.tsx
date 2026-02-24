import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus } from 'lucide-react';
import ClassificacoesCicloInline from '@/components/shared/ClassificacoesCicloInline';

interface CreateReceptoraFormProps {
    createReceptoraForm: {
        identificacao: string;
        nome: string;
        observacoes: string;
        ciclando_classificacao?: 'N' | 'CL' | null;
        qualidade_semaforo?: 1 | 2 | 3 | null;
    };
    setCreateReceptoraForm: Dispatch<SetStateAction<{
        identificacao: string;
        nome: string;
        observacoes: string;
        ciclando_classificacao?: 'N' | 'CL' | null;
        qualidade_semaforo?: 1 | 2 | 3 | null;
    }>>;
    submitting: boolean;
    onCreate: () => Promise<void>;
}

export function CreateReceptoraForm({
    createReceptoraForm,
    setCreateReceptoraForm,
    submitting,
    onCreate,
}: CreateReceptoraFormProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Identificação (Brinco) *</Label>
                <Input
                    value={createReceptoraForm.identificacao}
                    onChange={(e) =>
                        setCreateReceptoraForm({ ...createReceptoraForm, identificacao: e.target.value })
                    }
                    placeholder="Número do brinco"
                />
            </div>
            <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                    value={createReceptoraForm.nome}
                    onChange={(e) =>
                        setCreateReceptoraForm({ ...createReceptoraForm, nome: e.target.value })
                    }
                    placeholder="Nome da receptora (opcional)"
                />
            </div>
            <div className="space-y-2">
                <ClassificacoesCicloInline
                    ciclandoValue={createReceptoraForm.ciclando_classificacao || null}
                    qualidadeValue={createReceptoraForm.qualidade_semaforo || null}
                    onChangeCiclando={(value) =>
                        setCreateReceptoraForm({ ...createReceptoraForm, ciclando_classificacao: value })
                    }
                    onChangeQualidade={(value) =>
                        setCreateReceptoraForm({ ...createReceptoraForm, qualidade_semaforo: value })
                    }
                    size="sm"
                />
            </div>
            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                    value={createReceptoraForm.observacoes}
                    onChange={(e) =>
                        setCreateReceptoraForm({ ...createReceptoraForm, observacoes: e.target.value })
                    }
                    placeholder="Observações"
                    rows={2}
                />
            </div>
            <Button onClick={onCreate} className="w-full" disabled={submitting}>
                <UserPlus className="w-4 h-4 mr-2" />
                {submitting ? 'Criando...' : 'Criar e Adicionar'}
            </Button>
        </div>
    );
}
