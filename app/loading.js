"use client";
import {usePathname} from "next/navigation";
import SkeletonScreen from "@/components/SkeletonScreen";
export default function Loading(){
 const path=usePathname();
 const type=path.startsWith("/products/")?"product":path.startsWith("/account")?"account":path==="/"||path==="/wholesale"?"catalogue":"info";
 return <main className="route-loading"><SkeletonScreen type={type}/></main>;
}
