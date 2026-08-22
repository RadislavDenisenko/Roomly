// Unread bookkeeping for conversations, shared by the Matches list.

export type ChatRead = { peer_id: string; last_read_at: string };
type MsgMeta = { sender_id: string; recipient_id: string; created_at: string };

// Messages TO me, per sender, newer than my read marker for that sender.
export function unreadByPeer(
  messages: MsgMeta[],
  reads: ChatRead[],
  myId: string,
): Record<string, number> {
  const readAt = new Map(reads.map((r) => [r.peer_id, new Date(r.last_read_at).getTime()]));
  const counts: Record<string, number> = {};
  for (const m of messages) {
    if (m.recipient_id !== myId) continue;
    if (new Date(m.created_at).getTime() <= (readAt.get(m.sender_id) ?? -Infinity)) continue;
    counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1;
  }
  return counts;
}
