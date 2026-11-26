export function normalizeWhatsappPhone(value) {
 if (typeof value !== "string" || !/^[+\d().\s-]+$/.test(value.trim())) return "";
 const digits = value.replace(/\D/g, "");
 if (value.trim().startsWith("+") || digits.length > 11) return /^55[1-9]\d{9,10}$/.test(digits) ? digits : "";
 return /^[1-9]\d{9,10}$/.test(digits) ? "55" + digits : "";
}
