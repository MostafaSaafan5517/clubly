// Stripe error messages quote the API key they were sent with (masked, but with its last few
// characters). Messages that get stored or logged go through this first.
const STRIPE_KEY = /\b(sk|rk|pk)_(test|live)_[A-Za-z0-9*]+/g;

export function redactSecrets(message: string) {
  return message.replace(STRIPE_KEY, "$1_$2_[redacted]");
}

/** An error's message, safe to store or log. */
export function errorMessage(error: unknown) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}
