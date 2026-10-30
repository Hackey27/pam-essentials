"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,updateProfile} from "firebase/auth";
import {auth} from "@/lib/firebase";
import {signOut,useAuth} from "@/components/AuthProvider";
import CustomerProfile from "@/components/CustomerProfile";
import CustomerOrderDetails from "@/components/CustomerOrderDetails";
import CustomerRequestTracking from "@/components/CustomerRequestTracking";
import BrandLogo from "@/components/BrandLogo";
import SkeletonScreen from "@/components/SkeletonScreen";
import {ProductImage} from "@/components/ProductOptions";
import {customerTab,customerFirstName,customerNotifications,validCustomerSignup} from "@/lib/customerAccount.mjs";
import {readNavigation} from "@/lib/customerNavigation.mjs";

const tabs=[["orders","My orders"],["wishlist","Wishlist"],["requests","Requests & quotes"],["details","Details & contact preferences"]];
export default function CustomerAccount(){
 const {user,role,loading}=useAuth();
 const [mode,setMode]=useState("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[firstName,setFirstName]=useState(""),[otherNames,setOtherNames]=useState(""),[signupPhone,setSignupPhone]=useState("");
 const [orders,setOrders]=useState([]),[wishlist,setWishlist]=useState([]),[products,setProducts]=useState([]),[requests,setRequests]=useState([]),[profile,setProfile]=useState({});
 const [active,setActive]=useState("orders"),[reference,setReference]=useState(""),[phone,setPhone]=useState(""),[busy,setBusy]=useState(false),[authBusy,setAuthBusy]=useState(false),[dataLoading,setDataLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[notificationOpen,setNotificationOpen]=useState(false),[notificationBusy,setNotificationBusy]=useState(false),[claimOpen,setClaimOpen]=useState(false),[claimChoice,setClaimChoice]=useState(false),[refreshStatus,setRefreshStatus]=useState("idle");
 const refreshTimer=useRef(null),refreshLock=useRef(false),action=useRef(false),wishHandled=useRef(""),refreshSequence=useRef(0),previousUid=useRef(null);
 const request=useCallback(async(path,options={},identity=auth.currentUser)=>{
  const scope=identity?.uid;const token=await identity?.getIdToken();if(!token)throw Error("Please sign in again.");
  if(auth.currentUser?.uid!==scope)throw Error("The account changed. Please retry.");
  const response=await fetch(path,{...options,cache:"no-store",headers:{...options.headers,authorization:"Bearer "+token}});
  const data=await response.json();if(auth.currentUser?.uid!==scope)throw Error("The account changed. Please retry.");if(!response.ok)throw Error(data.error||"Please try again.");return data;
 },[]);
 const refresh=useCallback(async()=>{
  const scope=auth.currentUser?.uid,sequence=++refreshSequence.current;
  const results=await Promise.allSettled([request("/api/orders"),request("/api/customer/wishlist"),fetch("/api/catalog/products").then(async response=>{if(!response.ok)throw Error("Product photos could not be refreshed.");return response.json();}),request("/api/customer/profile"),request("/api/customer/requests")]);
  if(auth.currentUser?.uid!==scope||sequence!==refreshSequence.current)return;
  const setters=[data=>setOrders(data.orders||[]),data=>setWishlist(data.wishlist||[]),data=>setProducts(data.products||[]),data=>setProfile(data.profile||{}),data=>setRequests(data.requests||[])];
  results.forEach((result,index)=>{if(result.status==="fulfilled")setters[index](result.value);});
  const failed=results.find(result=>result.status==="rejected");if(failed)setError(failed.reason.message||"Some account details could not be refreshed.");
  setDataLoading(false);return !failed;
 },[request]);
 useEffect(()=>{
  if(previousUid.current&&!user){setMode("signin");setFirstName("");setOtherNames("");setSignupPhone("");setEmail("");setPassword("");setConfirmation("");}
  previousUid.current=user?.uid||null;
  setOrders([]);setWishlist([]);setRequests([]);setProfile({});setError("");setNotice("");setNotificationOpen(false);setDataLoading(true);wishHandled.current="";
  let saved="orders";try{saved=sessionStorage.getItem("pam-customer-tab:"+user?.uid)||"orders";}catch{}
  setActive(customerTab(location.hash,saved));
 },[user?.uid]);
 useEffect(()=>{const params=new URLSearchParams(location.search);if(["register","signin"].includes(params.get("mode")))setMode(params.get("mode"));const changed=()=>setActive(current=>customerTab(location.hash,current));window.addEventListener("hashchange",changed);window.addEventListener("popstate",changed);return()=>{window.removeEventListener("hashchange",changed);window.removeEventListener("popstate",changed);};},[]);
 useEffect(()=>{
  if(loading||!user||role)return;
  let live=true;const run=()=>{if(live&&!document.hidden)refresh().catch(reason=>{if(live){setError(reason.message);setDataLoading(false);}});};
  run();const timer=setInterval(run,60000);window.addEventListener("focus",run);
  const wanted=new URLSearchParams(location.search).get("wishlist");
  if(wanted&&wishHandled.current!==wanted){wishHandled.current=wanted;request("/api/customer/wishlist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId:wanted})}).then(()=>{if(!live)return;setNotice("Product saved to your wishlist.");history.replaceState(history.state,"","/account#wishlist");setActive("wishlist");return refresh();}).catch(reason=>{if(live)setError(reason.message);});}
  return()=>{live=false;clearInterval(timer);window.removeEventListener("focus",run);};
 },[loading,user,role,request,refresh]);
 function chooseTab(key){
  window.dispatchEvent(new Event("pam-save-customer-position"));setActive(key);setNotificationOpen(false);
  try{sessionStorage.setItem("pam-customer-tab:"+user.uid,key);}catch{}
  const target=location.pathname+location.search+"#"+key;
  let saved;try{saved=readNavigation(sessionStorage,user.uid).positions[target];}catch{}
  history.replaceState(history.state,"",target);window.dispatchEvent(new HashChangeEvent("hashchange"));
  if(!saved)requestAnimationFrame(()=>document.getElementById("account-workspace")?.scrollIntoView({behavior:"instant",block:"start"}));
 }
 async function handleAuth(event){
  event.preventDefault();if(action.current)return;action.current=true;setBusy(true);setAuthBusy(true);setError("");setNotice("");let created=false;
  try{
   if(mode==="reset"){await sendPasswordResetEmail(auth,email.trim());setNotice("If an account uses this email, you will receive a password reset link. Check your inbox and spam folder.");}
   else if(mode==="register"){
    const name=[firstName.trim(),otherNames.trim()].filter(Boolean).join(" ");
    const validation=validCustomerSignup({name,phone:signupPhone,password,confirmation});if(validation)throw Error(validation);
    const credential=await createUserWithEmailAndPassword(auth,email.trim(),password);created=true;
    await updateProfile(credential.user,{displayName:name.trim()});
    const data=await request("/api/customer/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:name.trim(),phone:signupPhone.trim(),marketingEmail:false,marketingPhone:false})},credential.user);
    setProfile(data.profile);setNotice("Your account is ready. Welcome to PAM!");await refresh();
   }else await signInWithEmailAndPassword(auth,email.trim(),password);
   setPassword("");setConfirmation("");
  }catch(reason){
   if(created){setNotice("Your account was created. Please check and save your contact details below.");setActive("details");}
   else if(mode==="reset"&&reason.code==="auth/user-not-found")setNotice("If an account uses this email, you will receive a password reset link. Check your inbox and spam folder.");
   else setError(reason.code==="auth/email-already-in-use"?"An account already uses this email. Choose Sign in.":reason.code==="auth/invalid-credential"?"Check your email and password.":reason.code==="auth/too-many-requests"?"Too many attempts. Please wait and try again.":reason.code?"Account access failed. Check your details and connection.":reason.message);
  }finally{action.current=false;setBusy(false);setAuthBusy(false);}
 }
 async function claim(event){
  event.preventDefault();if(action.current)return;action.current=true;setBusy(true);setError("");
  try{await request("/api/customer/orders/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reference,phone})});await refresh();setReference("");setPhone("");setNotice("Order linked to your account.");}catch(reason){setError(reason.message);}finally{action.current=false;setBusy(false);}
 }
 async function removeWish(productId){
  try{await request("/api/customer/wishlist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({productId,remove:true})});setWishlist(current=>current.filter(id=>id!==productId));}catch(reason){setError(reason.message);}
 }
 const notifications=customerNotifications(orders,requests,profile.notificationsSeenAt),unread=notifications.filter(item=>item.unread).length;
 async function toggleNotifications(){
  const opening=!notificationOpen;setNotificationOpen(opening);if(!opening||!unread||notificationBusy)return;
  setNotificationBusy(true);try{const data=await request("/api/customer/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"notifications-read"})});setProfile(data.profile);}catch(reason){setError(reason.message);}finally{setNotificationBusy(false);}
 }
 function openNotification(item){
  chooseTab(item.tab);requestAnimationFrame(()=>{const record=[...document.querySelectorAll("details[data-record-key]")].find(element=>element.dataset.recordKey===item.key);if(record){record.open=true;record.scrollIntoView({behavior:"smooth",block:"start"});}});
 }

 useEffect(()=>()=>clearTimeout(refreshTimer.current),[]);
 async function leaveAccount(){
  if(action.current)return;action.current=true;setBusy(true);setError("");
  try{await signOut();window.location.assign("/");}catch(reason){setError(reason.message||"Sign out failed. Please try again.");action.current=false;setBusy(false);}
 }
 async function refreshAccount(){
  if(refreshLock.current)return;
  const uid=auth.currentUser?.uid;refreshLock.current=true;clearTimeout(refreshTimer.current);setRefreshStatus("loading");setError("");
  try{const ok=await refresh();if(auth.currentUser?.uid!==uid)return;setRefreshStatus(ok?"done":"idle");if(ok)refreshTimer.current=setTimeout(()=>setRefreshStatus("idle"),2000);}
  catch(reason){if(auth.currentUser?.uid===uid){setError(reason.message||"Account refresh failed.");setRefreshStatus("idle");}}
  finally{refreshLock.current=false;}
 }

 const feedback=<>{error&&<div className="notice error-notice" role="alert">{error}{user&&!role&&<button type="button" className="text-button" onClick={()=>{setError("");refresh();}}>Retry refresh</button>}</div>}{notice&&<p className="notice" role="status">{notice}</p>}</>;
 if(loading||authBusy)return <main className="account-main account-redesign"><SkeletonScreen type="account" label="Loading your account"/></main>;
 if(role)return <main className="account-main account-redesign"><section className="panel"><h1>Customer account</h1><p>A staff account is currently signed in. Use a customer account to access customer orders and wishlists.</p><button className="button secondary" onClick={leaveAccount}>Sign out of staff account</button><a className="button primary" href="/">Continue shopping</a></section></main>;
 if(!user)return <main className="login-shell customer-auth-shell"><section className="login-brand-panel"><a href="/" className="login-brand" aria-label="PAM Essentials home"><BrandLogo background="navy"/></a><div><p className="eyebrow">Customer account</p><h1>Track orders, add wishlist and keep everything organised.</h1><p>Your orders, favourite products and requests in one place.</p></div><p className="login-footnote">PAM Essentials &amp; More · Ghana</p></section><section className="login-form-panel"><form className="login-card" onSubmit={handleAuth}><h2>Welcome</h2><p>{mode==="reset"?"Reset your password.":"Sign in or create account."}</p><div className="account-tabs" role="group" aria-label="Account access"><button type="button" className={mode==="signin"?"active":""} onClick={()=>{setMode("signin");setError("");setNotice("");}}>Sign in</button><button type="button" className={mode==="register"?"active":""} onClick={()=>{setMode("register");setError("");setNotice("");}}>Create account</button></div>{feedback}
 {mode==="register"&&<><div className="customer-name-fields"><label htmlFor="customer-first-name">First name<input id="customer-first-name" required autoComplete="given-name" maxLength={60} value={firstName} onChange={event=>setFirstName(event.target.value)}/></label><label htmlFor="customer-other-names">Other names<input id="customer-other-names" autoComplete="family-name" maxLength={59} value={otherNames} onChange={event=>setOtherNames(event.target.value)}/></label></div><label htmlFor="customer-signup-phone">Phone number (WhatsApp preferred)<input id="customer-signup-phone" required type="tel" autoComplete="tel" maxLength={40} value={signupPhone} onChange={event=>setSignupPhone(event.target.value)}/></label></>}
 <label htmlFor="customer-email">Email<input id="customer-email" required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/></label>
 {mode!=="reset"&&<label htmlFor="customer-password">Password<input id="customer-password" required type="password" minLength={6} autoComplete={mode==="register"?"new-password":"current-password"} value={password} onChange={event=>setPassword(event.target.value)}/></label>}
 {mode==="register"&&<><label htmlFor="customer-confirm-password">Confirm password<input id="customer-confirm-password" required type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label></>}
 <button className="button primary" disabled={busy}>{mode==="reset"?"Send reset link":mode==="register"?"Sign up":"Sign in"}</button><button type="button" className="account-recovery" onClick={()=>{setMode(mode==="reset"?"signin":"reset");setError("");setNotice("");}}>{mode==="reset"?"Back to sign in":"Forgot password?"}</button><a className="back-link" href="/">Continue shopping</a></form></section></main>;

 return <div className="customer-account account-redesign"><main className="account-main">
 <header className="customer-account-strip"><div className="customer-greeting"><div className="customer-notification-anchor"><button type="button" className="customer-bell" aria-label={unread?unread+" unread account updates":"Account notifications"} aria-expanded={notificationOpen} onClick={toggleNotifications}><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>{notificationOpen&&<section className="customer-notifications" aria-label="Your account updates"><div className="panel-title"><h2>Updates</h2><button type="button" className="icon-button" aria-label="Close notifications" onClick={()=>setNotificationOpen(false)}>×</button></div>{notifications.length?notifications.slice(0,30).map(item=><button type="button" key={item.key} onClick={()=>openNotification(item)}><b>{item.title}</b><span>{item.description}</span><small>{new Date(item.at).toLocaleString("en-GH",{timeZone:"Africa/Accra"})}</small></button>):<p>No account updates yet.</p>}</section>}</div><h1>Hello, {customerFirstName(profile,user)}.</h1></div><button type="button" className="customer-signout" onClick={signOut}>Sign out</button></header>
 <nav className="customer-account-tabs" aria-label="Account sections" role="tablist">{tabs.map(([key,label],index)=><button key={key} type="button" role="tab" id={"account-tab-"+key} aria-selected={active===key} aria-controls={"account-panel-"+key} tabIndex={active===key?0:-1} onClick={()=>chooseTab(key)} onKeyDown={event=>{if(["ArrowRight","ArrowLeft"].includes(event.key)){event.preventDefault();const next=tabs[(index+(event.key==="ArrowRight"?1:tabs.length-1))%tabs.length][0];chooseTab(next);document.getElementById("account-tab-"+next)?.focus();}}}>{label}</button>)}</nav>
 <div className="customer-account-toolbar"><a className="button primary" href="/">Continue shopping</a><button type="button" className="button secondary account-refresh" disabled={dataLoading||refreshStatus==="loading"} aria-busy={refreshStatus==="loading"} onClick={refreshAccount}>{refreshStatus==="loading"?<><span className="account-spinner" aria-hidden="true"/><span className="sr-only">Refreshing account</span></>:refreshStatus==="done"?"Refreshed":"Refresh account"}</button></div>{feedback}
 <div id="account-workspace">{dataLoading?<SkeletonScreen type="account" label="Loading orders and account details"/>:<>
 <div id="account-panel-orders" role="tabpanel" aria-labelledby="account-tab-orders" hidden={active!=="orders"}><section className="panel account-panel" id="orders"><h2>My orders</h2>{orders.length?<div className="account-orders">{orders.map(order=><CustomerOrderDetails key={order.orderId} order={order}/>)}</div>:error?<p>Orders could not be fully refreshed. Use Retry refresh above.</p>:<div className="account-empty"><span className="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3h14v19l-3-2-4 2-4-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span><small>No orders are linked to this account yet.</small></div>}</section><section className="panel account-claim-panel"><button type="button" className="guest-link-question" aria-expanded={claimChoice} onClick={()=>setClaimChoice(v=>!v)}>Bought from us before but not seeing your order?</button>{claimChoice&&<><div className="guest-link-choices"><button type="button" className="button secondary" aria-pressed={claimOpen} onClick={()=>setClaimOpen(true)}>Yes</button><button type="button" className="button secondary" onClick={()=>{setClaimOpen(false);setClaimChoice(false);}}>No</button></div>{claimOpen&&<form className="claim-form" onSubmit={claim}><h3>Link an earlier guest order</h3><p>Enter the reference and phone number used at checkout.</p><label>Order reference<input required value={reference} onChange={event=>setReference(event.target.value)}/></label><label>Phone number<input required type="tel" value={phone} onChange={event=>setPhone(event.target.value)}/></label><button className="button secondary" disabled={busy}>{busy?"Linking…":"Link order"}</button></form>}</>}</section></div>
 <div id="account-panel-wishlist" role="tabpanel" aria-labelledby="account-tab-wishlist" hidden={active!=="wishlist"}><section className="panel account-panel" id="wishlist"><h2>Wishlist</h2>{wishlist.length?<div className="customer-wishlist-grid">{wishlist.map(id=>{const product=products.find(item=>item.id===id);return <article key={id}>{product&&<a href={"/products/"+encodeURIComponent(id)} aria-label={"View "+product.name}><ProductImage product={product}/></a>}<div><a href={"/products/"+encodeURIComponent(id)}>{product?.name||"Saved product"}</a><button type="button" className="text-button" onClick={()=>removeWish(id)}>Remove from wishlist</button></div></article>;})}</div>:<p>Save products from the storefront to see them here.</p>}</section></div>
 <div id="account-panel-requests" role="tabpanel" aria-labelledby="account-tab-requests" hidden={active!=="requests"}><CustomerRequestTracking key={user.uid} request={request} initialRecords={requests} onRecords={setRequests}/></div>
 <div id="account-panel-details" role="tabpanel" aria-labelledby="account-tab-details" hidden={active!=="details"}><CustomerProfile key={user.uid} onSaved={saved=>{if(auth.currentUser?.uid===user.uid)setProfile(current=>({...current,...saved}));}}/></div>
 </>}</div></main></div>;
}
