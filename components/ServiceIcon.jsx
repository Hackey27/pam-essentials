export default function ServiceIcon({kind="services",filled=false}){
 const shapes={
 services:<><rect x="3" y="7" width="18" height="14" rx="3" fill={filled?"currentColor":"none"}/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v3h4v-3" stroke={filled?"#00235b":"currentColor"}/></>,
 secretarial:<><path d="M14 3H5v18h14V9M14 3v6h5M8 12h5M8 16h8"/><path d="m14 11 5-5 2 2-5 5-3 1Z"/></>,
 printing:<><path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6Z"/><path d="M17 11h1"/></>,
 communication:<><path d="m4 9 13-5v16L4 15ZM4 9H2v6h2M7 16l2 6h3l-2-5M20 8l2-2M20 12h3M20 16l2 2"/></>,
 "laptop-repairs":<><path d="M4 4h16v13H4ZM2 20h20l-2-3H4Z"/><path d="m10 8-2 2 2 2m4-4 2 2-2 2"/></>
 };return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[kind]||shapes.services}</svg>;
}
