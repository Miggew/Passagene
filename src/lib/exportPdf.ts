/**
 * Utilitário de Exportação PDF
 *
 * Usa jspdf + jspdf-autotable para gerar PDFs com tabelas formatadas
 * seguindo o design system do PassaGene
 */

import jsPDF from 'jspdf';
import autoTable, { RowInput, CellDef } from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Cores do design system PassaGene
const COLORS = {
  primary: [46, 204, 113] as [number, number, number],      // #2ECC71
  primaryDark: [30, 132, 73] as [number, number, number],   // #1E8449
  text: [74, 85, 104] as [number, number, number],          // #4A5568
  muted: [160, 174, 192] as [number, number, number],       // #A0AEC0
  border: [226, 232, 240] as [number, number, number],      // #E2E8F0
  white: [255, 255, 255] as [number, number, number],
  headerBg: [247, 250, 252] as [number, number, number],    // #F7FAFC
};

export interface PdfColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  data: Record<string, unknown>[];
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  footer?: string;
  metadata?: {
    fazenda?: string;
    periodo?: string;
    geradoPor?: string;
  };
}

/**
 * Formata valor para exibição no PDF
 */
function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return '—';

  // Detectar datas pelo nome da coluna
  if (typeof value === 'string' && key.includes('data')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
    } catch {
      // Se falhar, retorna o valor original
    }
  }

  // Números
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }

  // Status - traduzir alguns comuns
  if (key === 'status' && typeof value === 'string') {
    const statusMap: Record<string, string> = {
      'PASSO1_FECHADO': 'Aguardando 2º Passo',
      'SINCRONIZADO': 'Sincronizado',
      'FECHADO': 'Fechado',
      'EM_TE': 'Em TE',
      'PRENHE': 'Prenhe',
      'VAZIA': 'Vazia',
      'RETOQUE': 'Retoque',
      'FEMEA': 'Fêmea',
      'MACHO': 'Macho',
      'CONGELADO': 'Congelado',
      'FRESCO': 'Fresco',
    };
    return statusMap[value] || value;
  }

  return String(value);
}

/**
 * Adiciona cabeçalho do PDF com logo e informações
 */
function addHeader(doc: jsPDF, options: PdfExportOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Título principal
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.primaryDark);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Subtítulo
  if (options.subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(options.subtitle, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // Metadata (fazenda, período, etc)
  if (options.metadata) {
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);

    const metaItems: string[] = [];
    if (options.metadata.fazenda) metaItems.push(`Fazenda: ${options.metadata.fazenda}`);
    if (options.metadata.periodo) metaItems.push(`Período: ${options.metadata.periodo}`);

    if (metaItems.length > 0) {
      doc.text(metaItems.join('  |  '), pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
  }

  // Linha separadora
  y += 3;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);

  return y + 8;
}

/**
 * Adiciona rodapé com data de geração e paginação
 */
function addFooter(doc: jsPDF, options: PdfExportOptions): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Linha separadora
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

    // Data de geração
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    doc.text(`Gerado em ${dataGeracao}`, 15, pageHeight - 8);

    // Paginação
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 15, pageHeight - 8, { align: 'right' });

    // Footer customizado
    if (options.footer) {
      doc.text(options.footer, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
  }
}

/**
 * Exporta dados para PDF
 */
