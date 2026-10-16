"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductOptions";
import { categoryWheelDelta, CATEGORY_HOLD_MS } from "@/lib/categoryCarousel.mjs";
import { centredCarouselPosition } from "@/lib/relatedProducts.mjs";

export default function RelatedProductsCarousel({ products }) {
  const section = useRef(null), viewport = useRef(null), pointer = useRef(null);
  const metrics = useRef({ stride: 0, cycle: 0, loop: false }), phase = useRef(0);
  const suppressClick = useRef(false), settleTimer = useRef(null);
  const [geometry, setGeometry] = useState({ stride: 0, loop: false });
  const [paused, setPaused] = useState(false), [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false), [interaction, setInteraction] = useState(0);
  const [visible, setVisible] = useState(false), [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const reduced = useRef(true); reduced.current = reducedMotion;

  useLayoutEffect(() => {
    const element = viewport.current;
    const measure = () => {
      const first = element.querySelector("a");
      if (!first) return;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const stride = first.getBoundingClientRect().width + gap;
      const old = metrics.current;
      phase.current = old.cycle ? ((element.scrollLeft % old.cycle) + old.cycle) % old.cycle / old.stride : 0;
      const loop = products.length * stride - gap > element.clientWidth + 1;
      setGeometry((current) => current.stride === stride && current.loop === loop ? current : { stride, loop });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [products.length]);

  useLayoutEffect(() => {
    const cycle = products.length * geometry.stride;
    metrics.current = { ...geometry, cycle };
    viewport.current.scrollLeft = geometry.loop ? cycle + phase.current * geometry.stride : 0;
  }, [geometry, products.length]);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 });
    observer.observe(section.current);
    return () => {
      observer.disconnect(); media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(settleTimer.current);
    };
  }, []);

  const move = useCallback((direction) => {
    const element = viewport.current, current = metrics.current;
    if (!element || !current.loop) return;
    element.scrollTo({ left: Math.round(element.scrollLeft / current.stride) * current.stride + direction * current.stride, behavior: reduced.current ? "instant" : "smooth" });
  }, []);
  useEffect(() => {
    if (paused || focused || dragging || !visible || !pageVisible || reducedMotion || !geometry.loop) return;
    const timer = setInterval(() => move(1), CATEGORY_HOLD_MS);
    return () => clearInterval(timer);
  }, [paused, focused, dragging, visible, pageVisible, reducedMotion, geometry.loop, interaction, move]);

  useEffect(() => {
    const element = viewport.current;
    const wheel = (event) => {
      if (!metrics.current.loop) return;
      const delta = categoryWheelDelta(event, element.clientWidth);
      if (!delta) return; // Vertical wheel gestures still scroll the page.
      event.preventDefault();
      element.scrollLeft += delta;
      setInteraction((value) => value + 1);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  const finishDrag = (event) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const manualMove = (direction) => { move(direction); setInteraction((value) => value + 1); };
  const copies = geometry.loop ? [0, 1, 2] : [1];

  return <section ref={section} className="related-products related-products-carousel" aria-label="You may also like" aria-roledescription="carousel"
    onPointerDownCapture={() => setFocused(false)} onKeyDownCapture={() => setFocused(true)}
    onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="related-products-heading"><div><h2>You may also like</h2><p>Drag or swipe to browse this category.</p></div>
      {geometry.loop && <button type="button" className="related-products-pause" aria-label={paused ? "Play related products carousel" : "Pause related products carousel"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}><span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span></button>}
    </div>
    <div className="related-products-stage">
      <div ref={viewport} className={`related-products-viewport${dragging ? " dragging" : ""}`}
        onScroll={() => {
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const element = viewport.current, current = metrics.current;
            if (!element || !current.loop || pointer.current) return;
            if (element.scrollLeft < current.cycle - 1 || element.scrollLeft >= current.cycle * 2 - 1) element.scrollLeft = centredCarouselPosition(element.scrollLeft, current.cycle);
          }, 160);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !metrics.current.loop) return;
          pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft };
          suppressClick.current = false; setDragging(true); setInteraction((value) => value + 1);
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (!suppressClick.current && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { pointer.current = null; setDragging(false); return; }
          if (Math.abs(dx) > 8 && (suppressClick.current || Math.abs(dx) > Math.abs(dy))) {
            suppressClick.current = true; setDragging(true);
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.scrollLeft = start.left - dx;
          }
        }}
        onPointerUp={finishDrag} onPointerCancel={finishDrag}
        onLostPointerCapture={(event) => { if (event.target === event.currentTarget) finishDrag(event); }}
        onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        {copies.flatMap((copy) => products.map((product) => <a className="related-product-card" key={`${copy}:${product.id}`} href={`/products/${encodeURIComponent(product.id)}`} aria-hidden={copy !== 1 || undefined} tabIndex={copy === 1 ? 0 : -1} draggable="false" onDragStart={(event) => event.preventDefault()}>
          <div className="related-product-image"><ProductImage product={product} /></div><b>{product.name}</b>
        </a>))}
      </div>
      {geometry.loop && <><button type="button" className="related-products-arrow previous" aria-label="Previous related products" onClick={() => manualMove(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button><button type="button" className="related-products-arrow next" aria-label="Next related products" onClick={() => manualMove(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button></>}
    </div>
  </section>;
}
