/**
 * Cloud Run OCR utilities.
 *
 * compressImage  — resize via canvas before encoding (5MB -> ~400KB)
 * fileToBase64   — convert compressed File to raw base64 string
 * fetchWithRetry — exponential backoff for Cloud Run cold start 503s
 */

const PIPELINE_URL =
  import.meta.env.VITE_PIPELINE_URL ||
  'https://embryoscore-pipeline-63493118456.us-central1.run.app';

// ─── Image compression via canvas ────────────────────────

export async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;

      // Downscale if needed
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(blob);
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ─── File to base64 ──────────────────────────────────────

export function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/jpeg;base64,..."
      const base64 = result.split(',')[1];
      if (!base64) return reject(new Error('Base64 conversion failed'));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

// ─── Fetch with retry (Cloud Run cold start) ─────────────

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      // Only retry on 503 (cold start)
      if (resp.status === 503 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return resp;
    } catch (err) {
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  // Should not reach here, but TypeScript needs it
  throw new Error('fetchWithRetry exhausted all retries');
}

// ─── Background storage upload (audit trail) ────────────

import { supabase } from '@/lib/supabase';

/**
 * Upload the original report image to Storage in the background.
 * Non-blocking: call without await after save succeeds.
 * Updates the report_imports row with the image_path.
 */
export function uploadReportImageBackground(
  file: File,
  fazendaId: string,
  importId?: string,
): void {
  const run = async () => {
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${fazendaId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('report-images')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error('[uploadReportImage] Upload failed:', uploadError.message);
        return;
      }

      // Link to report_imports for audit
      if (importId) {
        await supabase
          .from('report_imports')
          .update({ image_path: path })
          .eq('id', importId);
      }
    } catch (err) {
      console.error('[uploadReportImage] Background upload failed:', err);
    }
  };
  // Fire and forget
  run();
}

export { PIPELINE_URL };
