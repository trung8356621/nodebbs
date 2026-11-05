/**
 * Optional OPS multi-forum management adapter.
 * Parent/Child runtime must NOT depend on OPS-SERVER or Installation Key.
 * This stub reserves a future interface only.
 */
export function createOpsMultiForumAdapter() {
  return {
    status: 'unsupported',
    contract: null,
    async listInstallations() {
      return { supported: false, installations: [] };
    },
    async enrollInstallation() {
      return { supported: false, error: 'ops_adapter_unsupported' };
    },
    async syncInstallationRegistry() {
      return { supported: false, error: 'ops_adapter_unsupported' };
    },
  };
}
