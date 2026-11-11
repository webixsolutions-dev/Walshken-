import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const dummySalt = Buffer.from("f9a6d1632d6ddcb3c13f6b75ba49b1ee", "hex");

export async function passwordHash(password: string, salt = randomBytes(16)) {
  const hash = await new Promise<Buffer>((resolve,reject) => scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:67108864},(error,key)=>error?reject(error):resolve(key)));
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
export async function passwordMatches(password: string, stored?: string) {
  const salt = stored?.split(":")[0];
  const computed = await passwordHash(password, salt ? Buffer.from(salt, "hex") : dummySalt);
  if (!stored) return false;
  const a = Buffer.from(computed);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
