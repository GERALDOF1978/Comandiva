import React,{useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {buildTableOrderLine,tableProductStartingPrice} from "../lib/tableItemPricing.js";
import {pizzaStartingPrice} from "../lib/pizzaPricing.js";
import {togglePizzaQuarterFlavor} from "../lib/pizzaQuarterSelection.js";
import PizzaRoundPreview from "./PizzaRoundPreview.jsx";
const money=n=>(Number(n||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const amount=n=>Number.isFinite(Number(n))?Number(n):0;
const contrast=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex||""))return "#fff";const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.37?"#182638":"#fff"};
export default function TableProductComposer({product,onAdd,onClose,brandPrimary="#f97316",brandSecondary="#172b49"}){
 const[sizeIndex,setSizeIndex]=useState(0),[pizzaParts,setPizzaParts]=useState([null,null,null,null]),[crustIndex,setCrust]=useState(null),[extrasIndices,setExtras]=useState([]),[choices,setChoices]=useState({}),[groupStep,setStep]=useState(0),[error,setError]=useState("");
 const isPizza=product.productType==="pizza"&&!!product.pizzaConfig,config=product.pizzaConfig||{},sizes=config.sizes||[],flavors=config.flavors||[];
 const maxFlavors=Math.max(1,Math.min(4,amount(sizes[sizeIndex]?.maxFlavors)||1));
 const groups=Array.isArray(product.optionGroups)?product.optionGroups:[],currentGroup=groups[groupStep],selectedSize=(choices[0]||[])[0];
 const limit=g=>product.productType==="marmita"&&groupStep>0&&selectedSize!=null?amount(g?.limitsBySize?.[selectedSize]??g?.max??1):amount(g?.max??1);
 useEffect(()=>{const key=e=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[onClose]);
 useEffect(()=>{document.body.classList.add("tableComposerOpen");return()=>document.body.classList.remove("tableComposerOpen")},[]);
 const selection=useMemo(()=>{
  if(isPizza)return {productId:product.id,qty:1,pizzaSelection:{sizeIndex,quarterIndices:[...pizzaParts],crustIndex,extrasIndices}}
  return {productId:product.id,qty:1,optionSelection:groups.map((_,i)=>choices[i]||[])};
 },[isPizza,product.id,sizeIndex,pizzaParts,crustIndex,extrasIndices,choices,groups]);
 const validation=useMemo(()=>{try{if(isPizza&&(pizzaParts.some(i=>i===null)||new Set(pizzaParts).size>maxFlavors))throw Error("Complete as quatro partes da pizza respeitando o limite de "+maxFlavors+" sabor(es).");return {line:buildTableOrderLine(product,selection),error:""}}catch(e){return{line:null,error:String(e?.message||"Opções inválidas")}}},[product,selection,isPizza,pizzaParts,maxFlavors]);
 const starting=tableProductStartingPrice(product);
 function changeFlavor(index){setError("");setPizzaParts(prev=>togglePizzaQuarterFlavor(prev,index,maxFlavors))}
 function toggleExtra(i){setError("");setExtras(v=>v.includes(i)?v.filter(n=>n!==i):[...v,i])}
 function chooseOption(groupIndex,optionIndex,delta){setError("");const g=groups[groupIndex];if(!g)return;setChoices(prev=>{
  const existing=prev[groupIndex]||[],selected=(prev[0]||[])[0],max=product.productType==="marmita"&&groupIndex>0&&selected!=null?amount(g.limitsBySize?.[selected]??g.max??1):amount(g.max??1);
  const index=existing.indexOf(optionIndex),next=delta<0?(index<0?existing:existing.filter((_,i)=>i!==index)):max===1?(index<0?[optionIndex]:[]):index>=0&&!g.allowRepeat?existing.filter((_,i)=>i!==index):existing.length<max?[...existing,optionIndex]:existing;
  return groupIndex===0&&product.productType==="marmita"?{0:next}:{...prev,[groupIndex]:next}
 })}
 function submit(){if(!validation.line){setError(isPizza?"Complete as quatro partes da pizza, respeitando o limite de sabores.":"Complete as escolhas obrigatórias.");return}onAdd({...validation.line,key:"configured-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)});onClose()}
 const primary=/^#[0-9a-f]{6}$/i.test(brandPrimary)?brandPrimary:"#f97316",secondary=/^#[0-9a-f]{6}$/i.test(brandSecondary)?brandSecondary:"#172b49";
 return createPortal(<div className="tableComposerOverlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} style={{"--table-composer-primary":primary,"--table-composer-secondary":secondary,"--table-composer-on-primary":contrast(primary),"--table-composer-on-secondary":contrast(secondary)}}>
 <div className="tableComposer" role="dialog" aria-modal="true" aria-label={"Montar "+String(product.name||"Produto")}>
 <header className="tableComposerHeader"><div><small>PERSONALIZE SEU PEDIDO</small><h2>{product.name}</h2><p>{isPizza?"Escolha tamanho, sabores, borda e adicionais.":"Escolha as opções do restaurante."}</p></div><button type="button" className="tableComposerClose" aria-label="Fechar montagem" onClick={onClose}>×</button></header>
 <div className="tableComposerContent">
 {isPizza?<><section className="tableComposerSection"><h3>1. Escolha o tamanho</h3><div className="tableComposerSizeGrid">{sizes.map((size,i)=>{const price=pizzaStartingPrice(config,i);return price==null?null:<button key={i} type="button" className={sizeIndex===i?"selected":""} aria-pressed={sizeIndex===i} onClick={()=>{setSizeIndex(i);setPizzaParts([null,null,null,null]);setCrust(null);setExtras([]);setError("")}}><b>{size.name}</b><small>Até {size.maxFlavors} sabor(es)</small><strong>A partir de {money(price)}</strong></button>})}</div></section>
 <div className="tableComposerPizzaStickyPreview" role="group" aria-label="Sua pizza em montagem"><div className="tableComposerPizzaStickyGraphic"><PizzaRoundPreview parts={pizzaParts} flavors={flavors}/></div><div className="tableComposerPizzaStickyDetails"><b>🍕 Sua pizza</b><span>{sizes[sizeIndex]?.name||"Tamanho"} · Até {maxFlavors} sabor(es)</span><small aria-live="polite">{pizzaParts.filter(i=>i!==null).length} de 4 partes preenchidas</small><strong>{validation.line?"Total: "+money(validation.line.unitPriceCents):starting==null?"Escolha os sabores":"A partir de "+money(pizzaStartingPrice(config,sizeIndex)||0)}</strong></div></div>
 <section className="tableComposerSection"><h3>2. Monte sua pizza — até {maxFlavors} sabor(es)</h3>
 <p className="tableComposerHint" aria-live="polite">{new Set(pizzaParts.filter(i=>i!==null)).size} sabor(es) selecionado(s) • {sizes[sizeIndex]?.name||"Tamanho"}. Toque em um sabor para preencher as quatro partes automaticamente; toque novamente para retirar.</p>
 <div className="tableComposerFlavors">{flavors.map((flavor,i)=>{const price=flavor.pricesBySize?.[sizeIndex];const allowed=Number.isSafeInteger(price)&&price>0;const selected=pizzaParts.includes(i);return allowed?<button className={"tableComposerChoice tableComposerFlavorButton"+(selected?" selected":"")} key={i} type="button" aria-pressed={selected} onClick={()=>changeFlavor(i)}><span><b>{selected?"✓ ":""}{flavor.name}</b><small>{flavor.ingredients||"Ingredientes não informados"}</small></span><strong>{money(price)}</strong></button>:null})}</div></section>
 {Array.isArray(config.crusts)&&config.crusts.length>0&&<section className="tableComposerSection"><h3>3. Borda</h3><div className="tableComposerOptions"><button type="button" className={crustIndex===null?"selected":""} onClick={()=>setCrust(null)}>Sem borda</button>{config.crusts.map((x,i)=><button type="button" key={i} className={crustIndex===i?"selected":""} onClick={()=>setCrust(i)}>{x.name} <small>+{money(x.priceCents)}</small></button>)}</div></section>}
 {Array.isArray(config.extras)&&config.extras.length>0&&<section className="tableComposerSection"><h3>4. Adicionais</h3><div className="tableComposerOptions">{config.extras.map((x,i)=><button type="button" key={i} className={extrasIndices.includes(i)?"selected":""} onClick={()=>toggleExtra(i)}>{x.name} <small>+{money(x.priceCents)}</small></button>)}</div></section>}</>:<>
 <nav className="tableComposerGroupNav" aria-label="Grupos de opções">{groups.map((g,i)=><button type="button" key={i} className={groupStep===i?"selected":""} aria-current={groupStep===i?"step":undefined} onClick={()=>setStep(i)}>{g.name||"Grupo "+(i+1)}</button>)}</nav>
 {currentGroup&&<section className="tableComposerSection"><h3>{currentGroup.name||"Opções"}</h3><p className="tableComposerHint">Escolha {Math.max(amount(currentGroup.min),currentGroup.required?1:0)} a {limit(currentGroup)} opção(ões).</p><div className="tableComposerFlavors">{(currentGroup.options||[]).map((x,i)=>{const chosen=choices[groupStep]||[],count=chosen.filter(n=>n===i).length;return <div className="tableComposerChoice" key={i}><div><b>{x.name}</b><small>{amount(x.priceCents)>0?"+"+money(x.priceCents):"Incluso"}</small></div><div className="tableComposerCounter"><button type="button" disabled={!count} onClick={()=>chooseOption(groupStep,i,-1)} aria-label={"Retirar "+x.name}>−</button><strong>{count}</strong><button type="button" disabled={chosen.length>=limit(currentGroup)||(count>0&&!currentGroup.allowRepeat)} onClick={()=>chooseOption(groupStep,i,1)} aria-label={"Adicionar "+x.name}>+</button></div></div>})}</div></section>}
 <div className="tableComposerSteps"><button type="button" disabled={groupStep===0} onClick={()=>setStep(v=>v-1)}>Anterior</button><span>{groupStep+1} de {groups.length}</span><button type="button" disabled={groupStep>=groups.length-1} onClick={()=>setStep(v=>v+1)}>Próximo</button></div>
 </>}
 </div><footer className="tableComposerFooter"><div><small>Valor da unidade</small><strong>{validation.line?money(validation.line.unitPriceCents):starting==null?"Escolha as opções":"A partir de "+money(starting)}</strong></div>{error&&<p role="alert">{error}</p>}<button className="tableComposerSubmit" type="button" onClick={submit}>Adicionar ao pedido</button></footer>
 </div></div>,document.body)
}
