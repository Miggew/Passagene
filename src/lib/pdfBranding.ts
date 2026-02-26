/**
 * Helpers para branding de PDFs
 * Carrega imagens (avatar do cliente, logo PassaGene) como base64
 */

export interface PdfBranding {
  clientLogoBase64?: string | null;
  clientName?: string;
  appLogoBase64?: string | null;
}

/** Converte uma URL de imagem em data-URL base64 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

let _appLogoCache: string | null | undefined;

/** Carrega /pwa-192x192.png como base64 (cacheia em memória) */
export async function loadPassaGeneLogo(): Promise<string | null> {
  if (_appLogoCache !== undefined) return _appLogoCache;
  _appLogoCache = await fetchImageAsBase64('/pwa-192x192.png');
  return _appLogoCache;
}

/** Monta o objeto de branding a partir do perfil + signed URL do avatar */
export async function preparePdfBranding(
  profile: { nome?: string; avatar_url?: string } | null,
  avatarSignedUrl: string | null | undefined,
): Promise<PdfBranding> {
  const [clientLogoBase64, appLogoBase64] = await Promise.all([
    avatarSignedUrl ? fetchImageAsBase64(avatarSignedUrl) : Promise.resolve(null),
    loadPassaGeneLogo(),
  ]);

  return {
    clientLogoBase64,
    clientName: profile?.nome || undefined,
    appLogoBase64,
  };
}
