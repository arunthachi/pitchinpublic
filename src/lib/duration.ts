export function formatPitchLength(seconds?: number | null) {
  const value = seconds || 60;

  if (value >= 60) {
    const minutes = value / 60;
    const label = Number.isInteger(minutes)
      ? String(minutes)
      : minutes.toFixed(1).replace(/\.0$/, '');
    return `${label} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  return `${value}s`;
}

export function formatPitchLengthRange(minSeconds: number, maxSeconds: number) {
  return `${formatPitchLength(minSeconds)} to ${formatPitchLength(maxSeconds)}`;
}
