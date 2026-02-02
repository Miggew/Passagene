/**
 * Componente simples de visualização de genealogia (apenas pai e mãe)
 * Para uso em páginas de catálogo onde não há edição
 */

import { CowIcon } from '@/components/icons/CowIcon';

interface AnimalInfo {
  nome?: string | null;
  registro?: string | null;
}

interface GenealogiaTreeSimpleProps {
  pai: AnimalInfo;
  mae: AnimalInfo;
  animalNome?: string;
}

export default function GenealogiaTreeSimple({ pai, mae, animalNome }: GenealogiaTreeSimpleProps) {
  const hasPai = pai?.nome || pai?.registro;
  const hasMae = mae?.nome || mae?.registro;

  if (!hasPai && !hasMae) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Genealogia não informada
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pai */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
          <CowIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Pai</p>
          {hasPai ? (
            <>
              <p className="font-medium text-sm truncate">{pai.nome || '-'}</p>
              {pai.registro && (
                <p className="text-xs text-muted-foreground">{pai.registro}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Não informado</p>
          )}
        </div>
      </div>

      {/* Mãe */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-500/5 border border-pink-500/20">
        <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
          <CowIcon className="w-4 h-4 text-pink-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-pink-600 uppercase tracking-wider">Mãe</p>
          {hasMae ? (
            <>
              <p className="font-medium text-sm truncate">{mae.nome || '-'}</p>
              {mae.registro && (
                <p className="text-xs text-muted-foreground">{mae.registro}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Não informada</p>
          )}
        </div>
      </div>
    </div>
  );
}
