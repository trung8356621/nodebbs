export function rejectDecorationCommerce() {
  throw Object.assign(new Error('Profile decoration commerce is unavailable; use badges for decoration and SEO packages for Credit purchases'),{statusCode:410});
}
