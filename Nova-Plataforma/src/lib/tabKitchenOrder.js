export function isTabKitchenOrder(order) {
 if (order.source === "TAB_KITCHEN") return true;
 return order.channel === "TABLE" && Boolean(order.tabId) && order.totalCents === 0 &&
  order.paymentStatus === "PENDING" && !order.paymentPurpose &&
  !/^(tabpayment_|tabpix_)/.test(order.id || "");
}

export function orderDisplayTotal(order) {
 if (!isTabKitchenOrder(order)) return order.totalCents;
 return order.tabItemsTotalCents ?? (order.items || []).reduce((sum, item) => sum + (Number(item.totalCents) || 0), 0);
}

function orderTime(value) {
 return value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN);
}

export function tabPaymentByOrder(orders) {
 const byTab = new Map();
 for (const order of orders) {
  if (!order.tabId || order.status === "CANCELLED" ||
      (order.paymentPurpose !== "TAB_CLOSE" && !/^(tabpayment_|tabpix_)/.test(order.id || ""))) continue;
  const time = orderTime(order.createdAt);
  if (!Number.isFinite(time) || !["PENDING","PAID"].includes(order.paymentStatus)) continue;
  if (!byTab.has(order.tabId)) byTab.set(order.tabId, []);
  byTab.get(order.tabId).push({time,order});
 }
 for (const payments of byTab.values()) payments.sort((a,b)=>a.time-b.time);
 const result = new Map();
 for (const order of orders) {
  if (!isTabKitchenOrder(order) || order.status === "CANCELLED") continue;
  const time = orderTime(order.createdAt);
  if (!Number.isFinite(time)) continue;
  const payment = byTab.get(order.tabId)?.find(entry=>entry.time>=time && entry.order.paymentStatus==="PAID") ??
    byTab.get(order.tabId)?.find(entry=>entry.time>=time && entry.order.paymentStatus==="PENDING");
  if (payment) result.set(order.id,payment.order);
 }
 return result;
}