export function exportToPdf(options: PdfExportOptions): void {
  const { columns, data, orientation = 'portrait' } = options;

  // Criar documento
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Adicionar cabeçalho
  const startY = addHeader(doc, options);

  // Preparar dados da tabela
  const headers = columns.map(col => col.header);
  const body: RowInput[] = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      return formatValue(value, col.key);
    });
  });

  // Calcular larguras das colunas
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - 30; // margens de 15mm cada lado

  const columnStyles: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> = {};
  columns.forEach((col, index) => {
    columnStyles[index] = {
      halign: col.align || 'left',
      cellWidth: col.width ? (col.width / 100) * tableWidth : 'auto',
    };
  });

  // Gerar tabela
  autoTable(doc, {
    head: [headers],
    body,
    startY,
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.primaryDark,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    columnStyles,
    didDrawPage: () => {
      // Hook para adicionar elementos em cada página se necessário
    },
  });

  // Adicionar rodapé
  addFooter(doc, options);

  // Gerar nome do arquivo
  const fileName = options.fileName ||
    `${options.title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  // Download
  doc.save(fileName);
}

/**
 * Configurações pré-definidas para cada tipo de relatório
 */
export const pdfConfigs = {
  protocolos: {
    title: 'Relatório de Protocolos',
    columns: [
      { header: 'Fazenda', key: 'fazenda_nome', width: 25 },
      { header: 'Data Início', key: 'data_inicio', width: 12, align: 'center' as const },
      { header: 'Veterinário', key: 'veterinario_responsavel', width: 20 },
      { header: '2º Passo', key: 'passo2_data', width: 12, align: 'center' as const },
      { header: 'Receptoras', key: 'total_receptoras', width: 10, align: 'center' as const },
      { header: 'Status', key: 'status', width: 15, align: 'center' as const },
    ],
  },

  aspiracoes: {
    title: 'Relatório de Aspirações',
    columns: [
      { header: 'Fazenda', key: 'fazenda_nome', width: 25 },
      { header: 'Data', key: 'data_aspiracao', width: 12, align: 'center' as const },
      { header: 'Veterinário', key: 'veterinario_responsavel', width: 20 },
      { header: 'Doadoras', key: 'total_doadoras', width: 10, align: 'center' as const },
      { header: 'Oócitos', key: 'total_oocitos', width: 10, align: 'center' as const },
    ],
  },

  te: {
    title: 'Relatório de Transferências de Embriões',
    columns: [
      { header: 'Fazenda', key: 'fazenda_nome', width: 25 },
      { header: 'Data TE', key: 'data', width: 12, align: 'center' as const },
      { header: 'Veterinário', key: 'veterinario_responsavel', width: 20 },
      { header: 'Receptoras', key: 'total_registros', width: 12, align: 'center' as const },
    ],
  },

  dg: {
    title: 'Relatório de Diagnósticos de Gestação',
    columns: [
      { header: 'Fazenda', key: 'fazenda_nome', width: 22 },
      { header: 'Data DG', key: 'data', width: 12, align: 'center' as const },
      { header: 'Veterinário', key: 'veterinario_responsavel', width: 18 },
      { header: 'Recept.', key: 'total_registros', width: 10, align: 'center' as const },
      { header: 'Prenhes', key: 'prenhes', width: 10, align: 'center' as const },
      { header: 'Taxa', key: 'taxa_prenhez', width: 10, align: 'center' as const },
    ],
  },

  sexagem: {
    title: 'Relatório de Sexagem Fetal',
    columns: [
      { header: 'Fazenda', key: 'fazenda_nome', width: 22 },
      { header: 'Data', key: 'data', width: 12, align: 'center' as const },
      { header: 'Veterinário', key: 'veterinario_responsavel', width: 18 },
      { header: 'Total', key: 'total_registros', width: 10, align: 'center' as const },
      { header: 'Fêmeas', key: 'femeas', width: 10, align: 'center' as const },
      { header: 'Machos', key: 'machos', width: 10, align: 'center' as const },
    ],
  },

  receptoras: {
    title: 'Relatório de Receptoras',
    columns: [
      { header: 'Identificação', key: 'identificacao', width: 18 },
      { header: 'Nome', key: 'nome', width: 18 },
      { header: 'Fazenda', key: 'fazenda_nome', width: 20 },
      { header: 'Status', key: 'status_reprodutivo', width: 15, align: 'center' as const },
      { header: 'Data Parto', key: 'data_provavel_parto', width: 12, align: 'center' as const },
    ],
  },

  doadoras: {
    title: 'Relatório de Doadoras',
    columns: [
      { header: 'Identificação', key: 'identificacao', width: 18 },
      { header: 'Nome', key: 'nome', width: 18 },
      { header: 'Fazenda', key: 'fazenda_nome', width: 20 },
      { header: 'Raça', key: 'raca', width: 15 },
      { header: 'Registro', key: 'registro', width: 15 },
    ],
  },

  embrioes: {
    title: 'Relatório de Embriões Congelados',
    columns: [
      { header: 'Cliente', key: 'cliente_nome', width: 20 },
      { header: 'Classificação', key: 'classificacao', width: 15, align: 'center' as const },
      { header: 'Tipo', key: 'tipo_embriao', width: 12, align: 'center' as const },
      { header: 'Doadora', key: 'doadora_nome', width: 18 },
      { header: 'Touro', key: 'touro_nome', width: 18 },
      { header: 'Data Cong.', key: 'data_congelamento', width: 12, align: 'center' as const },
    ],
  },

  dosesSemen: {
    title: 'Relatório de Doses de Sêmen',
    columns: [
      { header: 'Cliente', key: 'cliente_nome', width: 22 },
      { header: 'Touro', key: 'touro_nome', width: 22 },
      { header: 'Partida', key: 'partida', width: 15 },
      { header: 'Quantidade', key: 'quantidade', width: 12, align: 'center' as const },
      { header: 'Disponível', key: 'quantidade_disponivel', width: 12, align: 'center' as const },
    ],
  },

  lotesFiv: {
    title: 'Relatório de Lotes FIV',
    columns: [
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Fazenda', key: 'fazenda_nome', width: 25 },
      { header: 'Data FIV', key: 'data_fiv', width: 12, align: 'center' as const },
      { header: 'Oócitos', key: 'total_oocitos', width: 10, align: 'center' as const },
      { header: 'Embriões', key: 'total_embrioes', width: 10, align: 'center' as const },
      { header: 'Taxa %', key: 'taxa_sucesso', width: 10, align: 'center' as const },
      { header: 'Status', key: 'status', width: 15, align: 'center' as const },
    ],
  },
};

/**
 * Função helper para exportar com configuração pré-definida
 */
export function exportRelatorio(
  tipo: keyof typeof pdfConfigs,
  data: Record<string, unknown>[],
  metadata?: PdfExportOptions['metadata']
): void {
  const config = pdfConfigs[tipo];

  exportToPdf({
    ...config,
    data,
    metadata,
    orientation: data.length > 20 || config.columns.length > 5 ? 'landscape' : 'portrait',
  });
}
