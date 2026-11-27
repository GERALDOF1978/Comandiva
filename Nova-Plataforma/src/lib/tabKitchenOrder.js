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
