import apiClient from '@/lib/api';

/** Admin bank-payment APIs (never expects secrets in responses). */
export const bankPaymentAdminApi = {
  getOverview() {
    return apiClient.get('/bank-payment/admin/overview');
  },
  getConfig() {
    return apiClient.get('/bank-payment/admin/config');
  },
  listPackages() {
    return apiClient.get('/bank-payment/admin/packages');
  },
  createPackage(body) {
    return apiClient.post('/bank-payment/admin/packages', body);
  },
  patchPackage(code, body) {
    return apiClient.patch(`/bank-payment/admin/packages/${encodeURIComponent(code)}`, body);
  },
  listOrders(params = {}) {
    return apiClient.get('/bank-payment/admin/orders', params);
  },
  getOrder(orderId) {
    return apiClient.get(`/bank-payment/admin/orders/${encodeURIComponent(orderId)}`);
  },
  reconcileOrder(orderId) {
    return apiClient.post(`/bank-payment/admin/reconcile/${encodeURIComponent(orderId)}`);
  },
};
