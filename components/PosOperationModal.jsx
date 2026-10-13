"use client";
import {useEffect} from "react";
import useAdminModal from "@/components/useAdminModal";
export default function PosOperationModal({title,children,onClose,busy=false,onSubmit,className="pos-operation-modal"}){
  const ref=useAdminModal(onClose,busy);
  useEffect(()=>{if(!ref.current?.querySelector("button,input,select,textarea"))ref.current?.focus({preventScroll:true});},[]);
  const props={ref,tabIndex:-1,className:`modal ${className}`,role:"dialog","aria-modal":true,"aria-label":title};
  return <div className="modal-backdrop">{onSubmit?<form {...props} onSubmit={onSubmit}>{children}</form>:<div {...props}>{children}</div>}</div>;
}
