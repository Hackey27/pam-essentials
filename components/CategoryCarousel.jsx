"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { carouselCategories, categoryWheelDelta, isCarouselCaptureLoss, CATEGORY_HOLD_MS, PHOTO_HOLD_MS, CATEGORY_MOVE_MS, CATEGORY_MANUAL_MOVE_MS, PHOTO_MOVE_MS } from "@/lib/categoryCarousel.mjs";

const wrap = (value, length) => (value % length + length) % length;

export default function CategoryCarousel({ categories, products, onSelect }) {
  const items = useMemo(() => carouselCategories(categories, products), [categories, products]);
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const wheelDistance = useRef(0);
  const wheelTime = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [layout, setLayout] = useState({ stride: 240, count: 1 });
  const [start, setStart] = useState(0);
  const [step, setStep] = useState(0);
  const [stepDuration, setStepDuration] = useState(CATEGORY_MOVE_MS);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoMoving, setPhotoMoving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const canMove = items.length > layout.count;
  const auto = !paused && !dragging && !focused && onScreen && pageVisible && !reducedMotion;
  const photoAuto = !paused && !dragging && onScreen && pageVisible && !reducedMotion;
  const hasPhotoSeries = items.some((category) => category.photos.length > 1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const styles = getComputedStyle(viewport);
      const stride = parseFloat(styles.getPropertyValue("--category-frame")) + parseFloat(styles.getPropertyValue("--category-gap"));
      setLayout({ stride, count: Math.max(1, Math.floor((viewport.clientWidth + parseFloat(styles.getPropertyValue("--category-gap"))) / stride)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    update(); visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: .15 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => { observer.disconnect(); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, [items.length]);

  useEffect(() => {
    if (!auto || !canMove || step) return;
    const timer = setTimeout(() => { setStepDuration(CATEGORY_MOVE_MS); setStep(1); }, CATEGORY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [auto, canMove, step, start]);
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(() => { setStart((index) => wrap(index + step, items.length)); setStep(0); }, reducedMotion ? 0 : stepDuration);
    return () => clearTimeout(timer);
  }, [step, stepDuration, items.length, reducedMotion]);
  useEffect(() => {
    if (!photoAuto || !hasPhotoSeries || photoMoving || step) return;
    const timer = setTimeout(() => setPhotoMoving(true), PHOTO_HOLD_MS);
    return () => clearTimeout(timer);
  }, [photoAuto, hasPhotoSeries, photoMoving, photoIndex, step]);
  useEffect(() => {
    if (!photoMoving) return;
    const timer = setTimeout(() => { setPhotoIndex((index) => index + 1); setPhotoMoving(false); }, reducedMotion ? 0 : PHOTO_MOVE_MS);
    return () => clearTimeout(timer);
  }, [photoMoving, reducedMotion]);

  const move = (direction) => { if (canMove && !step) { setStepDuration(CATEGORY_MANUAL_MOVE_MS); setStep(direction); } };
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !canMove) return;
    const wheel = (event) => {
      const delta = categoryWheelDelta(event, viewport.clientWidth);
      if (!delta) return;
      event.preventDefault();
      if (step) return;
      const now = Date.now();
      if (now - wheelTime.current > 200 || Math.sign(delta) !== Math.sign(wheelDistance.current)) wheelDistance.current = 0;
      wheelTime.current = now;
      wheelDistance.current += delta;
      if (Math.abs(wheelDistance.current) >= 18) { setStepDuration(CATEGORY_MANUAL_MOVE_MS); setStep(wheelDistance.current > 0 ? 1 : -1); wheelDistance.current = 0; }
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [canMove, step]);
  if (!items.length) return null;
  const slots = canMove ? Array.from({ length: layout.count + 3 }, (_, slot) => ({ category: items[wrap(start + slot - 1, items.length)], slot })) : items.map((category, slot) => ({ category, slot }));
  return <section className="category-carousel" ref={sectionRef} aria-label="Browse categories" onPointerDownCapture={() => setFocused(false)} onKeyDownCapture={() => setFocused(true)} onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="category-carousel-heading"><div><p className="eyebrow">Find your everyday favourites</p><h2>Shop by category</h2></div><div className="category-carousel-controls"><button type="button" className="category-pause" onClick={() => setPaused((current) => !current)} aria-pressed={paused} aria-label={paused ? "Play category carousel" : "Pause category carousel"}><span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span></button></div></div>
    <div className="category-carousel-stage">
    <div className={`category-carousel-viewport${dragging ? " dragging" : ""}`} ref={viewportRef}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current || !canMove) return;
        if (step) { setStart((current) => wrap(current + step, items.length)); setStep(0); }
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; suppressClick.current = false; setDragging(true);
      }}
      onPointerMove={(event) => {
        const origin = pointer.current; if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX-origin.x, dy = event.clientY-origin.y;
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) && !suppressClick.current) { pointer.current = null; setDragging(false); setDragOffset(0); return; }
        if (Math.abs(dx) > 8 && (suppressClick.current || Math.abs(dx) > Math.abs(dy))) { suppressClick.current = true; if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId); setDragOffset(Math.max(-layout.stride, Math.min(layout.stride, dx))); }
      }}
      onPointerUp={(event) => {
        const origin = pointer.current; if (!origin || origin.id !== event.pointerId) return;
        pointer.current = null; setDragging(false); setDragOffset(0);
        const dx = event.clientX-origin.x, dy = event.clientY-origin.y;
        if (Math.abs(dx) > Math.min(30, layout.stride*.16) && Math.abs(dx) > Math.abs(dy)) { suppressClick.current = true; move(dx > 0 ? -1 : 1); }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => { if (pointer.current?.id === event.pointerId) { pointer.current = null; setDragging(false); setDragOffset(0); } }}
      onLostPointerCapture={(event) => { if (!isCarouselCaptureLoss(event)) return; if (pointer.current?.id === event.pointerId) { pointer.current = null; setDragging(false); setDragOffset(0); } }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>

      <div className={`category-carousel-track${step ? " moving" : ""}`} style={{ transform: `translateX(${canMove ? -layout.stride * (1 + step) + (step ? 0 : dragOffset) : 0}px)`, transitionDuration: reducedMotion ? "0ms" : `${stepDuration}ms` }}>
        {slots.map(({ category, slot }) => {
          const offscreen = canMove && (slot === 0 || slot > layout.count + 1);
          const current = category.photos[photoIndex % category.photos.length];
          const next = category.photos[(photoIndex + 1) % category.photos.length];
          return <button type="button" className="category-carousel-card" key={`${slot}:${category.id}`} tabIndex={offscreen ? -1 : 0} aria-hidden={offscreen || undefined} aria-label={`Browse ${category.name}, ${category.count} products`} onClick={() => { if (!suppressClick.current && !step) onSelect(category); suppressClick.current = false; }}>
            <div className="category-photo-viewport">{current ? <div className={`category-photo-track${photoMoving && category.photos.length > 1 ? " moving" : ""}`} style={{ transitionDuration: reducedMotion ? "0ms" : `${PHOTO_MOVE_MS}ms` }}><img src={current.url} alt={current.name} draggable="false" /><img src={next.url} alt="" aria-hidden="true" draggable="false" loading="lazy" /></div> : <div className="category-photo-placeholder" aria-hidden="true">{category.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</div>}</div>
            <div className="category-card-label"><strong>{category.name}</strong><span>{category.count} products <span aria-hidden="true">↗</span></span></div>
          </button>;
        })}
      </div>
    </div>
    <button type="button" className="category-overlay-arrow previous" aria-label="Previous categories" disabled={!canMove || !!step} onClick={() => move(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button>
    <button type="button" className="category-overlay-arrow next" aria-label="Next categories" disabled={!canMove || !!step} onClick={() => move(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
    </div>
  </section>;
}
