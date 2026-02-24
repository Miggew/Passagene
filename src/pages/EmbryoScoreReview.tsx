import { useParams, useNavigate } from 'react-router-dom';
import { EmbryoReviewPanel } from '@/components/embryoscore';
import { ChevronLeft } from 'lucide-react';

export default function EmbryoScoreReview() {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();

  if (!queueId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        ID de análise não informado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar
      </button>

      <EmbryoReviewPanel queueId={queueId} />
    </div>
  );
}
