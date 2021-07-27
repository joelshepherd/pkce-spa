export enum ErrorCode {
  InvalidState = "invalid_state",
}

/**
 * The state is not found or invalid.
 *
 * This means there is no record in the browser's storage of the login request
 * we just received a reponse for. We cannot exchange the code because we do not
 * have the code verifier in browser storage either.
 */
export class InvalidStateError extends Error {
  readonly code = ErrorCode.InvalidState;
}
