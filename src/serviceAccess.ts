/** Server owns Google API credentials. The browser never receives a Google token. */
export function getStoredAccessToken(): string { return 'server-managed'; }
export async function getAccessToken(): Promise<string> { return 'server-managed'; }
export function saveAccessToken(_token: string): void {}
export function clearAccessToken(): void {}
export const auth = { currentUser: { displayName: 'Operador' } };
export async function googleSignIn(): Promise<{ accessToken: string }> { return { accessToken: 'server-managed' }; }
