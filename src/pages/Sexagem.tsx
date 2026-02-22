import PageHeader from '@/components/shared/PageHeader';
import { SexagemSessao } from '@/components/sexagem/SexagemSessao';

export default function Sexagem() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Sexagem Fetal"
                description="Registrar sexagem fetal por lote de receptoras prenhes"
            />

            <SexagemSessao />
        </div>
    );
}
