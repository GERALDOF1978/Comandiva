// Public menu remains readable while the restaurant pauses new orders.
export function isAcceptingOrders(settings) {
  return settings?.acceptingOrders !== false;
}
