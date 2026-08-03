import crypto from "node:crypto";

import type { NotifyParams } from "./types";
import { LdcPaymentError } from "./errors";

export function canonicalizeSignParams(
  params: Record<string, string | undefined>
): string {
  return Object.entries(params)
    .filter(
      ([key, value]) =>
        value !== undefined &&
        value !== "" &&
        key !== "sign" &&
        key !== "sign_type"
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function generateEd25519Sign(
  params: Record<string, string | undefined>,
  secret: string,
  privateKeyPkcs8Base64: string
): string {
  let privateKey: crypto.KeyObject;
  try {
    privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyPkcs8Base64, "base64"),
      format: "der",
      type: "pkcs8",
    });
  } catch (error) {
    throw new LdcPaymentError("CONFIG", "LDC Ed25519 私钥格式无效", {
      cause: error,
    });
  }

  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new LdcPaymentError("CONFIG", "LDC Ed25519 私钥格式无效");
  }

  return crypto
    .sign(
      null,
      Buffer.from(canonicalizeSignParams(params) + secret, "utf8"),
      privateKey
    )
    .toString("base64");
}

export function generateSign(
  params: Record<string, string | undefined>,
  secret: string
): string {
  return crypto
    .createHash("md5")
    .update(canonicalizeSignParams(params) + secret)
    .digest("hex");
}

export function verifySign(params: NotifyParams, secret: string): boolean {
  const { sign, ...rest } = params;
  if (!/^[a-fA-F0-9]{32}$/.test(sign)) {
    return false;
  }

  const expectedSign = crypto
    .createHash("md5")
    .update(canonicalizeSignParams(rest) + secret)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(sign.toLowerCase(), "hex"),
    Buffer.from(expectedSign, "hex")
  );
}
