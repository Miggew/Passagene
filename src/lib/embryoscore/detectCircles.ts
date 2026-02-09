/**
 * Detecção de embriões bovinos em vídeo de estereomicroscópio usando OpenCV.js.
 *
 * Algoritmo: HoughCircles puro + expectedCount top-N.
 * Sem contour detection, sem multi-frame voting, sem clustering.
 *
 * Otimizado para:
 * - Nikon SMZ 645 (20x-40x) + OptiREC + Samsung Galaxy S23
 * - Embriões D0-D8 em meio de cultura (fundo claro, embriões escuros)
 */

/// <reference path="./opencv-types.d.ts" />

import type { DetectedBbox } from '@/lib/types';

export interface CircleDetectionResult {
  bboxes: DetectedBbox[];
  cropBlobs: Blob[];
  confidence: 'high' | 'medium' | 'low';
  frameWidth: number;
  frameHeight: number;
  totalCirclesFound: number;
  /** Canvas do frame central (50%) para uso em preview */
  frameCanvas: HTMLCanvasElement | null;
}

// ─── Helpers ────────────────────────────────────────────

const OPENCV_CDN_URL = 'https://docs.opencv.org/4.7.0/opencv.js';

/**
 * Carrega OpenCV.js sob demanda (lazy-load).
 * Injecta script tag se ainda não carregou.
 */
export function loadOpenCV(timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Já carregou?
    if (window.cv?.Mat && window.__opencvReady) {
      resolve();
      return;
    }

    // Verificar se já tem o script tag (pode estar carregando)
    const existing = document.querySelector(`script[src="${OPENCV_CDN_URL}"]`);
    if (!existing) {
      // Injetar script tag dinamicamente
      const script = document.createElement('script');
      script.src = OPENCV_CDN_URL;
      script.async = true;
      script.onload = () => { window.__opencvReady = true; };
      script.onerror = () => reject(new Error('OpenCV.js falhou ao carregar do CDN'));
      document.head.appendChild(script);
    }

    const start = Date.now();
    const check = () => {
      if (window.cv?.Mat && window.__opencvReady) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('OpenCV.js timeout — não carregou em ' + timeoutMs + 'ms'));
      } else {
        setTimeout(check, 250);
      }
    };
    check();
  });
}

/**
 * Extrai um frame de um arquivo de vídeo em uma posição relativa (0-1).
 * Retorna um canvas com o frame desenhado.
 */
export function extractFrame(file: File, position = 0.5): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('crossorigin', 'anonymous');

    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    const timeout = setTimeout(() => fail('Timeout ao extrair frame do vídeo'), 15_000);

    video.onloadedmetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = video.duration * Math.max(0.05, Math.min(0.95, position));
      } else {
        video.currentTime = 1;
      }
    };

    video.onseeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas 2D context indisponível'));
          return;
        }
        ctx.drawImage(video, 0, 0);
        cleanup();
        resolve(canvas);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => fail('Erro ao carregar vídeo para extração de frame');
    video.src = URL.createObjectURL(file);
  });
}

// ─── Crop extraction ────────────────────────────────────

const CROP_PADDING = 0.20;
const CROP_JPEG_QUALITY = 0.85;

/**
 * Extrai crops JPEG ao redor de cada bbox detectada.
 */
export function extractCropsFromFrame(
  canvas: HTMLCanvasElement,
  bboxes: DetectedBbox[],
): Blob[] {
  const fw = canvas.width;
  const fh = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || fw === 0 || fh === 0) return [];

  return bboxes.map(bbox => {
    const centerX = (bbox.x_percent / 100) * fw;
    const centerY = (bbox.y_percent / 100) * fh;
    const bboxW = (bbox.width_percent / 100) * fw;
    const bboxH = (bbox.height_percent / 100) * fh;

    const size = Math.max(bboxW, bboxH);
    const padded = size * (1 + CROP_PADDING * 2);

    let cropLeft = centerX - padded / 2;
    let cropTop = centerY - padded / 2;
    let cropRight = centerX + padded / 2;
    let cropBottom = centerY + padded / 2;

    if (cropLeft < 0) { cropRight -= cropLeft; cropLeft = 0; }
    if (cropTop < 0) { cropBottom -= cropTop; cropTop = 0; }
    if (cropRight > fw) { cropLeft -= (cropRight - fw); cropRight = fw; }
    if (cropBottom > fh) { cropTop -= (cropBottom - fh); cropBottom = fh; }
    cropLeft = Math.max(0, cropLeft);
    cropTop = Math.max(0, cropTop);
    cropRight = Math.min(fw, cropRight);
    cropBottom = Math.min(fh, cropBottom);

    const cropW = cropRight - cropLeft;
    const cropH = cropBottom - cropTop;

    const cropCanvas = document.createElement('canvas');
    const outputSize = Math.min(400, Math.max(cropW, cropH));
    cropCanvas.width = outputSize;
    cropCanvas.height = outputSize;

    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return new Blob([], { type: 'image/jpeg' });

    cropCtx.drawImage(canvas, cropLeft, cropTop, cropW, cropH, 0, 0, outputSize, outputSize);

    const dataUrl = cropCanvas.toDataURL('image/jpeg', CROP_JPEG_QUALITY);
    const byteStr = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);

    cropCanvas.remove();
    return new Blob([bytes], { type: 'image/jpeg' });
  });
}

