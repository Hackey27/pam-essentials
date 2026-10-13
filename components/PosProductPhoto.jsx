"use client";
import {useState} from "react";
import {cardImageSource} from "@/lib/productImages.mjs";
export default function PosProductPhoto({product}) { const {url}=cardImageSource(product);const [failed,setFailed]=useState("");return <span className="pos-product-photo">{url&&failed!==url?<img src={url} alt="" loading="lazy" onError={()=>setFailed(url)}/>:<span className="product-monogram">{product.name.slice(0,2).toUpperCase()}</span>}</span>; }
