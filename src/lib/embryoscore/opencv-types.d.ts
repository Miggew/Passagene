/**
 * Declarações TypeScript mínimas para OpenCV.js (CDN)
 * APIs usadas para detecção de embriões (contornos + HoughCircles).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace cv {
  class Mat {
    constructor();
    constructor(rows: number, cols: number, type: number);
    rows: number;
    cols: number;
    data: Uint8Array;
    data32F: Float32Array;
    delete(): void;
    copyTo(dst: Mat): void;
    static zeros(rows: number, cols: number, type: number): Mat;
  }

  class MatVector {
    constructor();
    size(): number;
    get(index: number): Mat;
    delete(): void;
  }

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class CLAHE {
    constructor(clipLimit: number, tileGridSize: Size);
    apply(src: Mat, dst: Mat): void;
    delete(): void;
  }

  interface Moments {
    m00: number;
    m10: number;
    m01: number;
    m20: number;
    m11: number;
    m02: number;
  }

  // ── Image processing ──
  function imread(canvas: HTMLCanvasElement): Mat;
  function cvtColor(src: Mat, dst: Mat, code: number): void;
  function equalizeHist(src: Mat, dst: Mat): void;
  function GaussianBlur(
    src: Mat, dst: Mat, ksize: Size,
    sigmaX: number, sigmaY?: number, borderType?: number,
  ): void;
  function adaptiveThreshold(
    src: Mat, dst: Mat, maxValue: number,
    adaptiveMethod: number, thresholdType: number,
    blockSize: number, C: number,
  ): void;
  function threshold(
    src: Mat, dst: Mat, thresh: number, maxval: number, type: number,
  ): number;

  // ── Edge detection ──
  function Canny(
    image: Mat, edges: Mat,
    threshold1: number, threshold2: number,
    apertureSize?: number, L2gradient?: boolean,
  ): void;
  function dilate(
    src: Mat, dst: Mat, kernel: Mat,
    anchor?: Point, iterations?: number,
  ): void;

  // ── Morphology ──
  function getStructuringElement(shape: number, ksize: Size): Mat;
  function morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void;

  // ── Contours ──
  function findContours(
    image: Mat, contours: MatVector, hierarchy: Mat,
    mode: number, method: number,
  ): void;
  function contourArea(contour: Mat, oriented?: boolean): number;
  function arcLength(curve: Mat, closed: boolean): number;
  function moments(array: Mat, binaryImage?: boolean): Moments;

  // ── Circle detection ──
  function HoughCircles(
    image: Mat, circles: Mat, method: number,
    dp: number, minDist: number,
    param1?: number, param2?: number,
    minRadius?: number, maxRadius?: number,
  ): void;

  // ── Constants ──
  const COLOR_RGBA2GRAY: number;
  const HOUGH_GRADIENT: number;
  const CV_32F: number;

  // Threshold
  const ADAPTIVE_THRESH_GAUSSIAN_C: number;
  const ADAPTIVE_THRESH_MEAN_C: number;
  const THRESH_BINARY: number;
  const THRESH_BINARY_INV: number;
  const THRESH_OTSU: number;

  // Morphology
  const MORPH_ELLIPSE: number;
  const MORPH_RECT: number;
  const MORPH_CLOSE: number;
  const MORPH_OPEN: number;

  // Contours
  const RETR_EXTERNAL: number;
  const RETR_LIST: number;
  const CHAIN_APPROX_SIMPLE: number;
  const CHAIN_APPROX_NONE: number;
}

interface Window {
  cv: typeof cv;
  __opencvReady?: boolean;
}
