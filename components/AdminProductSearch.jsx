"use client";

import { useId, useState } from "react";
import { cardImageSource } from "@/lib/productImages.mjs";
import { variantDetail } from "@/lib/variantDisplay.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function AdminProductSearch({ query, setQuery, category, setCategory, status, setStatus, categories, products, onSelect }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const id = useId();
  const suggestions = query.trim() ? products.slice(0, 8) : [];
  const showSuggestions = suggestionsOpen && Boolean(query.trim());
  const activeFilters = Number(category !== "all") + Number(status !== "all");
  const choose = (product) => { setSuggestionsOpen(false); setHighlight(-1); onSelect(product); };
  function navigate(event) {
    if (event.key === "Escape") { setSuggestionsOpen(false); setHighlight(-1); return; }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && suggestions.length) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setHighlight((current) => event.key === "ArrowDown" ? (current + 1) % suggestions.length : (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && showSuggestions && suggestions.length) {
      event.preventDefault();
      choose(suggestions[Math.min(Math.max(highlight, 0), suggestions.length - 1)]);
    }
  }
  return <div className="admin-product-tools">
    <button type="button" className="admin-product-filter-toggle" aria-expanded={filtersOpen} aria-controls={`${id}-filters`} onClick={() => setFiltersOpen((open) => !open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg> Filters {activeFilters > 0 && <span className="badge neutral">{activeFilters}</span>}
    </button>
    <div id={`${id}-filters`} className={`admin-product-filters${filtersOpen ? " open" : ""}`}>
      <label>Category<select aria-label="Filter products by category" value={category} onChange={(event) => { setCategory(event.target.value); setHighlight(-1); }}><option value="all">All Categories</option>{categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name}</option>)}</select></label>
      <label>Product status<select aria-label="Filter products by status" value={status} onChange={(event) => { setStatus(event.target.value); setHighlight(-1); }}><option value="all">All Products</option><option value="priced">Visible for sale</option><option value="needs-pricing">Needs pricing</option><option value="low">Low stock</option><option value="archived">Archived</option></select></label>
    </div>
    <div className="admin-product-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false); }}>
      <input role="combobox" aria-label="Search Admin products" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={`${id}-suggestions`} aria-activedescendant={showSuggestions && suggestions[highlight] ? `${id}-option-${highlight}` : undefined} placeholder="Search name, SKU or barcode" autoComplete="off" value={query} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); setHighlight(-1); }} onKeyDown={navigate} />
      {showSuggestions && <div className="admin-product-suggestions" id={`${id}-suggestions`} role="listbox" aria-label="Suggested Admin products">
        {suggestions.length ? suggestions.map((product, index) => {
          const image = cardImageSource(product).url;
          return <button key={product.id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={highlight === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(product)}>
            {image ? <img src={image} alt="" loading="lazy" /> : <span className="admin-search-image-placeholder" aria-hidden="true">{String(product.name || "P").slice(0, 2).toUpperCase()}</span>}
            <span className="admin-search-product-details"><strong>{product.name}</strong><small>SKU: {product.sku || product.id}{variantDetail(product) && ` · ${variantDetail(product)}`}</small><small>{[product.category, product.subcategory, product.subSubcategory].filter(Boolean).join(" / ")}</small><small>{Number(product.price) > 0 ? money.format(product.price) : "Price not set"} · {product.stock || 0} in stock{product.archived ? " · Archived" : product.active === false ? " · Inactive" : ""}</small></span>
          </button>;
        }) : <p>No products match your search and filters.</p>}
      </div>}
    </div>
    <span className="admin-product-result-count" role="status">{products.length} results</span>
  </div>;
}
