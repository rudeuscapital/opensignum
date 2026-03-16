import { SiweMessage } from 'siwe';
import crypto from 'node:crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const SESSION_SECRET = process.env.SESSION_SECRET || import.meta.env.SESSION_SECRET || 'signum-copilot-dev-secret-change-in-prod';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// In-memory nonce store (replace with Redis/DB in production)
const nonceStore = new Map<string, { nonce: string; createdAt: number }>();

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function storeNonce(address: string, nonce: string) {
  nonceStore.set(address.toLowerCase(), { nonce, createdAt: Date.now() });
}

export function consumeNonce(address: string): string | null {
  const key = address.toLowerCase();
  const entry = nonceStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    nonceStore.delete(key);
    return null;
  }
  nonceStore.delete(key);
  return entry.nonce;
}

export type Chain = 'evm' | 'solana';

export interface SessionData {
  address: string;
  chain: Chain;
  chainId: number;
  issuedAt: string;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

export function createSessionCookie(data: SessionData): string {
  const payload = JSON.stringify(data);
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = sign(encoded);
  const value = `${encoded}.${signature}`;

  return [
    `session=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${SESSION_MAX_AGE}`,
  ].join('; ');
}

export function parseSession(cookieHeader: string | null): SessionData | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='));
  if (!match) return null;

  const value = match.slice('session='.length);
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (signature !== expected) return null;

  try {
    const payload = Buffer.from(encoded, 'base64url').toString();
    return JSON.parse(payload) as SessionData;
  } catch {
    return null;
  }
}

export function clearSessionCookie(): string {
  return 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

// ── EVM (Ethereum) verification via SIWE ────────────────────────────────────
export async function verifySiweMessage(
  message: string,
  signature: string,
): Promise<SessionData> {
  const siweMessage = new SiweMessage(message);
  const result = await siweMessage.verify({ signature });

  if (!result.success) {
    throw new Error('Invalid SIWE signature');
  }

  return {
    address: result.data.address,
    chain: 'evm',
    chainId: result.data.chainId,
    issuedAt: result.data.issuedAt || new Date().toISOString(),
  };
}

// ── Solana verification via ed25519 ─────────────────────────────────────────
export function verifySolanaSignature(
  message: string,
  signatureBase64: string,
  address: string,
): SessionData {
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = Buffer.from(signatureBase64, 'base64');
  const publicKeyBytes = bs58.decode(address);

  const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

  if (!valid) {
    throw new Error('Invalid Solana signature');
  }

  return {
    address,
    chain: 'solana',
    chainId: 0, // Solana mainnet (no EIP-155 chainId)
    issuedAt: new Date().toISOString(),
  };
}
