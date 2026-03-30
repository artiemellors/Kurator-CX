// Runs once at Next.js server startup (Node.js runtime only).
// The environment routes outbound HTTPS through a proxy with a self-signed
// certificate in the chain. Without this, the Anthropic SDK's fetch calls
// fail with SELF_SIGNED_CERT_IN_CHAIN.
export async function register() {
  if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
}
