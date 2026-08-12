export function feedbackSubmissionRpc(pitchId: string, type: 'roast' | 'toast', content: string, requestKey: string, eventId?: string | null) {
  return eventId
    ? { name: 'submit_event_pitch_feedback', args: { target_pitch_id: pitchId, feedback_type: type, feedback_content: content, request_key: requestKey, target_event_id: eventId } }
    : { name: 'submit_pitch_feedback', args: { target_pitch_id: pitchId, feedback_type: type, feedback_content: content, request_key: requestKey } };
}
