"use client";
import { useEffect, useRef, useState } from "react";
import { boundedZoom, gallerySwipe, pinchZoom } from "@/lib/galleryGestures.mjs";
export default function GalleryZoom({ children, onSwipe }) {
  const viewport = useRef(null), points = useRef(new Map()), zoomRef = useRef({ scale: 1, x: 0, y: 0 }), origin = useRef(null), multiple = useRef(false), tap = useRef(null);
  const swipeCallback = useRef(onSwipe); swipeCallback.current = onSwipe;
  const [zoom, setZoom] = useState(zoomRef.current), [moving, setMoving] = useState(false);
  const apply = (value) => { const rect = viewport.current?.getBoundingClientRect(); const next = boundedZoom(value, rect?.width || 0, rect?.height || 0); zoomRef.current = next; setZoom(next); };
  useEffect(() => {
    const element = viewport.current;
    const wheel = (e) => {
      e.stopPropagation();
      if (e.ctrlKey) { e.preventDefault(); apply({ ...zoomRef.current,scale:zoomRef.current.scale*Math.exp(-e.deltaY*.01) }); }
      else if (zoomRef.current.scale > 1) { e.preventDefault(); apply({ ...zoomRef.current,x:zoomRef.current.x-e.deltaX,y:zoomRef.current.y-e.deltaY }); }
      else if (Math.abs(e.deltaX) > 35 && Math.abs(e.deltaX) > Math.abs(e.deltaY) && (!tap.current || Date.now()-tap.current.at > 450)) { e.preventDefault(); tap.current = { at:Date.now() }; swipeCallback.current(e.deltaX > 0 ? 1 : -1); }
    };
    element.addEventListener("wheel",wheel,{ passive:false });
    const resize = new ResizeObserver(() => apply(zoomRef.current)); resize.observe(element);
    return () => { element.removeEventListener("wheel",wheel); resize.disconnect(); };
  }, []);
  function begin() {
    const values = [...points.current.values()]; if (!values.length) { origin.current = null; return; }
    if (values.length > 1) { multiple.current = true; tap.current = null; const [a, b] = values; origin.current = { zoom: { ...zoomRef.current }, midpoint: { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }, distance: Math.hypot(b.x-a.x,b.y-a.y) }; }
    else origin.current = { zoom: { ...zoomRef.current }, point: values[0] };
  }
  function down(event) { if (event.button !== 0) return; event.stopPropagation(); if (!points.current.size) multiple.current = false; points.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); event.currentTarget.setPointerCapture(event.pointerId); setMoving(true); begin(); }
  function move(event) {
    if (!points.current.has(event.pointerId) || !origin.current) return; event.stopPropagation(); points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...points.current.values()], rect = viewport.current.getBoundingClientRect(), start = origin.current;
    if (values.length > 1 && start.midpoint) { const [a,b] = values; apply(pinchZoom(start, { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }, Math.hypot(b.x-a.x,b.y-a.y), { x:rect.left+rect.width/2, y:rect.top+rect.height/2 })); }
    else if (start.point && zoomRef.current.scale > 1) apply({ ...start.zoom, x:start.zoom.x+event.clientX-start.point.x, y:start.zoom.y+event.clientY-start.point.y });
  }
  function up(event, cancelled = false) {
    if (!points.current.has(event.pointerId)) return; event.stopPropagation(); const start = origin.current, dx = start?.point ? event.clientX-start.point.x : 0, dy = start?.point ? event.clientY-start.point.y : 0;
    points.current.delete(event.pointerId);
    if (!cancelled && !points.current.size && start?.point && !multiple.current) {
      const direction = gallerySwipe(dx, dy, zoomRef.current.scale); if (direction) { tap.current = null; onSwipe(direction); }
      else if (event.pointerType === "touch" && Math.hypot(dx,dy) < 10) { const previous = tap.current; if (previous && Date.now()-previous.at < 320 && Math.hypot(previous.x-event.clientX,previous.y-event.clientY) < 30) { apply({ scale:zoomRef.current.scale > 1 ? 1 : 2.5, x:0,y:0 }); tap.current = null; } else tap.current = { at:Date.now(),x:event.clientX,y:event.clientY }; }
    }
    if (cancelled) tap.current = null; if (!points.current.size) setMoving(false); begin();
  }
  return <div className="gallery-zoom"><div ref={viewport} className={`gallery-zoom-viewport${zoom.scale > 1 ? " is-zoomed" : ""}${moving ? " is-moving" : ""}`} onPointerDown={down} onPointerMove={move} onPointerUp={(e) => up(e)} onPointerCancel={(e) => up(e,true)} onLostPointerCapture={(e) => up(e,true)} onDoubleClick={(e) => { e.stopPropagation(); apply({ scale:zoomRef.current.scale > 1 ? 1 : 2.5,x:0,y:0 }); }}><div className="gallery-zoom-image" style={{ transform:`translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}>{children}</div></div><div className="gallery-zoom-tools" role="group" aria-label="Image zoom"><button type="button" aria-label="Zoom out" disabled={zoom.scale <= 1} onClick={() => apply({ ...zoomRef.current,scale:zoomRef.current.scale-.5 })}>−</button><span aria-live="polite">{Math.round(zoom.scale*100)}%</span><button type="button" aria-label="Zoom in" disabled={zoom.scale >= 4} onClick={() => apply({ ...zoomRef.current,scale:zoomRef.current.scale+.5 })}>+</button><button type="button" onClick={() => apply({ scale:1,x:0,y:0 })}>Reset</button></div><small className="gallery-zoom-hint">Pinch or double-tap to zoom · Drag to inspect · Swipe at 100% to change images</small></div>;
}
