export function getLeaderboardOrder(type: string) {
  switch (type) {
    case 'pitches': return { column: 'pitches_count', options: { ascending: false } };
    case 'feedback': return { column: 'total_activities', options: { ascending: false, referencedTable: 'user_streaks' } };
    case 'badges': return { column: 'id', options: { ascending: true } };
    default: return { column: 'current_streak', options: { ascending: false, referencedTable: 'user_streaks' } };
  }
}
