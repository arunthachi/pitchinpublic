export function getLeaderboardOrder(type: string) {
  switch (type) {
    case 'pitches': return { column: 'pitches_count', options: { ascending: false } };
    case 'feedback': return { column: 'total_activities', options: { ascending: false, referencedTable: 'user_streaks' } };
    case 'badges': return { column: 'id', options: { ascending: true } };
    default: return { column: 'current_streak', options: { ascending: false, referencedTable: 'user_streaks' } };
  }
}

export function normalizePitchLeaderboardResult(value: unknown) {
  const payload = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const entries = Array.isArray(value)
    ? value
    : Array.isArray(payload.entries)
      ? payload.entries
      : [];
  const total = Number(payload.total ?? entries.length);
  return {
    entries: entries as Array<Record<string, any>>,
    total: Number.isFinite(total) ? total : entries.length,
  };
}
