import React,{useMemo,useState} from "react";
import {parseCatalogImport} from "../lib/catalogImport.js";

const cash = cents => (Number(cents)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function IfoodCatalogPreview({catalog,busy=false,onClose,onImport}){
  const catalogRows=useMemo(()=>{
    const result=[];
    (catalog?.categories||[]).forEach((cat,ci)=>{
      (cat.items||[]).forEach((raw,ii)=>{
        const item=raw?.item||raw,product=raw?.products?.[0]||item?.products?.[0]||{};
        const productName=String(product.name||item?.name||"Produto sem nome");
        const key=ci+":"+ii;
        let row=null;
        try{
          row=parseCatalogImport(JSON.stringify({categories:[{name:cat.name,template:cat.template,items:[raw]}]}),"catalogo-ifood.json").rows[0]||null;
        }catch{}
        result.push({key,category:cat.name,name:productName,row,ci,ii});
      });
    });
    return result;
  },[catalog]);
  const [selected,setSelected]=useState(()=>new Set(catalogRows.filter(x=>x.row).slice(0,250).map(x=>x.key)));
  const [search,setSearch]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("");
  const categories=[...new Set(catalogRows.map(x=>x.category))];
  const filtered=catalogRows.filter(x=>(!categoryFilter||x.category===categoryFilter)&&(!search||[x.name,x.category].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
  const available=catalogRows.filter(x=>x.row).length;
  function change(key,checked){
    setSelected(prev=>{const next=new Set(prev);if(checked&&next.size<250)next.add(key);if(!checked)next.delete(key);return next;});
  }
  function confirm(){
    const grouped=new Map();
    for(const row of catalogRows){
      if(!selected.has(row.key)||!row.row)continue;
      if(!grouped.has(row.ci))grouped.set(row.ci,{...catalog.categories[row.ci],items:[]});
      grouped.get(row.ci).items.push(catalog.categories[row.ci].items[row.ii]);
    }
    if(grouped.size)onImport([...grouped.values()]);
  }
  return <section role="dialog" aria-label="Prévia do catálogo iFood" style={{border:"1px solid var(--border-color,#d1d5db)",borderRadius:14,padding:16,margin:"16px 0",background:"var(--card-background,#fff)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><h3 style={{margin:0}}>Produtos encontrados no iFood</h3><p style={{margin:"4px 0"}}>{catalogRows.length} itens no catálogo • {available} produtos simples disponíveis para importar • {catalogRows.length-available} para revisar</p></div>
      <button type="button" onClick={onClose} disabled={busy}>Fechar</button>
    </div>
    <p style={{fontSize:13,margin:"8px 0"}}>Somente produtos simples podem ser importados automaticamente nesta versão. Pizzas, combos e itens com grupos de adicionais permanecem para revisão. Nenhum produto será alterado no iFood.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
      <label style={{flex:"1 1 220px"}}>Buscar produto<input style={{width:"100%"}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do produto"/></label>
      <label style={{flex:"1 1 160px"}}>Categoria<select style={{width:"100%"}} value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Todas</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    </div>
    <div style={{maxHeight:380,overflowY:"auto",border:"1px solid #d1d5db",borderRadius:8}}>
      {filtered.map(x=><label key={x.key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:"1px solid #e5e7eb",cursor:x.row?"pointer":"default"}}>
        <input type="checkbox" checked={selected.has(x.key)} disabled={!x.row||busy} onChange={e=>change(x.key,e.target.checked)}/>
        <span style={{flex:1,minWidth:0}}><strong>{x.name}</strong><small style={{display:"block",opacity:.75}}>{x.category}{!x.row?" • Revisão obrigatória":""}</small></span>
        <strong>{x.row?cash(x.row.preco_centavos):"—"}</strong>
      </label>)}
      {!filtered.length&&<p style={{padding:12}}>Nenhum produto corresponde à busca.</p>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:12}}>
      <span>{selected.size} de até 250 produtos selecionados</span>
      <div style={{display:"flex",gap:8}}>
        <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" onClick={confirm} disabled={busy||selected.size===0}>Revisar e importar selecionados</button>
      </div>
    </div>
  </section>;
}
