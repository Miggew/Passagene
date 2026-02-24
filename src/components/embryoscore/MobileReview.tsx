import { useState } from 'react';
import { Button, Card, Badge } from '@/components/ui/mobile-atoms';
import { ChevronLeft, ChevronRight, Check, X, Maximize2 } from 'lucide-react';
import { EmbryoScore } from '@/lib/types';

interface MobileReviewProps {
  scores: EmbryoScore[];
  onReview: (id: string, approved: boolean) => void;
}

export default function MobileReview({ scores, onReview }: MobileReviewProps) {
  const [index, setIndex] = useState(0);
  const current = scores[index];

  if (!current) return <div className="p-8 text-center text-muted-foreground">Nenhum embrião para revisar.</div>;

  const handleAction = (approved: boolean) => {
    onReview(current.id, approved);
    if (index < scores.length - 1) {
      setIndex(i => i + 1);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-mono text-muted-foreground">
          {index + 1} / {scores.length}
        </span>
        <Badge variant={current.embryo_score >= 80 ? 'prenhe' : current.embryo_score >= 50 ? 'warning' : 'error'}>
          Score: {current.embryo_score}
        </Badge>
      </div>

      {/* Main Visual */}
      <div className="flex-1 bg-black/50 rounded-xl overflow-hidden relative mb-6">
        {/* Placeholder para vídeo/imagem */}
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          <Maximize2 className="w-12 h-12 opacity-50" />
        </div>
        
        {/* Overlay de dados */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-white">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="font-bold text-lg">Embrião #{current.embriao_id.slice(0,4)}</h3>
              <p className="text-xs opacity-80">Morfologia: {current.morph_score} • Cinética: {current.kinetic_score}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          variant="destructive" 
          size="lg" 
          className="h-14 rounded-xl"
          onClick={() => handleAction(false)}
        >
          <X className="w-6 h-6 mr-2" /> Descartar
        </Button>
        <Button 
          variant="primary" 
          size="lg" 
          className="h-14 rounded-xl"
          onClick={() => handleAction(true)}
        >
          <Check className="w-6 h-6 mr-2" /> Aprovar
        </Button>
      </div>
    </div>
  );
}
