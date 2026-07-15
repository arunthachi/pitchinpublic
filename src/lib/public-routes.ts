export function isUuidLike(value?: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function createPublicPitchId() {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-4);
  return `p_${random}${time}`;
}

export function profilePath(handle?: string | null) {
  return handle ? `/profile/${encodeURIComponent(handle)}` : null;
}

export function pitchPath(publicId?: string | null, fallbackId?: string | null) {
  if (publicId) return `/pitch/${encodeURIComponent(publicId)}`;
  if (fallbackId && !isUuidLike(fallbackId)) return `/pitch/${encodeURIComponent(fallbackId)}`;
  return null;
}
