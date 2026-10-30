"use client";
import {useRef,useState} from "react";
import {AnnouncementContent} from "./AnnouncementContent";
import {announcementFonts,announcementText,plainAnnouncementDocument,safeAnnouncementHref} from "@/lib/announcementDocument.mjs";
function hex(value){
 if(/^#[0-9a-f]{6}$/i.test(value||""))return value;
 const match=String(value||"").match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
 return match?"#"+match.slice(1).map(v=>Number(v).toString(16).padStart(2,"0")).join(""):undefined;
}
function runs(node,inherited={}) {
 if(node.nodeType===3)return [{...inherited,text:node.textContent||""}];
 if(node.nodeType!==1||node.getAttribute("aria-hidden")==="true")return [];
 const tag=node.tagName,style={...inherited},css=node.style;
 if(["B","STRONG"].includes(tag)||Number(css.fontWeight)>=600)style.bold=true;
 if(["I","EM"].includes(tag)||css.fontStyle==="italic")style.italic=true;
 if(tag==="U"||css.textDecoration.includes("underline"))style.underline=true;
 const color=hex(css.color||node.getAttribute("color"));if(color)style.color=color;
 const size=parseInt(css.fontSize);if(size)style.fontSize=Math.max(12,Math.min(36,size));
 const rawFamily=(css.fontFamily||node.getAttribute("face")||"").replace(/["']/g,"");const family=rawFamily.startsWith("Comfortaa Variable")?"Comfortaa":rawFamily.startsWith("Nunito Sans Variable")?"Nunito Sans":rawFamily;if(announcementFonts.includes(family))style.fontFamily=family;
 if(tag==="A"&&safeAnnouncementHref(node.getAttribute("href")))style.href=node.getAttribute("href");
 if(tag==="BR")return [{...style,text:"\n"}];
 return [...node.childNodes].flatMap(child=>runs(child,style));
}
function readDocument(root) {
 const blocks=[];let loose=[];
 const flush=()=>{if(loose.length){blocks.push({type:"paragraph",align:"left",runs:loose});loose=[];}};
 const walk=container=>{
  for(const child of container.childNodes){
   if(child.nodeType===1&&["UL","OL"].includes(child.tagName)){flush();for(const item of child.children)blocks.push({type:child.tagName==="UL"?"bullet":"number",align:item.style.textAlign||"left",runs:runs(item)});}
   else if(child.nodeType===1&&["P","DIV","H1","H2","H3","H4","H5","H6"].includes(child.tagName)){
    flush();if(child.tagName==="DIV"&&[...child.children].some(el=>["P","DIV","UL","OL"].includes(el.tagName)))walk(child);
    else blocks.push({type:child.classList.contains("rich-bullet")?"bullet":child.classList.contains("rich-number")?"number":child.tagName.startsWith("H")?"heading":"paragraph",align:child.style.textAlign||"left",runs:runs(child)});
   }else loose.push(...runs(child));
  }flush();
 };walk(root);return {version:1,blocks};
}
export default function AnnouncementEditor({value,body,onChange}) {
 const initial=useRef(value||plainAnnouncementDocument(body)),editor=useRef(null),selection=useRef(null);
 const [error,setError]=useState(""),[url,setUrl]=useState("");
 const remember=()=>{const s=window.getSelection();if(s?.rangeCount&&editor.current?.contains(s.anchorNode))selection.current=s.getRangeAt(0).cloneRange();};
 const update=()=>{const doc=readDocument(editor.current),text=doc.blocks.map(b=>b.runs.map(r=>r.text).join("")).join("\n");setError(text.length>1200?"Keep the message within 1,200 characters.":"");onChange(text,doc);remember();};
 const command=(name,value)=>{editor.current.focus();const s=window.getSelection();if(selection.current){s.removeAllRanges();s.addRange(selection.current);}document.execCommand(name,false,value);update();};
 const button=(label,commandName,text=label)=><button type="button" title={label} aria-label={label} onMouseDown={event=>event.preventDefault()} onClick={()=>command(commandName)}>{text}</button>;
 return <div className="announcement-rich-editor"><label id="announcement-message-label">Message</label>
  <div className="rich-toolbar" role="toolbar" aria-label="Announcement formatting">
   {button("Bold","bold",<b>B</b>)}{button("Italic","italic",<i>I</i>)}{button("Underline","underline",<u>U</u>)}
   <select aria-label="Message font" defaultValue="inherit" onChange={e=>command("fontName",e.target.value==="Comfortaa"?"Comfortaa Variable":e.target.value==="Nunito Sans"?"Nunito Sans Variable":e.target.value)}>{announcementFonts.map(font=><option key={font} value={font}>{font==="inherit"?"Website font":font}</option>)}</select>
   <select aria-label="Message font size" defaultValue="16" onChange={e=>{editor.current.focus();const s=window.getSelection();if(selection.current){s.removeAllRanges();s.addRange(selection.current);}document.execCommand("fontSize",false,"7");for(const font of editor.current.querySelectorAll('font[size="7"]')){font.removeAttribute("size");font.style.fontSize=e.target.value+"px";}update();}}>{[12,14,16,18,20,24,28,32,36].map(size=><option key={size}>{size}</option>)}</select>
   <label className="rich-color">Text colour<input type="color" defaultValue="#00235b" aria-label="Message text colour" onChange={e=>command("foreColor",e.target.value)}/></label>
   {button("Align left","justifyLeft","≡ ←")}{button("Align centre","justifyCenter","≡")}{button("Align right","justifyRight","→ ≡")}
   {button("Bullet list","insertUnorderedList","• List")}{button("Numbered list","insertOrderedList","1. List")}
   <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>command("formatBlock","h3")}>Heading</button>
   <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>command("formatBlock","p")}>Paragraph</button>
   {button("Undo","undo","↶")}{button("Redo","redo","↷")}{button("Clear formatting","removeFormat","Clear format")}
  </div>
  <div className="rich-link"><input type="url" aria-label="Announcement link URL" placeholder="https://… or /shop" value={url} onChange={e=>setUrl(e.target.value)}/><button type="button" onClick={()=>{if(!safeAnnouncementHref(url)){setError("Use an HTTPS link or an internal path.");return;}command("createLink",url);setUrl("");}}>Add link to selected text</button>{button("Remove link","unlink","Remove link")}</div>
  <div ref={editor} className="rich-editing-area" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-labelledby="announcement-message-label" onInput={update} onMouseUp={remember} onKeyUp={remember} onBlur={remember} onPaste={event=>{event.preventDefault();document.execCommand("insertText",false,event.clipboardData.getData("text/plain"));update();}}><AnnouncementContent document={initial.current}/></div>
  {error&&<p role="alert" className="notice error-notice">{error}</p>}<small>Up to 1,200 characters. Formatting is saved with this announcement; crawler text stays readable as plain text.</small>
 </div>;
}
