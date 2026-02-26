/**
 * Fonte única de verdade para navegação — ícones, labels e rotas rápidas.
 * Importado por MobileNav, HubTabs e ProfilePage.
 */

import {
  Home,
  Syringe,
  TestTube,
  ArrowRightLeft,
  ThumbsUp,
  Sparkles,
  Shield,
  Snowflake,
  FileBarChart,
  FileText,
  ClipboardList,
  TrendingUp,
  FlaskConical,
  History,
  Microscope,
  Dna,
  Beef,
  Container,
  Building2,
  Settings,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { CowIcon } from '@/components/icons/CowIcon';
import type { Hub } from '@/lib/types';

// ─── Ícones dos Hubs ───────────────────────────────────────────────
export const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  laboratorio: FlaskConical,
  relatorios: FileBarChart,
  genetica: Dna,
  campo: CowIcon,
};

// ─── Ícones por Rota ───────────────────────────────────────────────
export const routeIcons: Record<string, React.ElementType> = {
  '/': Home,
  '/campo': CowIcon,
  '/administrativo': Shield,
  '/doadoras': DonorCowIcon,
  '/touros': Sparkles,
  '/lotes-fiv': TestTube,
  '/embrioes': EmbryoIcon,
  '/embrioes-congelados': Snowflake,
  '/doses-semen': SpermIcon,
  '/protocolos': Syringe,
  '/genia': Sparkles,
  '/ai-chat': Sparkles,
  '/aspiracoes': TestTube,
  '/transferencia': ArrowRightLeft,
  '/dg': ThumbsUp,
  '/sexagem': GenderIcon,
  '/historico': History,

  // Hub Relatórios
  '/relatorios': FileBarChart,
  '/relatorios/servicos': ClipboardList,
  '/relatorios/animais': DonorCowIcon,
  '/relatorios/material': EmbryoIcon,
  '/relatorios/producao': TrendingUp,
  // Hub Laboratório
  '/laboratorio': FlaskConical,
  '/bancada': Microscope,
  // Hub Genética
  '/genetica': Dna,
  '/genetica/doadoras': DonorCowIcon,
  '/genetica/touros': Sparkles,
  // Escritório (legacy — redirects only, kept for backward compat)
  '/escritorio': FileText,
  // Rotas do cliente
  '/cliente/mercado': Dna,
  '/cliente/rebanho': Beef,
  '/cliente/relatorios': FileBarChart,
  '/cliente/botijao': Container,
  '/cliente/configuracoes': Settings,
};

// ─── Labels Curtos (mobile bottom bar / menu) ──────────────────────
export const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/campo': 'Campo',
  '/administrativo': 'Admin',
  '/doadoras': 'Minhas Doadoras',
  '/touros': 'Touros',
  '/lotes-fiv': 'Lotes FIV',
  '/embrioes': 'Embriões',
  '/embrioes-congelados': 'Congelados',
  '/doses-semen': 'Doses',
  '/protocolos': 'Protocolos',
  '/aspiracoes': 'Aspirações',
  '/transferencia': 'TE',
  '/dg': 'DG',
  '/sexagem': 'Sexagem',
  '/historico': 'Histórico',

  '/relatorios': 'Relatórios',
  '/relatorios/servicos': 'Serviços',
  '/relatorios/animais': 'Animais',
  '/relatorios/material': 'Material',
  '/relatorios/producao': 'Produção',
  '/laboratorio': 'Laboratório',
  '/bancada': 'Bancada',
  '/genetica': 'Genética',
  '/genetica/doadoras': 'Doadoras',
  '/genetica/touros': 'Touros',
  '/escritorio': 'Escritório',
  '/genia': 'Gen.IA',
  '/cliente/mercado': 'Genética',
  '/cliente/rebanho': 'Rebanho',
  '/cliente/relatorios': 'Relatórios',
  '/cliente/botijao': 'Botijão',
  '/cliente/configuracoes': 'Configurações',
};

// ─── Rotas Home por Hub ───────────────────────────────────────────
export const HUB_HOME_ROUTES: Record<string, string> = {
  campo: '/campo',
  laboratorio: '/laboratorio',
  relatorios: '/relatorios',
  genetica: '/genetica',
  administrativo: '/administrativo',
};

// ─── Rotas Rápidas por Hub (bottom bar mobile) ────────────────────
export const HUB_QUICK_ROUTES: Record<string, string[]> = {
  administrativo: ['/protocolos', '/transferencia', '/dg'],
  laboratorio: ['/lotes-fiv', '/embrioes', '/bancada'],
  campo: ['/dg', '/sexagem', '/transferencia', '/protocolos', '/aspiracoes'],
  relatorios: ['/relatorios/servicos', '/relatorios/animais', '/relatorios/producao'],
  genetica: ['/doadoras', '/genetica/doadoras', '/genetica/touros'],
};

// ─── Detecção de Hub por URL ──────────────────────────────────────
export function getBottomBarHubCode(pathname: string, fallbackHub: Hub | null): string | null {
  if (pathname === '/genia' || pathname === '/ai-chat') return fallbackHub?.code ?? 'campo'; // IA herda o hub atual
  if (pathname === '/campo') return 'campo';
  if (['/transferencia', '/dg', '/sexagem', '/protocolos', '/aspiracoes'].some(route => pathname.startsWith(route))) return 'campo';
  if (pathname.startsWith('/historico')) return 'campo';
  if (pathname.startsWith('/escritorio')) return 'campo'; // legacy redirects
  if (pathname.startsWith('/relatorios')) return 'relatorios';
  if (pathname.startsWith('/doadoras')) return 'genetica';
  if (pathname.startsWith('/genetica')) return 'genetica';
  if (pathname.startsWith('/cliente')) return 'cliente';
  // Rotas do Lab
  if (pathname === '/bancada' || pathname.startsWith('/bancada/')) return 'laboratorio';
  if (pathname === '/embryoscore' || pathname.startsWith('/embryoscore/')) return 'laboratorio';
  if (pathname === '/laboratorio') return 'laboratorio';
  if (pathname === '/lotes-fiv' || pathname.startsWith('/lotes-fiv/')) return 'laboratorio';
  if (pathname === '/embrioes' || pathname.startsWith('/embrioes')) return 'laboratorio';
  // Home → null (modo hubs)
  if (pathname === '/') return null;
  // Default: use hub do DB ou administrativo
  return fallbackHub?.code ?? 'administrativo';
}
