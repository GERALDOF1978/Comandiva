// Roteador pequeno para manter o Dishy dentro do limite de funções do Vercel Hobby.
// As outras APIs permanecem com seus caminhos diretos. Não altera comportamento das rotas.
import lookupCep from "../server-api/lookup-cep.js";
import deliveryRoute from "../server-api/delivery-route.js";
import deliverySheet from "../server-api/delivery-sheet.js";

const handlers=Object.freeze({
  "lookup-cep":lookupCep,
  "delivery-route":deliveryRoute,
  "delivery-sheet":deliverySheet
});

export default async function handler(req,res){
  const route=String(req.query?.route||"");
  const selected=handlers[route];
  if(!selected)return res.status(404).json({error:"route_not_found"});
  return selected(req,res);
}
