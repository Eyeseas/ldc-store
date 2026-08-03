import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });
const publicKeyDer = publicKey.export({ format: "der", type: "spki" });

// Ed25519 SPKI DER 的最后 32 字节是 Linux DO Credit 控制台要求的原始公钥。
const rawPublicKey = publicKeyDer.subarray(publicKeyDer.length - 32);
if (rawPublicKey.length !== 32) {
  throw new Error("无法导出 32 字节 Ed25519 公钥");
}

console.log(`LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64=${privateKeyDer.toString("base64")}`);
console.log(`LDC_ED25519_PUBLIC_KEY_BASE64=${rawPublicKey.toString("base64")}`);
