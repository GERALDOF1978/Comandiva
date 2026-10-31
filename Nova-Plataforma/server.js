import http from "node:http";
import {readFile,stat} from "node:fs/promises";
import {existsSync} from "node:fs";
import {join,resolve,extname,sep} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

const root=fileURLToPath(new URL(".",import.meta.url));
const dist=resolve(root,"dist");
const apiRoot=resolve(root,"api");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".webmanifest":"application/manifest+json",".txt":"text/plain; charset=utf-8",".woff2":"font/woff2",".wasm":"application/wasm"};
const app=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");
    const pathname=decodeURIComponent(url.pathname);
    if(pathname==="/health"){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({ok:true}));return;}
    if(pathname.startsWith("/api/")){
      const name=pathname.slice(5);
      if(!/^[a-zA-Z0-9_-]+$/.test(name)){res.writeHead(404);res.end("Not found");return;}
      const file=join(apiRoot,name+".js");
      if(!existsSync(file)){res.writeHead(404);res.end("Not found");return;}
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>1048576){res.writeHead(413);res.end("Payload too large");return;}chunks.push(chunk);}
      const raw=Buffer.concat(chunks).toString("utf8");
      req.query=Object.fromEntries(url.searchParams);
      req.body=raw?(/application\/json/i.test(req.headers["content-type"]||"")?JSON.parse(raw):raw):{};
      res.status=function(code){this.statusCode=code;return this;};
      res.json=function(value){this.setHeader("Content-Type","application/json; charset=utf-8");this.end(JSON.stringify(value));return this;};
      res.send=function(value){if(typeof value==="object")return this.json(value);this.end(String(value));return this;};
      const {default:handler}=await import(pathToFileURL(file).href);
      if(typeof handler!=="function")throw Error("API handler missing");
      await handler(req,res);
      return;
    }
    if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);res.end("Method not allowed");return;}
    const target=resolve(dist,"."+pathname);
    if(target!==dist&&!target.startsWith(dist+sep)){res.writeHead(403);res.end("Forbidden");return;}
    let file=target;
    try{if(!(await stat(file)).isFile())file=join(dist,"index.html");}catch{file=join(dist,"index.html");}
    const data=await readFile(file);
    res.setHeader("Content-Type",mime[extname(file)]||"application/octet-stream");
    res.setHeader("Cache-Control",file.endsWith("index.html")||file.endsWith("firebase-messaging-sw.js")?"no-cache":"public, max-age=3600");
    res.end(req.method==="HEAD"?undefined:data);
  }catch(error){
    console.error("dishy_render_request_error",error);
    if(!res.headersSent){res.statusCode=500;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({error:"internal_error"}));}else res.end();
  }
});
const port=Number(process.env.PORT||10000);
app.listen(port,"0.0.0.0",()=>console.info("Dishy Render server listening on",port));
