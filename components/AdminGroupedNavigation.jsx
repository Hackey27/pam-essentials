"use client";
import { useEffect, useId, useState } from "react";
import { groupedNavigation } from "@/lib/adminWorkspace.mjs";

export default function AdminGroupedNavigation({ allowed, current, counts, onNavigate, mobile = false }) {
  const groups = groupedNavigation(allowed);
  const activeGroup = groups.find((group) => group.tabs.includes(current))?.title;
  const [expanded, setExpanded] = useState(() => ({ [activeGroup]: true }));
  const id = useId();
  useEffect(() => {
    if (activeGroup) setExpanded((old) => ({ ...old, [activeGroup]: true }));
  }, [activeGroup, current]);
  return <div className={`admin-navigation-groups${mobile ? " mobile" : ""}`}>{groups.map((group, index) => {
    const open = expanded[group.title] === true;
    const count = group.tabs.reduce((sum, item) => sum + Number(counts[item] || 0), 0);
    const controls = `${id}-group-${index}`;
    return <section className={`admin-nav-group${open ? " expanded" : ""}`} key={group.title}>
      <h2><button className="admin-nav-group-toggle" type="button" aria-expanded={open} aria-controls={controls} onClick={() => setExpanded((old) => ({ ...old, [group.title]: !open }))}>
        <span>{group.title}</span>{count > 0 && <b aria-label={`${count} ${count === 1 ? "item" : "items"} needing attention`}>{count}</b>}
        <svg className="admin-nav-group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button></h2>
      <div id={controls} className="admin-nav-group-body" aria-hidden={!open} inert={!open}>
        <div className="admin-nav-group-items">{group.tabs.map((item) => <button type="button" key={item} onClick={() => onNavigate(item)} className={current === item ? "active" : ""} aria-current={current === item ? "page" : undefined}>
          {!mobile && <span className="nav-dot" />}<span>{item}</span>{counts[item] > 0 && <b>{counts[item]}</b>}
        </button>)}</div>
      </div>
    </section>;
  })}</div>;
}
