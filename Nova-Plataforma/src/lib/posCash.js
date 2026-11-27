export function parseCashReceived(value) {
 const input = String(value).trim();
 if (!/^(?:\d{1,9}|\d{1,3}(?:\.\d{3}){1,2})(?:,\d{1,2})?$/.test(input)) return null;
 const [whole, fraction = ""] = input.replace(/\./g, "").split(",");
 return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
