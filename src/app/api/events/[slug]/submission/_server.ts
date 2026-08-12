export function buildSubmissionSuccessResponse(submission: Record<string, unknown>, pitch: { id: string; public_id?: string | null }, visibilityChanged = false) {
  return { success: true, submission, pitchId: pitch.id, publicId: pitch.public_id || null, visibilityChanged };
}