// ─── Detection ──────────────────────────────────────────

interface RawCircle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Detecta embriões via HoughCircles em um frame.
 */
function runHoughCircles(
  cvLib: typeof window.cv,
  gray: InstanceType<typeof window.cv.Mat>,
  minDim: number,
  param2: number,
): RawCircle[] {
  const result: RawCircle[] = [];
  const circles = new cvLib.Mat();

  try {
    const minRadius = Math.round(minDim * 0.04);
    const maxRadius = Math.round(minDim * 0.25);
    const minDist = Math.round(minDim * 0.10);

    // GaussianBlur — reduz ruído, preserva bordas circulares
    const blurred = new cvLib.Mat();
    cvLib.GaussianBlur(gray, blurred, new cvLib.Size(5, 5), 1.5);

    cvLib.HoughCircles(
      blurred, circles, cvLib.HOUGH_GRADIENT,
      1.5,       // dp — accumulator mais grosso = menos ruído
      minDist,   // embriões não ficam tão próximos
      100,       // param1 — Canny high threshold
      param2,    // sensibilidade (35 = normal, 25 = mais sensível)
      minRadius,
      maxRadius,
    );

    for (let i = 0; i < circles.cols; i++) {
      result.push({
        x: circles.data32F[i * 3],
        y: circles.data32F[i * 3 + 1],
        radius: circles.data32F[i * 3 + 2],
      });
    }

    blurred.delete();
    console.log(`[EmbryoDetect:Hough] ${result.length} detectados (param2=${param2}, r=${minRadius}-${maxRadius}px, minDist=${minDist}px)`);
  } catch (err) {
    console.warn('[EmbryoDetect:Hough] Falha:', err);
  } finally {
    circles.delete();
  }

  return result;
}

/**
 * Seleciona os `count` círculos com raios mais uniformes entre si.
 *
 * Embriões reais na mesma placa têm tamanhos similares.
 * Artefatos (borda do poço, bolhas, debris) têm raios muito diferentes.
 *
 * Usa sliding window no array ordenado por raio para encontrar
 * o grupo com menor spread (max - min).
 */
function selectByRadiusCluster(circles: RawCircle[], count: number): RawCircle[] {
  if (circles.length <= count) return circles;

  // Ordenar por raio ASC
  const sorted = [...circles].sort((a, b) => a.radius - b.radius);

  let bestStart = 0;
  let bestSpread = Infinity;

  for (let i = 0; i <= sorted.length - count; i++) {
    const spread = sorted[i + count - 1].radius - sorted[i].radius;
    if (spread < bestSpread) {
      bestSpread = spread;
      bestStart = i;
    }
  }

  const selected = sorted.slice(bestStart, bestStart + count);
  const minR = selected[0].radius;
  const maxR = selected[selected.length - 1].radius;
  console.log(
    `[EmbryoDetect:Cluster] Melhor cluster de ${count}: ` +
    `raio ${minR.toFixed(0)}-${maxR.toFixed(0)}px (spread ${bestSpread.toFixed(0)}px), ` +
    `descartados ${circles.length - count} outliers`
  );

  return selected;
}

// ─── Detecção principal ─────────────────────────────────

/**
 * Detecta embriões em um vídeo usando HoughCircles puro.
 *
 * Pipeline:
 * 1. Extrair 1 frame (50% do vídeo)
 * 2. Grayscale → GaussianBlur → HoughCircles
 * 3. Filtro de borda (4% margem)
 * 4. Top-N por raio DESC (se expectedCount fornecido)
 * 5. Segunda passada mais sensível se encontrou menos que esperado
 */
