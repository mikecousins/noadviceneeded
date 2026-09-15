/**
 * Thrown by write paths when the user's token lacks the `trade` scope, or
 * when SnapTrade answers 403 on a trading endpoint. The UI turns this into the
 * "Enable trading" incremental-consent flow.
 */
export class TradingScopeMissing extends Error {
  override readonly name = "TradingScopeMissing";

  constructor(message = "This SnapTrade token does not carry the trade scope.") {
    super(message);
  }
}

/** Non-2xx answer from the SnapTrade API or its OAuth endpoints. */
export class SnapTradeApiError extends Error {
  override readonly name = "SnapTradeApiError";

  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: unknown,
    message = `SnapTrade responded ${status} for ${path}`,
  ) {
    super(message);
  }

  /** SnapTrade's human-readable `detail`, when the body carries one. */
  get detail(): string | undefined {
    const b = this.body;
    if (b && typeof b === "object" && "detail" in b && typeof b.detail === "string") {
      return b.detail;
    }
    return undefined;
  }
}

/** Failure inside the OAuth dance itself: state mismatch, bad id_token, etc. */
export class SnapTradeOAuthError extends Error {
  override readonly name = "SnapTradeOAuthError";

  constructor(
    readonly code:
      "invalid_state" | "invalid_id_token" | "missing_email" | "access_denied" | "token_endpoint",
    message: string,
  ) {
    super(message);
  }
}
