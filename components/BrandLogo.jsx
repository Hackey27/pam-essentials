const asset = (kind, background) => `/brand/pam-${kind}-${background}.svg`;

export default function BrandLogo({ background = "white", mobileBackground = background, symbolOnMobile = false, symbol = false, className = "" }) {
  const kind = symbol ? "symbol" : "lockup";
  const mobileKind = symbol || symbolOnMobile ? "symbol" : "lockup";
  return <picture className={`brand-logo ${className}`.trim()}>
    <source media="(max-width: 767px)" srcSet={asset(mobileKind, mobileBackground)} />
    <img src={asset(kind, background)} width={symbol ? 224 : 635} height={symbol ? 108 : 128} alt="PAM Essentials & More" decoding="async" />
  </picture>;
}
