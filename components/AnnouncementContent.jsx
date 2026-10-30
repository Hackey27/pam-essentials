import {announcementDocument,plainAnnouncementDocument} from "@/lib/announcementDocument.mjs";
export function AnnouncementContent({document,body="",className=""}) {
 const doc=announcementDocument(document)||plainAnnouncementDocument(body);
 return <div className={"announcement-rich-text "+className}>{doc.blocks.map((block,index)=>{
  const Tag=block.type==="heading"?"h3":"p";
  return <Tag key={index} style={{textAlign:block.align}} className={block.type==="bullet"?"rich-bullet":block.type==="number"?"rich-number":undefined}>{block.type==="number"&&<span aria-hidden="true">{doc.blocks.slice(0,index+1).filter(b=>b.type==="number").length}. </span>}{block.runs.map((run,i)=>{
   const text=<span style={{fontWeight:run.bold?700:undefined,fontStyle:run.italic?"italic":undefined,textDecoration:run.underline?"underline":undefined,color:run.color,fontSize:run.fontSize?run.fontSize+"px":undefined,fontFamily:run.fontFamily==="inherit"?undefined:run.fontFamily==="Comfortaa"?"\"Comfortaa Variable\", Comfortaa, sans-serif":run.fontFamily==="Nunito Sans"?"\"Nunito Sans Variable\", \"Nunito Sans\", sans-serif":run.fontFamily}}>{run.text}</span>;
   return run.href?<a key={i} href={run.href} target={run.href.startsWith("https:")?"_blank":undefined} rel="noopener noreferrer">{text}</a>:<span key={i}>{text}</span>;
  })}</Tag>;
 })}</div>;
}
