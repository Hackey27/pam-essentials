export const SEARCH_IDLE_MS = 10000;
export const SEARCH_SCROLL_MS = 30000;
export const SEARCH_OUTSIDE_MS = 1000;

// Page scrolling keeps the panel available, but never extends the typing deadline.
export function createCompactSearchTimer({ onClose, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let lastActivity = now();
  let lastTyping = lastActivity;
  let scrolling = false;
  let disposed = false;
  let deadlineTimer, quietTimer, outsideTimer;
  const cancel = (timer) => { if (timer !== undefined) clearTimer(timer); };
  const dispose = () => {
    disposed = true;
    cancel(deadlineTimer); cancel(quietTimer); cancel(outsideTimer);
  };
  const close = () => { if (!disposed) { dispose(); onClose(); } };
  const schedule = () => {
    cancel(deadlineTimer);
    if (disposed) return;
    const deadline = scrolling ? lastTyping + SEARCH_SCROLL_MS : lastActivity + SEARCH_IDLE_MS;
    deadlineTimer = setTimer(close, Math.max(0, deadline - now()));
  };
  const interact = (typing = false) => {
    if (disposed) return;
    lastActivity = now();
    if (typing) lastTyping = lastActivity;
    scrolling = false;
    cancel(quietTimer); cancel(outsideTimer); outsideTimer = undefined;
    schedule();
  };
  const pageScroll = () => {
    if (disposed) return;
    lastActivity = now(); scrolling = true;
    cancel(quietTimer);
    quietTimer = setTimer(() => { scrolling = false; schedule(); }, SEARCH_OUTSIDE_MS);
    schedule();
  };
  const outside = () => {
    if (disposed || outsideTimer !== undefined) return;
    outsideTimer = setTimer(close, SEARCH_OUTSIDE_MS);
  };
  schedule();
  return { interact, pageScroll, outside, dispose };
}
