function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  maxPdfUploadMb: readPositiveNumber(import.meta.env.VITE_MAX_PDF_UPLOAD_MB, 50),
}
