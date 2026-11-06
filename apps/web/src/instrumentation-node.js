import http from 'node:http';
import https from 'node:https';
import { sanitizeEdgeHeaders } from './lib/proxy-forwarded-headers.js';

const servers = [http.Server, https.Server];
for (const Server of servers) {
  if (Server.prototype.__pbnEdgeHeaders) continue;
  const emit = Server.prototype.emit;
  Server.prototype.emit = function patchedEmit(event, req, ...rest) {
    if (event === 'request' && req?.headers && req.socket) {
      sanitizeEdgeHeaders(req.headers, {
        peerAddress: req.socket.remoteAddress,
        trustedEdges: process.env.TRUSTED_EDGE_PROXIES,
        socketEncrypted: Boolean(req.socket.encrypted),
      });
    }
    return emit.call(this, event, req, ...rest);
  };
  Server.prototype.__pbnEdgeHeaders = true;
}
