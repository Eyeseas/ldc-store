export type LdcPaymentErrorCode =
  | "CONFIG"
  | "INVALID_INPUT"
  | "TIMEOUT"
  | "BLOCKED"
  | "INVALID_RESPONSE"
  | "PLATFORM_REJECTED";

export class LdcPaymentError extends Error {
  readonly code: LdcPaymentErrorCode;
  readonly retryable: boolean;

  constructor(
    code: LdcPaymentErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean }
  ) {
    super(message, { cause: options?.cause });
    this.name = "LdcPaymentError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}
