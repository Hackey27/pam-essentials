"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { carouselCategories, CATEGORY_HOLD_MS, PHOTO_HOLD_MS, CATEGORY_MOVE_MS, PHOTO_MOVE_MS } from "@/lib/categoryCarousel.mjs";

const wrap = (value, length) => (value % length + length) % length;

export default function CategoryCarousel({ categories, products, onSelect }) {
  const items = useMemo(() => carouselCategories(categories, products), [categories, products]);
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const [layout, setLayout] = useState({ stride: 240, count: 1 });
  const [start, setStart] = useState(0);
  const [step, setStep] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoMoving, setPhotoMoving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const canMove = items.length > layout.count;
  const auto = !paused && !hovered && !focused && onScreen && pageVisible && !reducedMotion;
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
    const timer = setTimeout(() => setStep(1), CATEGORY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [auto, canMove, step, start]);
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(() => { setStart((index) => wrap(index + step, items.length)); setStep(0); }, reducedMotion ? 0 : CATEGORY_MOVE_MS);
    return () => clearTimeout(timer);
  }, [step, items.length, reducedMotion]);
  useEffect(() => {
    if (!auto || !hasPhotoSeries || photoMoving || step) return;
    const timer = setTimeout(() => setPhotoMoving(true), PHOTO_HOLD_MS);
    return () => clearTimeout(timer);
  }, [auto, hasPhotoSeries, photoMoving, photoIndex, step]);
  useEffect(() => {
    if (!photoMoving) return;
    const timer = setTimeout(() => { setPhotoIndex((index) => index + 1); setPhotoMoving(false); }, reducedMotion ? 0 : PHOTO_MOVE_MS);
    return () => clearTimeout(timer);
  }, [photoMoving, reducedMotion]);

  const move = (direction) => { if (canMove && !step) setStep(direction); };
  if (!items.length) return null;
  const slots = canMove ? Array.from({ length: layout.count + 3 }, (_, slot) => ({ category: items[wrap(start + slot - 1, items.length)], slot })) : items.map((category, slot) => ({ category, slot }));
  return <section className="category-carousel" ref={sectionRef} aria-label="Browse categories" onMouseEnter={() => { if (matchMedia("(hover: hover)").matches) setHovered(true); }} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="category-carousel-heading"><div><p className="eyebrow">Find your everyday favourites</p><h2>Shop by category</h2></div><div className="category-carousel-controls"><button type="button" className="category-pause" onClick={() => setPaused((current) => !current)} aria-pressed={paused} aria-label={paused ? "Play category carousel" : "Pause category carousel"}><span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span></button><button type="button" aria-label="Previous categories" disabled={!canMove || !!step} onClick={() => move(-1)}>‹</button><button type="button" aria-label="Next categories" disabled={!canMove || !!step} onClick={() => move(1)}>›</button></div></div>
    <div className="category-carousel-viewport" ref={viewportRef} onPointerDown={(event) => { pointer.current = { x: event.clientX, y: event.clientY }; suppressClick.current = false; }} onPointerUp={(event) => { const origin = pointer.current; pointer.current = null; if (!origin) return; const dx = event.clientX - origin.x; const dy = event.clientY - origin.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { suppressClick.current = true; move(dx > 0 ? -1 : 1); } }} onPointerCancel={() => { pointer.current = null; }}>
      <div className={`category-carousel-track${step ? " moving" : ""}`} style={{ transform: `translateX(${canMove ? -layout.stride * (1 + step) : 0}px)`, transitionDuration: reducedMotion ? "0ms" : `${CATEGORY_MOVE_MS}ms` }}>
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
  </section>;
}
