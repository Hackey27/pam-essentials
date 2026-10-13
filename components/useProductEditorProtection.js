"use client";
import { useEffect, useRef, useState } from "react";
import { draftSignature, readProductDraft, recoveredDraftChanges, removeProductDraft, writeProductDraft } from "@/lib/productDrafts.mjs";
export default function useProductEditorProtection({ editor, setEditor, uid, saving, uploadingImages }) {
  const [baseline, setBaseline] = useState(""), [recovery, setRecovery] = useState(null), [draftState, setDraftState] = useState(""), [draftError, setDraftError] = useState(""), [leaveOpen, setLeaveOpen] = useState(false);
  const pending = useRef(null), latest = useRef(null), baselineRef = useRef("");
  const dirty = editor?.type === "product" && draftSignature(editor.data) !== baseline;
  latest.current = { editor, dirty, uid }; baselineRef.current = baseline;
  const busy = saving || uploadingImages;
  function flush() {
    const current = latest.current;
    if (!current?.dirty || !current.uid) return true;
    try { writeProductDraft(localStorage, current.uid, current.editor, baselineRef.current); setDraftState("Draft saved in this browser"); setDraftError(""); return true; }
    catch (e) { setDraftError(e.message || "Draft recovery is unavailable. Save the product before leaving."); setDraftState("Draft recovery failed"); return false; }
  }
  useEffect(() => {
    if (!dirty) return;
    setDraftState("Saving draft…"); const timer = setTimeout(flush, 500);
    return () => clearTimeout(timer);
  }, [editor, dirty, uid]);
  useEffect(() => {
    if (!editor) return;
    const panel = document.querySelector(leaveOpen ? '.admin-leave-backdrop [role="dialog"]' : '.editor-modal[role="dialog"]');
    panel?.querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled)')?.focus({ preventScroll: true });
  }, [Boolean(editor), leaveOpen]);
  useEffect(() => {
    const before = (e) => { if (latest.current?.dirty || busy && latest.current?.editor?.type === "product") { flush(); e.preventDefault(); e.returnValue = ""; } };
    const link = (e) => { const a = e.target.closest?.("a[href]"); if (latest.current?.dirty && a && !a.target && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); request(() => window.location.assign(a.href)); } };
    const key = (e) => {
      if (e.defaultPrevented || !latest.current?.editor) return;
      if (e.key === "Escape" && !busy) { e.preventDefault(); if (leaveOpen) { setLeaveOpen(false); pending.current = null; } else request(() => setEditor(null)); }
      if (e.key === "Tab") {
        const dialogs = [...document.querySelectorAll('.modal-backdrop [role="dialog"]')].filter((v) => v.getClientRects().length), panel = dialogs.at(-1);
        if (!panel?.matches('.editor-modal,.admin-leave-backdrop [role="dialog"]')) return;
        const items = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')].filter((v) => v.getClientRects().length);
        if (items.length && e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
        else if (items.length && !e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
      }
    };
    window.addEventListener("beforeunload", before); document.addEventListener("click", link); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", link); window.removeEventListener("keydown", key); };
  }, [busy, leaveOpen]);
  function start(next) {
    const signature = draftSignature(next.data); setBaseline(signature); baselineRef.current = signature; setEditor(next); setDraftState(""); setDraftError("");
    setRecovery(next.type === "product" && uid ? readProductDraft(localStorage, uid, next.data.create ? "new" : next.data.id) : null);
  }
  function request(action) {
    if (busy) return false;
    if (latest.current?.dirty) { pending.current = action; setLeaveOpen(true); return false; }
    action(); return true;
  }
  function leave(keep) {
    if (keep && !flush()) return;
    if (!keep && latest.current?.editor?.type === "product") { try { removeProductDraft(localStorage, uid, editor.data.create ? "new" : editor.data.id); } catch {} }
    latest.current.dirty = false; setEditor(null); setLeaveOpen(false); setRecovery(null); const action = pending.current; pending.current = null; action?.();
  }
  function saved() {
    if (editor?.type === "product") try { removeProductDraft(localStorage, uid, editor.data.create ? "new" : editor.data.id); } catch {}
    setBaseline(editor ? draftSignature(editor.data) : ""); setRecovery(null); setDraftState("Saved to catalogue");
  }
  function restore() {
    if (busy) return;
    const changes = recoveredDraftChanges(recovery, editor.data);
    setEditor((old) => ({ ...old, data: { ...old.data, ...Object.fromEntries(changes.map((c) => [c.field, c.value])), ...(changes.some((c) => c.field.startsWith("variant")) ? { variantDirty: true } : {}) } }));
    setRecovery(null); setDraftState("Recovered changes — review and save to apply");
  }
  function discardRecovery() { if (busy) return; try { removeProductDraft(localStorage, uid, editor.data.create ? "new" : editor.data.id); } catch {} setRecovery(null); }
  return { persist: flush, dirty, busy, recovery, changes: recovery && editor ? recoveredDraftChanges(recovery, editor.data) : [], draftState, draftError, leaveOpen, start, request, close: () => request(() => setEditor(null)), stay: () => { setLeaveOpen(false); pending.current = null; }, leave, saved, restore, discardRecovery };
}
