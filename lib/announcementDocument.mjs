export const announcementFonts=["inherit","Arial","Georgia","Verdana","Tahoma","Times New Roman","Comfortaa","Nunito Sans"];
export function safeAnnouncementHref(value) {
 if(typeof value!=="string"||value.length>500||/[\\\u0000-\u0020]/.test(value))return false;
 if(value.startsWith("/")&&!value.startsWith("//"))return true;
 try{return new URL(value).protocol==="https:";}catch{return false;}
}
export function announcementDocument(value) {
 if(!value||value.version!==1||!Array.isArray(value.blocks)||value.blocks.length>120)return null;
 let length=0;const blocks=[];
 for(const block of value.blocks) {
  if(!block||!["paragraph","heading","bullet","number"].includes(block.type)||!["left","center","right","justify"].includes(block.align||"left")||!Array.isArray(block.runs)||block.runs.length>150)return null;
  const runs=[];
  for(const run of block.runs){
   if(!run||typeof run.text!=="string"||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(run.text))return null;
   length+=run.text.length;if(length>1200)return null;
   if(run.color&&!/^#[0-9a-f]{6}$/i.test(run.color)||run.fontSize&&(!Number.isInteger(run.fontSize)||run.fontSize<12||run.fontSize>36)||run.fontFamily&&!announcementFonts.includes(run.fontFamily)||run.href&&!safeAnnouncementHref(run.href))return null;
   runs.push({text:run.text,...(run.bold?{bold:true}:{}),...(run.italic?{italic:true}:{}),...(run.underline?{underline:true}:{}),...(run.color?{color:run.color}:{}),...(run.fontSize?{fontSize:run.fontSize}:{}),...(run.fontFamily?{fontFamily:run.fontFamily}:{}),...(run.href?{href:run.href}:{})});
  }
  blocks.push({type:block.type,align:block.align||"left",runs});
 }
 return {version:1,blocks};
}
export function announcementText(value) {
 const doc=announcementDocument(value);
 return doc?doc.blocks.map(block=>block.runs.map(run=>run.text).join("")).join("\n"):"";
}
export function plainAnnouncementDocument(text="") {
 return {version:1,blocks:String(text).split("\n").map(text=>({type:"paragraph",align:"left",runs:[{text}]}))};
}
