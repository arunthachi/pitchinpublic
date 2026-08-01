type DeepgramTranscriptResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: unknown }>;
    }>;
  };
};

export function extractDeepgramTranscript(payload: DeepgramTranscriptResponse) {
  const value = payload.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return typeof value === 'string' ? value.trim().slice(0, 4000) : '';
}
