"use client";

import { useParams } from "next/navigation";
import ProductDetailView from "@/components/ProductDetailView";

export default function ProductPage() {
  const { id } = useParams();
  return <ProductDetailView id={id} />;
}
