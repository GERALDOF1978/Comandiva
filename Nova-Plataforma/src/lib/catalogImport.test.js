import test from "node:test";
import assert from "node:assert/strict";
import {parseCatalogImport} from "./catalogImport.js";

test("CSV Dishy preserva preço em centavos e cabeçalhos originais",()=>{
  const result=parseCatalogImport("categoria,nome,descricao,preco_centavos,imagem_url\nPizzas,Refrigerante,2 litros,1200,\n","cardapio.csv");
  assert.equal(result.source,"csv");
  assert.equal(result.rows[0].preco_centavos,1200);
  assert.equal(result.rows[0].nome,"Refrigerante");
});
test("CSV exportado pelo Excel aceita ponto e vírgula e vírgula decimal",()=>{
  const result=parseCatalogImport("Categoria;Nome;Descrição;Preço\nBebidas;Suco;Natural;R$ 8,50\n","itens.csv");
  assert.equal(result.rows[0].preco_centavos,850);
});
test("CSV com aspas mantém separadores na descrição",()=>{
  const result=parseCatalogImport('categoria,nome,descricao,preco_centavos\nLanches,Especial,"Pão, queijo e alface",2550\n',"produtos.csv");
  assert.equal(result.rows[0].descricao,"Pão, queijo e alface");
});
test("CSV rejeita preço negativo e entradas sem preço",()=>{
  assert.throws(()=>parseCatalogImport("categoria,nome,preco_centavos\nBebidas,Refri,-10\n","a.csv"));
  assert.throws(()=>parseCatalogImport("categoria,nome,preco\nBebidas,Refri,\n","a.csv"));
});
test("JSON catálogo iFood importa simples e separa pizzas/complementos",()=>{
  const example={categories:[
    {name:"Bebidas",template:"DEFAULT",items:[{item:{type:"DEFAULT",price:{value:7.5}},products:[{name:"Água",description:"500 ml"}],optionGroups:[],options:[]}]},
    {name:"Pizzas",template:"PIZZA",items:[{item:{type:"PIZZA",price:{value:49}},products:[{name:"Grande 4 sabores"}]}]},
    {name:"Lanches",template:"DEFAULT",items:[{item:{type:"DEFAULT",price:{value:30}},products:[{name:"X Tudo"}],optionGroups:[{name:"Extras"}]}]}
  ]};
  const result=parseCatalogImport(JSON.stringify(example),"ifood.json");
  assert.equal(result.source,"ifood-json");
  assert.deepEqual(result.rows.map(r=>r.nome),["Água"]);
  assert.equal(result.rows[0].preco_centavos,750);
  assert.equal(result.skipped.length,2);
});
test("JSON inválido e arquivos desconhecidos não são aceitos",()=>{
  assert.throws(()=>parseCatalogImport("[]","cardapio.xlsx"),/CSV/);
  assert.throws(()=>parseCatalogImport("{","cardapio.json"),/JSON inválido/);
});
