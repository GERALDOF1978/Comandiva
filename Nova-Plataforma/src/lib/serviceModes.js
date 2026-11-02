// Atendimento público do restaurante: valores ausentes preservam lojas antigas.
export const AVAILABLE_SERVICE_MODES=Object.freeze(["DELIVERY","PICKUP","TABLE","TAB"]);
export const DEFAULT_SERVICE_MODES=Object.freeze([...AVAILABLE_SERVICE_MODES]);
export function enabledServiceModes(value){
 if(!Array.isArray(value))return [...DEFAULT_SERVICE_MODES];
 return [...new Set(value.filter(mode=>AVAILABLE_SERVICE_MODES.includes(mode)))];
}
export function validServiceModes(value){
 return Array.isArray(value)&&value.length>0&&value.length<=AVAILABLE_SERVICE_MODES.length&&value.every(mode=>AVAILABLE_SERVICE_MODES.includes(mode))&&new Set(value).size===value.length;
}
