// Content classification comes from the API; authored Markdown is never rewritten.
export function contentLinkRel(href, {policy='ugc', canonicalOrigin}={}) {
  const security='noopener noreferrer';
  try {
    const url=new URL(href,canonicalOrigin || 'https://internal.invalid');
    if(!['http:','https:'].includes(url.protocol))return security;
    if(canonicalOrigin && url.origin===new URL(canonicalOrigin).origin)return security;
    if(!canonicalOrigin && !/^(?:https?:)?\/\//i.test(href))return security;
    return security+(policy==='editorial'?'':policy==='paid'||policy==='sponsored'?' ugc sponsored':' ugc nofollow');
  } catch {return security;}
}
