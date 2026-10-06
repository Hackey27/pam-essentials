"use client";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 });

export default function MobilePriceRange({ minimum, maximum, upperLimit, onChange }) {
  const low = minimum === "" ? 0 : Number(minimum);
  const high = maximum === "" ? upperLimit : Number(maximum);
  return <div className="mobile-price-range" role="group" aria-label="Price range">
    <strong>Price range</strong>
    <div className="mobile-price-values"><span>{money.format(low)}</span><span>{money.format(high)}</span></div>
    <div className="mobile-price-track" style={{ "--range-start": `${low / upperLimit * 100}%`, "--range-end": `${high / upperLimit * 100}%` }}>
      <span className="mobile-price-fill" aria-hidden="true" />
      <input type="range" aria-label="Minimum price" aria-valuetext={money.format(low)} min="0" max={upperLimit} step="1" value={low} onChange={(event) => { const value = Math.min(Number(event.target.value), high); onChange(value === 0 ? "" : String(value), maximum); }} />
      <input type="range" aria-label="Maximum price" aria-valuetext={money.format(high)} min="0" max={upperLimit} step="1" value={high} onChange={(event) => { const value = Math.max(Number(event.target.value), low); onChange(minimum, value === upperLimit ? "" : String(value)); }} />
    </div>
  </div>;
}
