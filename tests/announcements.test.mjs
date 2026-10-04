import test from "node:test";
import assert from "node:assert/strict";
import { activeAnnouncements, validAnnouncementLink } from "../lib/announcements.mjs";

test("announcements honor active dates, archive state and Admin sort order", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const current = (id, sortOrder) => ({ announcementId: id, title: id, body: "Visit the shop", active: true, sortOrder });
  const visible = activeAnnouncements([current("later", 9), { ...current("expired", 2), endDate: "2026-10-03T00:00:00Z" }, { ...current("hidden", 1), active: false }, { ...current("archived", 1), archived: true }, { ...current("first", 1), startDate: { toDate: () => new Date("2026-10-01T00:00:00Z") } }], now);
  assert.deepEqual(visible.map((item) => item.announcementId), ["first", "later"]);
  assert.equal("updatedBy" in visible[0], false);
});

test("announcement action links accept internal paths and HTTPS only", () => {
  assert.equal(validAnnouncementLink("/#catalogue"), true);
  assert.equal(validAnnouncementLink("https://store.hackeytech.com"), true);
  assert.equal(validAnnouncementLink("javascript:alert(1)"), false);
  assert.equal(validAnnouncementLink("//other.example"), false);
});
