// Importador de cardápio: CSV legado, CSV em reais e XLSX com várias abas.
// A leitura é local; não executa fórmulas nem macros.
const clean=v=>String(v??"").trim();
const norm=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const header=v=>norm(v).replace(/[\s/-]+/g,"_");
function fail(message){throw new Error(message)}
export function parseCSV(text){
  const input=String(text??"").replace(/^\uFEFF/,"");
  let quoted=false,commas=0,semis=0;
  for(const ch of input){if(ch==='"')quoted=!quoted;if(!quoted&&/[\r\n]/.test(ch))break;if(!quoted&&ch===",")commas++;if(!quoted&&ch===";")semis++}
  const delimiter=semis>commas?";":",",rows=[];let row=[],cell="";quoted=false;
  for(let i=0;i<input.length;i++){const ch=input[i];if(ch==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){row.push(cell);cell=""}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&input[i+1]==="\n")i++;row.push(cell);if(row.some(x=>clean(x)))rows.push(row);row=[];cell=""}else cell+=ch}
  if(quoted)fail("CSV com aspas incompletas.");
  row.push(cell);if(row.some(x=>clean(x)))rows.push(row);return rows;
}
function records(rows){if(!rows?.length)return[];const keys=rows[0].map(header);return rows.slice(1).filter(r=>r.some(v=>clean(v))).map((r,i)=>({...Object.fromEntries(keys.filter(Boolean).map(k=>[k,r[keys.indexOf(k)]??""])),_linha:i+2}))}
function price(row,label){const cents=clean(row.preco_centavos);const real=clean(row.preco??row.preco_reais??row.valor??row.valor_unitario);let n;if(cents!==""){if(!/^\d+$/.test(cents))fail("Preço inválido: "+label);n=Number(cents)}else{let t=real.replace(/^R\$\s*/i,"").replace(/\s/g,"");if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(t))fail("Preço inválido: "+label);n=Math.round(Number(t)*100)}if(!Number.isSafeInteger(n)||n<0||n>100000000)fail("Preço inválido: "+label);return n}
function validImage(value){try{const u=new URL(clean(value));return u.protocol==="https:"&&!u.username&&!u.password&&["images.unsplash.com","plus.unsplash.com","i.ibb.co","images.pexels.com"].includes(u.hostname)?u.href:""}catch{return ""}}
export function normalizeMenu(sheets){
  const entries=Object.entries(sheets);
  const find=(...names)=>entries.find(([k])=>names.includes(norm(k)))?.[1];
  const productRows=find("produtos","cardapio","products")||entries[0]?.[1];
  const keys=(productRows?.[0]||[]).map(header);
  if(!keys.includes("nome")||!keys.includes("categoria")||!["preco","preco_reais","preco_centavos","valor","valor_unitario"].some(k=>keys.includes(k)))fail("Planilha incompatível: informe categoria, nome e preço (preco ou preco_centavos).");
  const items=records(productRows);if(!items.length||items.length>250)fail("Informe entre 1 e 250 produtos.");
  const extras=records(find("adicionais","opcionais")),links=records(find("vinculos","vinculos_adicionais"));
  if(extras.length>250||links.length>7500)fail("Quantidade de adicionais acima do limite.");
  const byCode=new Map(),byGroup=new Map(),linked=new Map(),productsByCode=new Map();
  for(const x of extras){const code=norm(x.codigo??x.codigo_adicional),name=clean(x.nome??x.adicional),group=clean(x.grupo??x.grupo_adicionais);
    if(!name)fail("Adicional sem nome na linha "+x._linha);
    const option={name,priceCents:price(x,name)};
    if(code){if(byCode.has(code))fail("Código de adicional duplicado: "+code);byCode.set(code,option)}
    if(group){const k=norm(group);if(!byGroup.has(k))byGroup.set(k,{name:group,options:[]});byGroup.get(k).options.push(option)}
  }
  for(const x of items){const code=norm(x.codigo??x.codigo_produto);if(code){if(productsByCode.has(code))fail("Código de produto duplicado: "+code);productsByCode.set(code,x)}}
  for(const x of links){const p=norm(x.codigo_produto),a=norm(x.codigo_adicional);if(!productsByCode.has(p)||!byCode.has(a))fail("Vínculo inválido na linha "+x._linha+". Confira os códigos.");
    if(!linked.has(p))linked.set(p,new Map());linked.get(p).set(a,byCode.get(a))}
  const seen=new Set();
  return items.map(x=>{
    const name=clean(x.nome),category=clean(x.categoria),code=norm(x.codigo??x.codigo_produto),groupName=clean(x.grupo_adicionais);
    if(!name||!category||name.length>150||category.length>100)fail("Nome ou categoria inválidos na linha "+x._linha);
    const key=norm(category)+"|"+norm(name);if(seen.has(key))fail("Produto repetido na planilha: "+name);seen.add(key);
    const group=byGroup.get(norm(groupName));if(groupName&&!group&&!linked.has(code))fail("Grupo de adicionais não encontrado: "+groupName+" ("+name+")");
    const options=linked.has(code)?[...linked.get(code).values()]:(group?.options||[]);
    const unique=[...new Map(options.map(o=>[norm(o.name),o])).values()];
    if(unique.length>30)fail("Mais de 30 adicionais no produto "+name);
    return {nome:name,categoria:category,descricao:clean(x.descricao??x.ingredientes).slice(0,4000),preco_centavos:price(x,name),imagem_url:validImage(x.imagem_url??x.url_da_imagem),optionGroups:unique.length?[{name:groupName||"Adicionais",required:false,min:0,max:unique.length,allowRepeat:false,options:unique}]:[]};
  });
}
const utf8=new TextDecoder();
function parseXML(bytes){const xml=new DOMParser().parseFromString(utf8.decode(bytes),"application/xml");if(xml.getElementsByTagName("parsererror").length)fail("XML inválido na planilha.");return xml}
const tags=(node,name)=>Array.from(node.getElementsByTagNameNS("*",name));
const value=(node,name)=>tags(node,name)[0]?.textContent??"";
async function unzip(buffer){
  const b=new Uint8Array(buffer),v=new DataView(buffer);if(b.length>4*1024*1024||b.length<22)fail("Arquivo Excel inválido ou maior que 4 MB.");
  let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(v.getUint32(i,true)===0x06054b50){end=i;break}}
  if(end<0)fail("Arquivo XLSX inválido.");
  const count=v.getUint16(end+10,true);let p=v.getUint32(end+16,true),total=0;const files=new Map();if(count>500)fail("Planilha contém arquivos demais.");
  for(let i=0;i<count;i++){
    if(p+46>b.length||v.getUint32(p,true)!==0x02014b50)fail("Estrutura XLSX inválida.");
    const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),n=v.getUint16(p+28,true),e=v.getUint16(p+30,true),c=v.getUint16(p+32,true),offset=v.getUint32(p+42,true);
    const name=utf8.decode(b.subarray(p+46,p+46+n));p+=46+n+e+c;
    if(!/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))continue;
    total+=size;if(total>16*1024*1024||size>8*1024*1024||flags&1||offset+30>b.length||v.getUint32(offset,true)!==0x04034b50)fail("Planilha excede os limites ou está protegida.");
    const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);
    if(start+compressed>b.length)fail("Arquivo XLSX incompleto.");
    const data=b.subarray(start,start+compressed);let result;
    if(method===0)result=data;else if(method===8){if(typeof DecompressionStream!=="function")fail("Seu navegador não suporta XLSX. Atualize-o ou use CSV.");
      let stream;try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))}catch{fail("Atualize o navegador para importar Excel.")}
      const reader=stream.getReader(),chunks=[];let actual=0;try{for(;;){const {value,done}=await reader.read();if(done)break;actual+=value.byteLength;if(actual>size||actual>8*1024*1024){await reader.cancel();fail("Arquivo XLSX excede os limites.")}chunks.push(value)}}finally{reader.releaseLock()}
      result=new Uint8Array(actual);let pos=0;for(const chunk of chunks){result.set(chunk,pos);pos+=chunk.length}
    }else fail("Compressão Excel não suportada.");
    if(result.byteLength!==size)fail("Arquivo XLSX incompleto.");files.set(name,result);
  }return files
}
export async function readXLSX(buffer){
  const f=await unzip(buffer);const wb=f.get("xl/workbook.xml"),rels=f.get("xl/_rels/workbook.xml.rels");if(!wb||!rels)fail("Arquivo não é uma planilha XLSX válida.");
  const strings=f.has("xl/sharedStrings.xml")?tags(parseXML(f.get("xl/sharedStrings.xml")),"si").map(x=>tags(x,"t").map(t=>t.textContent).join("")):[];
  const links=new Map(tags(parseXML(rels),"Relationship").map(x=>[x.getAttribute("Id"),x.getAttribute("Target")]));
  const sheets=Object.create(null);
  for(const sheet of tags(parseXML(wb),"sheet")){
    const name=sheet.getAttribute("name");if(!["produtos","cardapio","products","adicionais","opcionais","vinculos","vinculos_adicionais"].includes(norm(name))&&Object.keys(sheets).length)continue;
    const relation=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")||sheet.getAttribute("r:id");
    const target=links.get(relation)||"",path=target.startsWith("/")?target.slice(1):"xl/"+target;
    if(!f.has(path))continue;
    const rows=[];for(const row of tags(parseXML(f.get(path)),"row")){if(rows.length>=8000)fail("Aba com mais de 8.000 linhas.");const values=[];for(const cell of tags(row,"c")){const ref=cell.getAttribute("r")||"",letters=ref.match(/^[A-Z]+/)?.[0];if(!letters)continue;let col=0;for(const letter of letters)col=col*26+letter.charCodeAt(0)-64;if(col>100)continue;
      const type=cell.getAttribute("t"),v=value(cell,"v");values[col-1]=type==="s"?(strings[Number(v)]??""):type==="inlineStr"?tags(cell,"t").map(t=>t.textContent).join(""):v;
    }if(values.some(v=>clean(v)))rows.push(Array.from(values,v=>v??""))}
    sheets[name]=rows;
  }return normalizeMenu(sheets);
}
export function googleSheetId(link){let u;try{u=new URL(clean(link))}catch{fail("Cole o link completo do Google Planilhas.")}const match=u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,150})(?:\/|$)/);if(u.protocol!=="https:"||u.hostname!=="docs.google.com"||!match||u.username||u.password)fail("Use um link válido do Google Planilhas.");return match[1]}
export async function readMenuFile(file){if(!file||file.size>4*1024*1024)fail("Arquivo maior que 4 MB.");if(/\.xlsx$/i.test(file.name))return readXLSX(await file.arrayBuffer());if(/\.csv$/i.test(file.name))return normalizeMenu({Produtos:parseCSV(await file.text())});fail("Selecione um arquivo CSV ou XLSX.")}
