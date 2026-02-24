import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Moon, Sun, Check, X, Edit, Trash2, Download } from 'lucide-react';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import logoSimples from '@/assets/logosimples.svg';
import logoEscrito from '@/assets/logoescrito.svg';

// Hook simples para dark mode com localStorage
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return [isDark, setIsDark] as const;
}

// Dados fake para tabela
const fakeData = [
  { id: 1, nome: 'Fazenda Boa Vista', cidade: 'Uberaba', status: 'Ativo' },
  { id: 2, nome: 'Rancho Alegre', cidade: 'Araguari', status: 'Ativo' },
  { id: 3, nome: 'Sítio das Palmeiras', cidade: 'Uberlândia', status: 'Inativo' },
];

export default function StyleGuide() {
  const [isDark, setIsDark] = useDarkMode();

  const downloadSVG = (id: string, name: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    // We need to clone it to remove any React specific classes or inject xmlns if missing, but XMLSerializer usually handles it.
    const container = el.cloneNode(true) as HTMLElement;
    // Find the actual inner SVG or just export the first child if it's the wrapper
    const svgEl = container.querySelector('svg') || container.querySelector('.relative.flex.items-center.justify-center.shrink-0');

    // To make it a true raw SVG if it's currently a DIV structure (like our LogoPassagene is!), 
    // we should actually probably just let the user copy the CSS/DOM or draw a real SVG.
    // However, saving the DOM as a weird HTML fragment isn't an SVG.
    // So instead, we let them know it's a DOM element.
    const htmlString = el.innerHTML;
    const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <Header />

      {/* Dark Mode Toggle */}
      <div className="fixed top-20 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsDark(!isDark)}
          className="rounded-full shadow-md"
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <main className="container mx-auto p-6 space-y-12">
        {/* Título */}
        <div className="text-center py-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            PassaGene Style Guide
          </h1>
          <p className="text-muted-foreground">
            Design tokens e componentes do sistema
          </p>
        </div>

        {/* Logos */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Logos
          </h2>
          <div className="flex items-center gap-8 p-6 glass-panel rounded-2xl border border-border shadow-sm">
            <div className="text-center">
              <img src={logoSimples} alt="Logo Simples" className="h-16 mx-auto mb-2" loading="lazy" />
              <span className="text-sm text-muted-foreground">Simples (mobile)</span>
            </div>
            <div className="text-center">
              <img src={logoEscrito} alt="Logo Escrito" className="h-16 mx-auto mb-2" loading="lazy" />
              <span className="text-sm text-muted-foreground">Escrito (desktop)</span>
            </div>
          </div>
        </section>

        {/* Logo Vector Exporter */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Asset Factory (DOM Export)
          </h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-6">
                O novo LogoPassagene é construído dinamicamente via DOM/React (usando divs e CSS math) para animações perfeitas.
                Abaixo você pode ver o logo renderizado no seu estado perfeito. Para extrair código vetorizado real, copie o HTML interno ou
                verifique as referências de estilo.
              </p>
              <div className="flex gap-12">
                <div className="flex flex-col items-center gap-4">
                  <div id="export-logo-premium" className="p-4 rounded-xl bg-secondary border border-border flex items-center justify-center">
                    <LogoPassagene height={120} forceAnimate={false} showText={false} variant="premium" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadSVG('export-logo-premium', 'logo-dom.html')}>
                    <Download className="w-4 h-4 mr-2" /> Export HTML Node
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div id="export-logo-white" className="p-4 rounded-xl bg-primary border border-border flex items-center justify-center">
                    <LogoPassagene height={120} forceAnimate={false} showText={false} variant="white" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadSVG('export-logo-white', 'logo-white-dom.html')}>
                    <Download className="w-4 h-4 mr-2" /> Export HTML Node
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Paleta de Cores */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Paleta de Cores
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Primary */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-primary shadow-sm" />
              <p className="text-xs font-medium">Primary</p>
              <p className="text-xs text-muted-foreground">#2ECC71</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-primary-dark shadow-sm" />
              <p className="text-xs font-medium">Primary Dark</p>
              <p className="text-xs text-muted-foreground">#1E8449</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-primary-light shadow-sm" />
              <p className="text-xs font-medium">Primary Light</p>
              <p className="text-xs text-muted-foreground">#82E0AA</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-primary-subtle shadow-sm border border-border" />
              <p className="text-xs font-medium">Primary Subtle</p>
              <p className="text-xs text-muted-foreground">#D5F5E3</p>
            </div>
            {/* Accent */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-accent shadow-sm" />
              <p className="text-xs font-medium">Accent</p>
              <p className="text-xs text-muted-foreground">#27AE60</p>
            </div>
            {/* Destructive */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-destructive shadow-sm" />
              <p className="text-xs font-medium">Destructive</p>
              <p className="text-xs text-muted-foreground">#EF4444</p>
            </div>
            {/* Neutrals */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-background border border-border shadow-sm" />
              <p className="text-xs font-medium">Background</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg glass-panel border border-border shadow-sm" />
              <p className="text-xs font-medium">Card</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-muted shadow-sm" />
              <p className="text-xs font-medium">Muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-secondary shadow-sm" />
              <p className="text-xs font-medium">Secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-foreground shadow-sm" />
              <p className="text-xs font-medium">Foreground</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-border shadow-sm" />
              <p className="text-xs font-medium">Border</p>
            </div>
          </div>
        </section>

        {/* Tipografia */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Tipografia
          </h2>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-heading (Outfit)</p>
                <h1 className="font-heading text-4xl font-bold">Heading 1 - Passagene</h1>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-heading (Outfit)</p>
                <h2 className="font-heading text-3xl font-semibold">Heading 2 - Sistema FIV/TE</h2>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-heading (Outfit)</p>
                <h3 className="font-heading text-2xl font-medium">Heading 3 - Gestão de Fazendas</h3>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-sans (Manrope)</p>
                <p className="text-base">
                  Texto parágrafo - Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-sans text-sm</p>
                <p className="text-sm text-muted-foreground">
                  Texto secundário pequeno - Informações adicionais e descrições.
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">font-mono (JetBrains Mono)</p>
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  const fazenda = await getFazendaById(id);
                </code>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Buttons
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 mb-6">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="success">Success</Button>
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="icon-sm" aria-label="Confirmar"><Check className="h-4 w-4" /></Button>
                <Button size="icon" aria-label="Editar"><Edit className="h-4 w-4" /></Button>
                <Button size="icon-lg" aria-label="Remover"><Trash2 className="h-5 w-5" /></Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Card Simples</CardTitle>
                <CardDescription>Descrição do card com informações adicionais.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Conteúdo do card com texto e informações relevantes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card com Footer</CardTitle>
                <CardDescription>Card completo com ações.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Este card inclui botões de ação no footer.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">Cancelar</Button>
                <Button size="sm">Salvar</Button>
              </CardFooter>
            </Card>

            <Card className="bg-primary-subtle border-primary/20">
              <CardHeader>
                <CardTitle className="text-primary-subtle-foreground">Card Destaque</CardTitle>
                <CardDescription className="text-primary-subtle-foreground/70">
                  Card com fundo verde sutil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-primary-subtle-foreground/80">
                  Usado para destacar informações importantes.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inputs */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Inputs
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="input-default">Input Default</Label>
                  <Input id="input-default" placeholder="Digite algo..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-filled">Input Preenchido</Label>
                  <Input id="input-filled" defaultValue="Fazenda Boa Vista" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-disabled">Input Disabled</Label>
                  <Input id="input-disabled" disabled placeholder="Não editável" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-email">Email</Label>
                  <Input id="input-email" type="email" placeholder="email@exemplo.com" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Table
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fakeData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>{item.cidade}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Ativo'
                              ? 'bg-primary-subtle text-primary-dark'
                              : 'bg-muted text-muted-foreground'
                            }`}
                        >
                          {item.status === 'Ativo' ? (
                            <Check className="w-3 h-3 mr-1" />
                          ) : (
                            <X className="w-3 h-3 mr-1" />
                          )}
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Remover">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Shadows & Radius */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold border-b border-border pb-2">
            Shadows & Border Radius
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 glass-panel rounded-sm shadow-sm text-center">
              <p className="text-sm font-medium">rounded-sm</p>
              <p className="text-xs text-muted-foreground">shadow-sm</p>
            </div>
            <div className="p-6 glass-panel rounded-md shadow-md text-center">
              <p className="text-sm font-medium">rounded-md</p>
              <p className="text-xs text-muted-foreground">shadow-md</p>
            </div>
            <div className="p-6 glass-panel rounded-lg shadow-lg text-center">
              <p className="text-sm font-medium">rounded-lg</p>
              <p className="text-xs text-muted-foreground">shadow-lg</p>
            </div>
            <div className="p-6 glass-panel rounded-2xl shadow-xl text-center">
              <p className="text-sm font-medium">rounded-2xl</p>
              <p className="text-xs text-muted-foreground">shadow-xl</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 text-muted-foreground text-sm border-t border-border">
          PassaGene Style Guide &copy; {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
