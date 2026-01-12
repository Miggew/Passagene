import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PessoaGenealogia {
  nome: string;
  registro: string;
}

interface GenealogiaData {
  // Geração 1: A própria doadora (não editável aqui, vem do formulário principal)
  // Geração 2: Pais
  pai: PessoaGenealogia;
  mae: PessoaGenealogia;
  // Geração 3: Avós
  pai_pai: PessoaGenealogia; // Avô paterno
  pai_mae: PessoaGenealogia; // Avó paterna
  mae_pai: PessoaGenealogia; // Avô materno
  mae_mae: PessoaGenealogia; // Avó materna
}

interface GenealogiaTreeProps {
  value: GenealogiaData;
  onChange: (value: GenealogiaData) => void;
  doadoraNome?: string;
  doadoraRegistro?: string;
}

export default function GenealogiaTree({ value, onChange, doadoraNome, doadoraRegistro }: GenealogiaTreeProps) {
  const updatePessoa = (campo: keyof GenealogiaData, subcampo: 'nome' | 'registro', novoValor: string) => {
    onChange({
      ...value,
      [campo]: {
        ...value[campo],
        [subcampo]: novoValor,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-slate-700 mb-4">Genealogia</div>
      
      {/* Estrutura da árvore genealógica em formato de pirâmide */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        <div className="flex flex-col items-center gap-6">
          
          {/* Topo da pirâmide: Doadora */}
          <div className="flex flex-col items-center">
            <div className="bg-white border-2 border-slate-400 rounded-lg p-4 shadow-sm min-w-[200px] text-center">
              <div className="text-sm font-semibold text-slate-900 mb-1">
                {doadoraNome || 'Doadora'}
              </div>
              <div className="text-xs text-slate-600">
                {doadoraRegistro || 'REGISTRO'}
              </div>
            </div>
          </div>

          {/* Meio da pirâmide: Pais */}
          <div className="flex gap-4">
            {/* Pai */}
            <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-sm min-w-[180px]">
              <Label className="text-xs text-blue-700 font-medium mb-2 block">Pai</Label>
              <Input
                placeholder="Nome"
                value={value.pai.nome}
                onChange={(e) => updatePessoa('pai', 'nome', e.target.value)}
                className="mb-2 text-sm"
              />
              <Input
                placeholder="Registro"
                value={value.pai.registro}
                onChange={(e) => updatePessoa('pai', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Mãe */}
            <div className="bg-white border-2 border-red-500 rounded-lg p-3 shadow-sm min-w-[180px]">
              <Label className="text-xs text-red-700 font-medium mb-2 block">Mãe</Label>
              <Input
                placeholder="Nome"
                value={value.mae.nome}
                onChange={(e) => updatePessoa('mae', 'nome', e.target.value)}
                className="mb-2 text-sm"
              />
              <Input
                placeholder="Registro"
                value={value.mae.registro}
                onChange={(e) => updatePessoa('mae', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Base da pirâmide: Avós (todos lado a lado) */}
          <div className="flex gap-3">
            {/* Avô paterno */}
            <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-sm min-w-[160px]">
              <Label className="text-xs text-blue-700 font-medium mb-2 block">Avô Paterno</Label>
              <Input
                placeholder="Nome"
                value={value.pai_pai.nome}
                onChange={(e) => updatePessoa('pai_pai', 'nome', e.target.value)}
                className="mb-2 text-xs"
              />
              <Input
                placeholder="Registro"
                value={value.pai_pai.registro}
                onChange={(e) => updatePessoa('pai_pai', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Avó paterna */}
            <div className="bg-white border-2 border-red-500 rounded-lg p-3 shadow-sm min-w-[160px]">
              <Label className="text-xs text-red-700 font-medium mb-2 block">Avó Paterna</Label>
              <Input
                placeholder="Nome"
                value={value.pai_mae.nome}
                onChange={(e) => updatePessoa('pai_mae', 'nome', e.target.value)}
                className="mb-2 text-xs"
              />
              <Input
                placeholder="Registro"
                value={value.pai_mae.registro}
                onChange={(e) => updatePessoa('pai_mae', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Avô materno */}
            <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-sm min-w-[160px]">
              <Label className="text-xs text-blue-700 font-medium mb-2 block">Avô Materno</Label>
              <Input
                placeholder="Nome"
                value={value.mae_pai.nome}
                onChange={(e) => updatePessoa('mae_pai', 'nome', e.target.value)}
                className="mb-2 text-xs"
              />
              <Input
                placeholder="Registro"
                value={value.mae_pai.registro}
                onChange={(e) => updatePessoa('mae_pai', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Avó materna */}
            <div className="bg-white border-2 border-red-500 rounded-lg p-3 shadow-sm min-w-[160px]">
              <Label className="text-xs text-red-700 font-medium mb-2 block">Avó Materna</Label>
              <Input
                placeholder="Nome"
                value={value.mae_mae.nome}
                onChange={(e) => updatePessoa('mae_mae', 'nome', e.target.value)}
                className="mb-2 text-xs"
              />
              <Input
                placeholder="Registro"
                value={value.mae_mae.registro}
                onChange={(e) => updatePessoa('mae_mae', 'registro', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { GenealogiaData, PessoaGenealogia };
