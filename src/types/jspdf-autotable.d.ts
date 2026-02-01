import { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

interface AutoTableOptions {
  head?: CellDef[][];
  body?: RowInput[];
  foot?: CellDef[][];
  startY?: number;
  margin?: MarginPadding;
  pageBreak?: 'auto' | 'avoid' | 'always';
  rowPageBreak?: 'auto' | 'avoid';
  tableWidth?: 'auto' | 'wrap' | number;
  showHead?: 'everyPage' | 'firstPage' | 'never';
  showFoot?: 'everyPage' | 'lastPage' | 'never';
  tableLineWidth?: number;
  tableLineColor?: Color;
  styles?: Styles;
  headStyles?: Styles;
  bodyStyles?: Styles;
  footStyles?: Styles;
  alternateRowStyles?: Styles;
  columnStyles?: { [key: number]: Styles };
  didParseCell?: (data: CellHookData) => void;
  willDrawCell?: (data: CellHookData) => void;
  didDrawCell?: (data: CellHookData) => void;
  didDrawPage?: (data: HookData) => void;
}

type RowInput = CellDef[] | { [key: string]: CellDef };
type CellDef = string | number | boolean | null | undefined | CellInput;
type Color = [number, number, number] | number | string | false;

interface CellInput {
  content?: string | number;
  rowSpan?: number;
  colSpan?: number;
  styles?: Styles;
}

interface Styles {
  font?: 'helvetica' | 'times' | 'courier';
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  fontSize?: number;
  cellPadding?: number | MarginPadding;
  lineColor?: Color;
  lineWidth?: number | MarginPadding;
  fillColor?: Color;
  textColor?: Color;
  halign?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  cellWidth?: number | 'auto' | 'wrap';
  minCellHeight?: number;
  minCellWidth?: number;
  overflow?: 'linebreak' | 'ellipsize' | 'visible' | 'hidden';
}

interface MarginPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface CellHookData {
  cell: Cell;
  row: Row;
  column: Column;
  section: 'head' | 'body' | 'foot';
}

interface HookData {
  pageNumber: number;
  pageCount: number;
  settings: object;
  doc: jsPDF;
  cursor: { x: number; y: number };
}

interface Cell {
  raw: CellDef;
  text: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Styles;
}

interface Row {
  raw: RowInput;
  index: number;
  cells: { [key: string]: Cell };
  height: number;
}

interface Column {
  index: number;
  dataKey: string | number;
  width: number;
}

export { RowInput, CellDef };
