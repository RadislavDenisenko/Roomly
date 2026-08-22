import { describe, it, expect } from "vitest";
import { unreadByPeer } from "./chat";

const msg = (sender: string, recipient: string, at: string) => ({
  sender_id: sender,
  recipient_id: recipient,
  created_at: at,
});

describe("unreadByPeer", () => {
  it("counts only messages to me, newer than my read marker for that peer", () => {
    const messages = [
      msg("alex", "me", "2026-08-21T10:00:00Z"), // read (marker is later)
      msg("alex", "me", "2026-08-21T12:00:00Z"), // unread
      msg("me", "alex", "2026-08-21T13:00:00Z"), // my own send: never unread
      msg("zoe", "me", "2026-08-21T09:00:00Z"), // unread (no marker at all)
    ];
    const reads = [{ peer_id: "alex", last_read_at: "2026-08-21T11:00:00Z" }];
    expect(unreadByPeer(messages, reads, "me")).toEqual({ alex: 1, zoe: 1 });
  });

  it("is empty when everything is read", () => {
    const messages = [msg("alex", "me", "2026-08-21T10:00:00Z")];
    const reads = [{ peer_id: "alex", last_read_at: "2026-08-21T10:00:00Z" }];
    expect(unreadByPeer(messages, reads, "me")).toEqual({});
  });
});
