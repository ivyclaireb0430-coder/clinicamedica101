import { authenticator } from "otplib";

authenticator.options = { window: 1 }; // accept ±30s clock drift

export function newTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "Clinica Medica 101", secret);
}

export function verifyTotp(code: string, secret: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return authenticator.check(clean, secret);
}
