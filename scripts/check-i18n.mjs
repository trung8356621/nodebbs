import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const requireWeb = createRequire(path.resolve('apps/web/package.json'));
const { createTranslator } = requireWeb('next-intl');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = 'apps/web/src/i18n';
const english = read(`${dir}/messages/en-US.json`);
const vietnamese = read(`${dir}/messages/vi-VN.json`);
const namespaces = read(`${dir}/namespaces.json`);
const errors = [];
const flatten = (messages) => Object.fromEntries(Object.entries(messages).flatMap(([ns, values]) => Object.entries(values).map(([key, value]) => [`${ns}.${key}`, value])));
const en = flatten(english);
const vi = flatten(vietnamese);
const keys = Object.keys(en);
function equalKeys(a, b, label) {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a) || !(key in b)) errors.push(`${label}: missing key ${key}`);
  }
}
equalKeys(en, vi, 'web');
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((m) => m[1]).sort().join(',');
for (const key of keys) {
  for (const [locale, value] of [['en-US', en[key]], ['vi-VN', vi[key]]]) {
    if (typeof value !== 'string' || !value.trim()) { errors.push(`${locale}: empty ${key}`); continue; }
    if (/\p{Script=Han}/u.test(value) || value.includes('Pending translation')) errors.push(`${locale}: untranslated ${key}`);
  }
  if (placeholders(en[key]) !== placeholders(vi[key])) errors.push(`web: placeholder mismatch ${key}`);
}
for (const [locale, messages] of [['en-US', english], ['vi-VN', vietnamese]]) {
  const t = createTranslator({ locale, messages, onError: (error) => errors.push(`${locale}: ${error.message}`) });
  for (const key of keys) {
    const params=[...messages[key.split('.')[0]][key.split('.')[1]].matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>[m[1],'1']);
    t(key,Object.fromEntries(params));
  }
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : /\.jsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
}
let references = 0;
for (const file of files('apps/web/src').filter((f) => !f.includes(`${path.sep}i18n${path.sep}`))) {
  const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  const checkText = (p, value) => {
    if (!/\p{Script=Han}/u.test(value)) return;
    errors.push(`${file}:${p.node.loc.start.line}: hard-coded Chinese interface string`);
  };
  traverse(ast, {
    StringLiteral(p) { checkText(p, p.node.value); },
    JSXText(p) { checkText(p, p.node.value); },
    TemplateElement(p) { checkText(p, p.node.value.cooked || ''); },
    CallExpression(p) {
      if (p.node.callee.name !== 'pbnT' || p.node.arguments[0]?.type !== 'StringLiteral') return;
      references++;
      const key = p.node.arguments[0].value;
      if (!en[`${namespaces[key]}.${key}`]) errors.push(`${file}: unknown translation key ${key}`);
    },
  });
}
const apiSource = read('apps/api/src/i18n/messages/source.json');
const apiEn = read('apps/api/src/i18n/messages/en-US.json');
const apiVi = read('apps/api/src/i18n/messages/vi-VN.json');
equalKeys(apiSource, apiEn, 'api source/en');
equalKeys(apiEn, apiVi, 'api en/vi');
for (const key of Object.keys(apiSource)) {
  if (!apiEn[key]?.trim() || !apiVi[key]?.trim() || /\p{Script=Han}/u.test(apiEn[key] + apiVi[key])) errors.push(`api: untranslated ${key}`);
  if (placeholders(apiSource[key]) !== placeholders(apiEn[key]) || placeholders(apiEn[key]) !== placeholders(apiVi[key])) errors.push(`api: placeholder mismatch ${key}`);
}
const normalizedSources = new Set(Object.values(apiSource).map((s) => s.replace(/\{arg\d+\}/g, '{arg}')));
for (const file of files('apps/api/src').filter((f) => !/[\\/](scripts|i18n)[\\/]/.test(f))) {
  const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module' });
  const check = (p, value) => {
    if (!/\p{Script=Han}/u.test(value)) return;
    const envelope = p.findParent((q) => q.isObjectProperty() && ['message', 'error'].includes(q.node.key.name || q.node.key.value)
      || q.isNewExpression() && /Error$/.test(q.node.callee.name) || q.isThrowStatement()
      || q.isCallExpression() && ['badRequest', 'forbidden', 'unauthorized', 'notFound', 'internalServerError'].includes(q.node.callee.property?.name));
    const metadataFile = /config[\\/]rbac\.js$|services[\\/]moderation[\\/]adapters\.js$/.test(file);
    const metadata = metadataFile && p.parentPath.isObjectProperty() && ['label', 'description', 'placeholder'].includes(p.parent.key.name);
    if ((envelope || metadata) && !normalizedSources.has(value)) errors.push(`${file}:${p.node.loc.start.line}: backend message missing from catalog`);
  };
  traverse(ast, { StringLiteral(p) { check(p, p.node.value); }, TemplateLiteral(p) { check(p, p.node.quasis.map((q) => q.value.cooked).join('{arg}')); } });
}
console.log(JSON.stringify({ webKeysPerLocale: keys.length, webNamespaces: Object.keys(english), translatedReferences: references, backendTemplatesPerLocale: Object.keys(apiEn).length, hardCodedChineseUiStrings: errors.filter((error) => error.includes('hard-coded Chinese')).length, errors: errors.length }, null, 2));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
