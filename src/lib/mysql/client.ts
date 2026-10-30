import mysql, { Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function isMysqlConfigured(): boolean {
  return Boolean(
    (process.env.MYSQL_HOST || process.env.HOSTINGER_MYSQL_HOST) &&
    (process.env.MYSQL_USER || process.env.HOSTINGER_MYSQL_USER) &&
    (process.env.MYSQL_PASSWORD || process.env.HOSTINGER_MYSQL_PASSWORD) &&
    (process.env.MYSQL_DATABASE || process.env.HOSTINGER_MYSQL_DATABASE)
  );
}

export function getMysqlPool(): Pool | null {
  if (!isMysqlConfigured()) return null;
  if (!pool) {
    const host = process.env.MYSQL_HOST || process.env.HOSTINGER_MYSQL_HOST;
    const user = process.env.MYSQL_USER || process.env.HOSTINGER_MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD || process.env.HOSTINGER_MYSQL_PASSWORD;
    const database = process.env.MYSQL_DATABASE || process.env.HOSTINGER_MYSQL_DATABASE;
    const port = Number(process.env.MYSQL_PORT || process.env.HOSTINGER_MYSQL_PORT || 3306);

    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      ssl: process.env.MYSQL_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}
