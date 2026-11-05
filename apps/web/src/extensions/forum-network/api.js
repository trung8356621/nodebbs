import api from '@/lib/api';

export const forumNetworkApi = {
  overview: () => api.get('/forum/network/overview'),
  status: () => api.get('/forum/network/status'),
  enableParent: () => api.post('/forum/network/enable-parent'),
  children: () => api.get('/forum/network/children'),
  templates: () => api.get('/forum/network/templates'),
  template: (id) => api.get(`/forum/network/templates/${encodeURIComponent(id)}`),
  policies: () => api.get('/forum/network/policies'),
  policyApplications: (limit = 50) => api.get(`/forum/network/policy-applications?limit=${limit}`),
  publishFromTemplate: (body) => api.post('/forum/network/policies/publish-from-template', body || {}),
  applyPolicy: (pkg) => api.post('/forum/network/policies/apply', { package: pkg }),
  draftChild: (body) => api.post('/forum/network/children/draft', body),
};
