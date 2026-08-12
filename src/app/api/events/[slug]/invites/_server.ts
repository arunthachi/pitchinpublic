export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export function inviteOperationFlags(inviteCreated: boolean, emailStatus?: string | null) {
  return { invite_created: inviteCreated, email_sent: emailStatus === 'sent', email_failed: emailStatus === 'failed' || emailStatus === 'not_configured' };
}
