import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCamposPorRaca,
  agruparCamposPorCategoria,
  labelsCategorias,
  type CampoDinamico,
} from '@/lib/schemas/tourosPorRaca';

interface CamposDinamicosPorRacaProps {
  raca: string;
  valores: Record<string, any>; // Valores dos campos dinâmicos
  onChange: (campo: string, valor: any, categoria: string) => void;
  modoVisualizacao?: boolean; // Se true, apenas exibe os valores (sem edição)
}

export default function CamposDinamicosPorRaca({
  raca,
  valores,
  onChange,
  modoVisualizacao = false,
}: CamposDinamicosPorRacaProps) {
  const campos = getCamposPorRaca(raca);
  
  if (campos.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-4">
        {raca ? `Nenhum campo dinâmico configurado para a raça "${raca}"` : 'Selecione uma raça para ver os campos disponíveis'}
      </div>
    );
  }

  const camposAgrupados = agruparCamposPorCategoria(campos);

  const renderCampo = (campo: CampoDinamico) => {
    const valorAtual = valores[campo.nome] || '';
    const categoriaJsonb = campo.categoria === 'caseinas' ? 'caseinas' :
                           campo.categoria === 'medidas_fisicas' ? 'medidas_fisicas' :
                           campo.categoria === 'saude_reproducao' ? 'dados_saude_reproducao' :
                           campo.categoria === 'conformacao' ? 'dados_conformacao' :
                           campo.categoria === 'producao' ? 'dados_producao' :
                           campo.categoria === 'geneticos' ? 'dados_geneticos' :
                           'outros_dados';

    if (modoVisualizacao) {
      // Modo visualização - apenas exibe o valor
      if (!valorAtual && valorAtual !== 0) {
        return null; // Não exibe campos vazios
      }
      
      return (
        <div key={campo.nome} className="space-y-1">
          <Label className="text-sm font-medium text-slate-700">{campo.label}:</Label>
          <div className="text-sm text-slate-900">
            {campo.tipo === 'number' && typeof valorAtual === 'number'
              ? valorAtual.toLocaleString('pt-BR', { 
                  minimumFractionDigits: campo.step && campo.step < 1 ? 2 : 0,
                  maximumFractionDigits: campo.step && campo.step < 1 ? 2 : 0
                })
              : String(valorAtual)}
          </div>
        </div>
      );
    }

    // Modo edição - renderiza campo editável
    const handleChange = (novoValor: string | number) => {
      // Converter para número se necessário
      const valorFinal = campo.tipo === 'number' && novoValor !== ''
        ? parseFloat(String(novoValor))
        : novoValor;
      
      onChange(campo.nome, valorFinal, categoriaJsonb);
    };

    return (
      <div key={campo.nome} className="space-y-2">
        <Label htmlFor={campo.nome} className="text-sm">
          {campo.label}
          {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {campo.tipo === 'select' && campo.opcoes ? (
          <Select
            value={valorAtual || ''}
            onValueChange={handleChange}
          >
            <SelectTrigger id={campo.nome}>
              <SelectValue placeholder={campo.placeholder || `Selecione ${campo.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {campo.opcoes.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : campo.tipo === 'number' ? (
          <Input
            id={campo.nome}
            type="number"
            step={campo.step || 1}
            min={campo.min}
            max={campo.max}
            value={valorAtual || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={campo.placeholder}
          />
        ) : campo.tipo === 'text' ? (
          <Input
            id={campo.nome}
            type="text"
            value={valorAtual || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={campo.placeholder}
          />
        ) : (
          <Input
            id={campo.nome}
            type={campo.tipo}
            value={valorAtual || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={campo.placeholder}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {Object.entries(camposAgrupados).map(([categoria, camposDaCategoria]) => {
        // Agrupar por agrupamento se existir (ex: "SUMÁRIO ANCP")
        const agrupamentos: Record<string, CampoDinamico[]> = {};
        const camposSemAgrupamento: CampoDinamico[] = [];

        camposDaCategoria.forEach((campo) => {
          if (campo.agrupamento) {
            if (!agrupamentos[campo.agrupamento]) {
              agrupamentos[campo.agrupamento] = [];
            }
            agrupamentos[campo.agrupamento].push(campo);
          } else {
            camposSemAgrupamento.push(campo);
          }
        });

        return (
          <Card key={categoria}>
            <CardHeader>
              <CardTitle className="text-lg">{labelsCategorias[categoria] || categoria}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Campos com agrupamento */}
                {Object.entries(agrupamentos).map(([agrupamento, camposAgrup]) => (
                  <div key={agrupamento} className="col-span-full space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-1">
                      {agrupamento}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                      {camposAgrup.map(renderCampo)}
                    </div>
                  </div>
                ))}
                
                {/* Campos sem agrupamento */}
                {camposSemAgrupamento.map(renderCampo)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
