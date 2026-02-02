import { Input } from '@/components/ui/input';

interface PessoaGenealogia {
  nome: string;
  registro: string;
}

interface GenealogiaData {
  pai: PessoaGenealogia;
  mae: PessoaGenealogia;
  pai_pai: PessoaGenealogia;
  pai_mae: PessoaGenealogia;
  mae_pai: PessoaGenealogia;
  mae_mae: PessoaGenealogia;
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
    <div className="space-y-4">
      {/* Container principal com gradiente sutil */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-muted/30 via-transparent to-muted/20 p-4">
        <div className="flex flex-col items-center gap-4">

          {/* Topo: Doadora (animal atual) */}
          <div className="relative">
            {/* Linha conectora vertical */}
            <div className="absolute left-1/2 top-full h-4 w-px bg-primary/40" />

            <div className="relative rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 shadow-sm min-w-[180px] text-center">
              {/* Indicador de destaque */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground uppercase tracking-wider">
                Doadora
              </div>
              <div className="mt-2">
                <div className="text-sm font-semibold text-foreground">
                  {doadoraNome || '—'}
                </div>
                <div className="text-[10px] font-medium text-primary mt-0.5">
                  {doadoraRegistro || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Meio: Pais */}
          <div className="relative flex gap-6 pt-2">
            {/* Linha horizontal conectando os pais */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
            {/* Linhas verticais dos pais */}
            <div className="absolute top-0 left-1/4 h-2 w-px bg-border" />
            <div className="absolute top-0 right-1/4 h-2 w-px bg-border" />

            {/* Pai */}
            <div className="relative group">
              <div className="absolute left-1/2 top-full h-3 w-px bg-blue-500/40" />
              <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent p-2.5 min-w-[150px] transition-all hover:border-blue-500/50 hover:shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pai</span>
                </div>
                <Input
                  placeholder="Nome"
                  value={value.pai.nome}
                  onChange={(e) => updatePessoa('pai', 'nome', e.target.value)}
                  className="h-7 text-xs mb-1.5 bg-background/80 border-blue-500/20 focus:border-blue-500/40"
                />
                <Input
                  placeholder="Registro"
                  value={value.pai.registro}
                  onChange={(e) => updatePessoa('pai', 'registro', e.target.value)}
                  className="h-6 text-[10px] bg-background/80 border-blue-500/20 focus:border-blue-500/40"
                />
              </div>
            </div>

            {/* Mãe */}
            <div className="relative group">
              <div className="absolute left-1/2 top-full h-3 w-px bg-pink-500/40" />
              <div className="rounded-lg border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-transparent to-transparent p-2.5 min-w-[150px] transition-all hover:border-pink-500/50 hover:shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Mãe</span>
                </div>
                <Input
                  placeholder="Nome"
                  value={value.mae.nome}
                  onChange={(e) => updatePessoa('mae', 'nome', e.target.value)}
                  className="h-7 text-xs mb-1.5 bg-background/80 border-pink-500/20 focus:border-pink-500/40"
                />
                <Input
                  placeholder="Registro"
                  value={value.mae.registro}
                  onChange={(e) => updatePessoa('mae', 'registro', e.target.value)}
                  className="h-6 text-[10px] bg-background/80 border-pink-500/20 focus:border-pink-500/40"
                />
              </div>
            </div>
          </div>

          {/* Base: Avós */}
          <div className="relative flex gap-2 pt-1">
            {/* Linha horizontal conectando avós paternos */}
            <div className="absolute top-0 left-[12.5%] w-[25%] h-px bg-blue-500/30" />
            {/* Linha horizontal conectando avós maternos */}
            <div className="absolute top-0 right-[12.5%] w-[25%] h-px bg-pink-500/30" />

            {/* Avô paterno */}
            <div className="rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent p-2 min-w-[130px] transition-all hover:border-blue-500/40">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500/60" />
                <span className="text-[9px] font-medium text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">Avô Pat.</span>
              </div>
              <Input
                placeholder="Nome"
                value={value.pai_pai.nome}
                onChange={(e) => updatePessoa('pai_pai', 'nome', e.target.value)}
                className="h-6 text-[10px] mb-1 bg-background/60 border-blue-500/15"
              />
              <Input
                placeholder="Registro"
                value={value.pai_pai.registro}
                onChange={(e) => updatePessoa('pai_pai', 'registro', e.target.value)}
                className="h-5 text-[9px] bg-background/60 border-blue-500/15"
              />
            </div>

            {/* Avó paterna */}
            <div className="rounded-lg border border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-transparent to-transparent p-2 min-w-[130px] transition-all hover:border-pink-500/40">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="w-1 h-1 rounded-full bg-pink-500/60" />
                <span className="text-[9px] font-medium text-pink-600/80 dark:text-pink-400/80 uppercase tracking-wider">Avó Pat.</span>
              </div>
              <Input
                placeholder="Nome"
                value={value.pai_mae.nome}
                onChange={(e) => updatePessoa('pai_mae', 'nome', e.target.value)}
                className="h-6 text-[10px] mb-1 bg-background/60 border-pink-500/15"
              />
              <Input
                placeholder="Registro"
                value={value.pai_mae.registro}
                onChange={(e) => updatePessoa('pai_mae', 'registro', e.target.value)}
                className="h-5 text-[9px] bg-background/60 border-pink-500/15"
              />
            </div>

            {/* Separador visual entre linhagens */}
            <div className="flex items-center px-1">
              <div className="h-12 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
            </div>

            {/* Avô materno */}
            <div className="rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent p-2 min-w-[130px] transition-all hover:border-blue-500/40">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500/60" />
                <span className="text-[9px] font-medium text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">Avô Mat.</span>
              </div>
              <Input
                placeholder="Nome"
                value={value.mae_pai.nome}
                onChange={(e) => updatePessoa('mae_pai', 'nome', e.target.value)}
                className="h-6 text-[10px] mb-1 bg-background/60 border-blue-500/15"
              />
              <Input
                placeholder="Registro"
                value={value.mae_pai.registro}
                onChange={(e) => updatePessoa('mae_pai', 'registro', e.target.value)}
                className="h-5 text-[9px] bg-background/60 border-blue-500/15"
              />
            </div>

            {/* Avó materna */}
            <div className="rounded-lg border border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-transparent to-transparent p-2 min-w-[130px] transition-all hover:border-pink-500/40">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="w-1 h-1 rounded-full bg-pink-500/60" />
                <span className="text-[9px] font-medium text-pink-600/80 dark:text-pink-400/80 uppercase tracking-wider">Avó Mat.</span>
              </div>
              <Input
                placeholder="Nome"
                value={value.mae_mae.nome}
                onChange={(e) => updatePessoa('mae_mae', 'nome', e.target.value)}
                className="h-6 text-[10px] mb-1 bg-background/60 border-pink-500/15"
              />
              <Input
                placeholder="Registro"
                value={value.mae_mae.registro}
                onChange={(e) => updatePessoa('mae_mae', 'registro', e.target.value)}
                className="h-5 text-[9px] bg-background/60 border-pink-500/15"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { GenealogiaData, PessoaGenealogia };
