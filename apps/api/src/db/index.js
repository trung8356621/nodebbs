import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { writeContext } from './write-context.js';
import env from '../config/env.js';
import * as schema from './schema.js';

const { Pool } = pg;

// 显式创建连接池，以便管理生命周期
export const pool = new Pool({ 
  connectionString: env.db.url,
  max: Number(process.env.DB_POOL_MAX || 10), // 连接池大小，可根据需求调整
  idleTimeoutMillis: 30000
});

// 处理连接池错误，防止后台连接断开导致进程崩溃
pool.on('error', (err) => {
  console.error('[数据库] 闲置连接发生异常错误:', err);
});

// 传入 schema 以启用查询构建器的智能提示和关系查询
const db = drizzle(pool, { schema });

// Existing service imports join only explicitly wrapped publishing transactions.
const contextualDb = new Proxy(db, {
  get(target, property) {
    const selected=writeContext.getStore()?.db || target;
    const value=Reflect.get(selected,property,selected);
    return typeof value==='function' ? value.bind(selected) : value;
  },
});
export async function atomicWrite(callback) {
  const context={db:null,afterCommit:[]};
  const result=await db.transaction(async tx=> {
    context.db=tx;
    return writeContext.run(context,callback);
  });
  // Listeners run outside the completed transaction and only after successful publication.
  for(const task of context.afterCommit) writeContext.exit(task);
  return result;
}
export default contextualDb;
