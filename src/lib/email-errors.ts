export function readableEmailError(error?: string | null) {
  if (!error) return '';

  let message = error;
  try {
    const parsed = JSON.parse(error) as { message?: string; error?: string };
    message = parsed.message || parsed.error || error;
  } catch {
    // Provider errors are not guaranteed to be JSON.
  }

  if (/Invalid `from` field/i.test(message)) {
    return 'Email sender is misconfigured in Resend. Verify mail.pitchinpublic.io and the Resend API key for this environment.';
  }

  if (/not authorized to send emails from/i.test(message)) {
    return 'Resend is not authorized to send from this domain. Verify mail.pitchinpublic.io in Resend or use an authorized sender.';
  }

  return message;
}
