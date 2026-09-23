/** Check server credentials without returning them to the browser. */
export interface TokenStatus {
  valid: boolean;
  expiresInSeconds: number;
  minutesLeft: number;
  error?: string;
}
export async function checkGoogleTokenValidity(_token?: string | null): Promise<TokenStatus> {
  try {
    const res = await fetch('/api/google/health');
    return { valid: res.ok, expiresInSeconds: 0, minutesLeft: 0,
      error: res.ok ? undefined : 'Falta configurar el acceso del servidor a Google' };
  } catch (error: any) {
    return { valid: false, expiresInSeconds: 0, minutesLeft: 0, error: error.message };
  }
}
