import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PASSWORD_HASH_VERSION = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${PASSWORD_HASH_VERSION}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [version, salt, storedKey] = passwordHash.split("$");

  if (version !== PASSWORD_HASH_VERSION || !salt || !storedKey) {
    return false;
  }

  const storedKeyBuffer = Buffer.from(storedKey, "base64url");
  const candidateKey = (await scryptAsync(password, salt, storedKeyBuffer.length)) as Buffer;

  if (candidateKey.length !== storedKeyBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateKey, storedKeyBuffer);
}
