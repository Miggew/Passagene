import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodoTipo = 'mes' | 'trimestre' | 'semestre' | 'ano' | 'ultimos12';

export interface PeriodoSelecionado {
  tipo: PeriodoTipo;
  valor: string; // ex: "2026-01" para mês, "2026-T1" para trimestre
  inicio: Date;
  fim: Date;
  inicioAnterior: Date;
  fimAnterior: Date;
  label: string;
  labelAnterior: string;
}

interface PeriodSelectorProps {
  tipo: PeriodoTipo;
  valor: string;
  onTipoChange: (tipo: PeriodoTipo) => void;
  onValorChange: (valor: string) => void;
  className?: string;
}

const TIPOS_PERIODO = [
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'ano', label: 'Ano' },
  { value: 'ultimos12', label: 'Últimos 12 meses' },
] as const;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function gerarPeriodo(tipo: PeriodoTipo, valor: string): PeriodoSelecionado {
  const agora = new Date();
  let inicio: Date;
  let fim: Date;
  let label: string;

  switch (tipo) {
    case 'mes': {
      const [ano, mes] = valor.split('-').map(Number);
      inicio = startOfMonth(new Date(ano, mes - 1));
      fim = endOfMonth(new Date(ano, mes - 1));
      label = format(inicio, 'MMMM yyyy', { locale: ptBR });
      break;
    }
    case 'trimestre': {
      const [ano, t] = valor.split('-T');
      const trimestre = parseInt(t);
      const mesInicio = (trimestre - 1) * 3;
      inicio = startOfMonth(new Date(parseInt(ano), mesInicio));
      fim = endOfMonth(new Date(parseInt(ano), mesInicio + 2));
      label = `T${trimestre} ${ano} (${MESES[mesInicio].slice(0, 3)}-${MESES[mesInicio + 2].slice(0, 3)})`;
      break;
    }
    case 'semestre': {
      const [ano, s] = valor.split('-S');
      const semestre = parseInt(s);
      const mesInicio = (semestre - 1) * 6;
      inicio = startOfMonth(new Date(parseInt(ano), mesInicio));
      fim = endOfMonth(new Date(parseInt(ano), mesInicio + 5));
      label = `S${semestre} ${ano} (${MESES[mesInicio].slice(0, 3)}-${MESES[mesInicio + 5].slice(0, 3)})`;
      break;
    }
    case 'ano': {
      const ano = parseInt(valor);
      inicio = startOfYear(new Date(ano, 0));
      fim = endOfYear(new Date(ano, 0));
      label = String(ano);
      break;
    }
    case 'ultimos12':
    default: {
      fim = endOfMonth(agora);
      inicio = startOfMonth(subMonths(agora, 11));
      label = 'Últimos 12 meses';
      break;
    }
  }

  // Período anterior (mesmo período do ano passado)
  const inicioAnterior = subYears(inicio, 1);
  const fimAnterior = subYears(fim, 1);

  let labelAnterior: string;
  switch (tipo) {
    case 'mes':
      labelAnterior = format(inicioAnterior, 'MMM yyyy', { locale: ptBR });
      break;
    case 'trimestre': {
      const [, t] = valor.split('-T');
      labelAnterior = `T${t} ${parseInt(valor.split('-')[0]) - 1}`;
      break;
    }
    case 'semestre': {
      const [, s] = valor.split('-S');
      labelAnterior = `S${s} ${parseInt(valor.split('-')[0]) - 1}`;
      break;
    }
    case 'ano':
      labelAnterior = String(parseInt(valor) - 1);
      break;
    case 'ultimos12':
    default:
      labelAnterior = 'Período anterior';
      break;
  }

  return {
    tipo,
    valor,
    inicio,
    fim,
    inicioAnterior,
    fimAnterior,
    label,
    labelAnterior,
  };
}

export function PeriodSelector({
  tipo,
  valor,
  onTipoChange,
  onValorChange,
  className,
}: PeriodSelectorProps) {
  const agora = new Date();
  const anoAtual = agora.getFullYear();

  // Gerar opções de período baseado no tipo
  const opcoesPeriodo = useMemo(() => {
    const opcoes: { value: string; label: string }[] = [];

    switch (tipo) {
      case 'mes': {
        // Últimos 24 meses
        for (let i = 0; i < 24; i++) {
          const data = subMonths(agora, i);
          const value = format(data, 'yyyy-MM');
          const label = format(data, 'MMMM yyyy', { locale: ptBR });
          opcoes.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        break;
      }
      case 'trimestre': {
        // Últimos 8 trimestres
        for (let ano = anoAtual; ano >= anoAtual - 2; ano--) {
          for (let t = 4; t >= 1; t--) {
            if (ano === anoAtual) {
              const trimestreAtual = Math.ceil((agora.getMonth() + 1) / 3);
              if (t > trimestreAtual) continue;
            }
            const mesInicio = (t - 1) * 3;
            opcoes.push({
              value: `${ano}-T${t}`,
              label: `T${t} ${ano} (${MESES[mesInicio].slice(0, 3)}-${MESES[mesInicio + 2].slice(0, 3)})`,
            });
          }
        }
        break;
      }
      case 'semestre': {
        // Últimos 4 semestres
        for (let ano = anoAtual; ano >= anoAtual - 2; ano--) {
          for (let s = 2; s >= 1; s--) {
            if (ano === anoAtual) {
              const semestreAtual = agora.getMonth() < 6 ? 1 : 2;
              if (s > semestreAtual) continue;
            }
            const mesInicio = (s - 1) * 6;
            opcoes.push({
              value: `${ano}-S${s}`,
              label: `S${s} ${ano} (${MESES[mesInicio].slice(0, 3)}-${MESES[mesInicio + 5].slice(0, 3)})`,
            });
          }
        }
        break;
      }
      case 'ano': {
        // Últimos 5 anos
        for (let ano = anoAtual; ano >= anoAtual - 4; ano--) {
          opcoes.push({ value: String(ano), label: String(ano) });
        }
        break;
      }
      case 'ultimos12':
      default: {
        opcoes.push({ value: 'ultimos12', label: 'Últimos 12 meses' });
        break;
      }
    }

    return opcoes;
  }, [tipo, anoAtual]);

  // Quando muda o tipo, seleciona o primeiro valor válido
  const handleTipoChange = (novoTipo: PeriodoTipo) => {
    onTipoChange(novoTipo);

    // Definir valor padrão para o novo tipo
    switch (novoTipo) {
      case 'mes':
        onValorChange(format(agora, 'yyyy-MM'));
        break;
      case 'trimestre': {
        const t = Math.ceil((agora.getMonth() + 1) / 3);
        onValorChange(`${anoAtual}-T${t}`);
        break;
      }
      case 'semestre': {
        const s = agora.getMonth() < 6 ? 1 : 2;
        onValorChange(`${anoAtual}-S${s}`);
        break;
      }
      case 'ano':
        onValorChange(String(anoAtual));
        break;
      case 'ultimos12':
        onValorChange('ultimos12');
        break;
    }
  };

  const periodoAtual = gerarPeriodo(tipo, valor);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Tipo de período */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={tipo} onValueChange={(v) => handleTipoChange(v as PeriodoTipo)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_PERIODO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Valor do período */}
        {tipo !== 'ultimos12' && (
          <Select value={valor} onValueChange={onValorChange}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoesPeriodo.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Info do comparativo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground cursor-help">
              <Info className="w-3.5 h-3.5" />
              <span>Comparando com: {periodoAtual.labelAnterior}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Os KPIs serão comparados com o mesmo período do ano anterior</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default PeriodSelector;
