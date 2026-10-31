export {resolve} from './route-loader.mjs';
export async function load(url,context,nextLoad){
 if(/\/data\/(products|product_metadata|category_hierarchy)\.json$/.test(url)){const {readFile}=await import('node:fs/promises');return {format:'module',source:'export default '+await readFile(new URL(url),'utf8'),shortCircuit:true};}
 return nextLoad(url,context);
}