export async function detectEmbryoCircles(
  file: File,
  maxCircles = 20,
  expectedCount?: number,
): Promise<CircleDetectionResult> {
  await loadOpenCV();

  // 1. Extrair 1 frame no meio do vídeo
  const frameCanvas = await extractFrame(file, 0.5);
  const frameWidth = frameCanvas.width;
  const frameHeight = frameCanvas.height;
  const minDim = Math.min(frameWidth, frameHeight);

  console.log(`[EmbryoDetect] Frame extraído: ${frameWidth}×${frameHeight}`);

  // 2. Grayscale
  const cvLib = window.cv;
  const src = cvLib.imread(frameCanvas);
  const gray = new cvLib.Mat();
  cvLib.cvtColor(src, gray, cvLib.COLOR_RGBA2GRAY);

  // 3. HoughCircles — primeira passada (param2=35, sweet spot)
  let detected = runHoughCircles(cvLib, gray, minDim, 35);

  // 4. Filtro de borda — remover detecções muito perto da borda do frame
  const edgeMargin = minDim * 0.04;
  detected = detected.filter(c =>
    c.x > edgeMargin && c.x < (frameWidth - edgeMargin) &&
    c.y > edgeMargin && c.y < (frameHeight - edgeMargin),
  );

  console.log(`[EmbryoDetect] Após filtro de borda: ${detected.length}`);

  // 5. Se encontrou menos que esperado, segunda passada mais sensível
  if (expectedCount && expectedCount > 0 && detected.length < expectedCount) {
    console.log(`[EmbryoDetect] ${detected.length} < esperado (${expectedCount}), tentando param2=25`);
    let sensitiveDetected = runHoughCircles(cvLib, gray, minDim, 25);

    // Filtro de borda na segunda passada também
    sensitiveDetected = sensitiveDetected.filter(c =>
      c.x > edgeMargin && c.x < (frameWidth - edgeMargin) &&
      c.y > edgeMargin && c.y < (frameHeight - edgeMargin),
    );

    // Usar a segunda passada se encontrou mais (e mais próximo do esperado)
    if (sensitiveDetected.length > detected.length) {
      console.log(`[EmbryoDetect] Segunda passada: ${sensitiveDetected.length} (melhor que ${detected.length})`);
      detected = sensitiveDetected;
    }
  }

  const totalCirclesFound = detected.length;

  // 6. Selecionar embriões por clustering de raio (raios mais uniformes = embriões reais)
  const limit = expectedCount && expectedCount > 0
    ? Math.min(maxCircles, expectedCount)
    : maxCircles;
  const selected = detected.length > limit
    ? selectByRadiusCluster(detected, limit)
    : detected;

  // Cleanup OpenCV mats
  gray.delete();
  src.delete();

  // 7. Converter para bboxes percentuais
  const bboxes: DetectedBbox[] = selected.map(c => {
    const diameter = c.radius * 2;
    return {
      x_percent: (c.x / frameWidth) * 100,
      y_percent: (c.y / frameHeight) * 100,
      width_percent: (diameter / frameWidth) * 100,
      height_percent: (diameter / frameHeight) * 100,
      radius_px: c.radius,
    };
  });

  // 8. Confiança baseada em contagem vs esperado
  let confidence: 'high' | 'medium' | 'low';
  if (bboxes.length === 0) {
    confidence = 'low';
  } else if (expectedCount && bboxes.length === expectedCount) {
    confidence = 'high';
  } else if (expectedCount && bboxes.length < expectedCount) {
    confidence = 'low';
  } else {
    confidence = 'medium';
  }

  // 9. Extrair crops
  const cropBlobs = bboxes.length > 0
    ? extractCropsFromFrame(frameCanvas, bboxes)
    : [];

  console.log(`[EmbryoDetect] Resultado final: ${bboxes.length} embriões (confiança: ${confidence})`);

  return {
    bboxes,
    cropBlobs,
    confidence,
    frameWidth,
    frameHeight,
    totalCirclesFound,
    frameCanvas,
  };
}

/**
 * Verifica se o OpenCV.js está disponível (não-bloqueante).
 */
export function isOpenCVAvailable(): boolean {
  return !!(window.cv?.Mat && window.__opencvReady);
}
