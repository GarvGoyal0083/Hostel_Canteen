import mysql, { Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getMysqlCredentials() {
  const host =
    process.env.MYSQL_HOST ||
    process.env.HOSTINGER_MYSQL_HOST ||
    process.env.DATABASE_HOST ||
    process.env.DB_HOST;

  const user =
    process.env.MYSQL_USER ||
    process.env.HOSTINGER_MYSQL_USER ||
    process.env.DATABASE_USER ||
    process.env.DB_USER;

  const password =
    process.env.MYSQL_PASSWORD ||
    process.env.HOSTINGER_MYSQL_PASSWORD ||
    process.env.DATABASE_PASSWORD ||
    process.env.DATABASE_PASS ||
    process.env.DB_PASSWORD;

  const database =
    process.env.MYSQL_DATABASE ||
    process.env.HOSTINGER_MYSQL_DATABASE ||
    process.env.DATABASE_NAME ||
    process.env.DB_NAME;

  const port = Number(
    process.env.MYSQL_PORT ||
      process.env.HOSTINGER_MYSQL_PORT ||
      process.env.DATABASE_PORT ||
      process.env.DB_PORT ||
      3306
  );

  return { host, user, password, database, port };
}

export function isMysqlConfigured(): boolean {
  const { host, user, password, database } = getMysqlCredentials();
  return Boolean(host && user && password && database);
}

export function getMysqlPool(): Pool | null {
  if (!isMysqlConfigured()) return null;
  if (!pool) {
    const { host, user, password, database, port } = getMysqlCredentials();

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
      // Hostinger shared hosting Remote MySQL does not use SSL
      ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}
