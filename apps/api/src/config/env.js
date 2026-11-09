/**
 * Configuración centralizada de base de datos y servidor para ObraNeta.
 */
export const config = {
  port: Number(process.env.PORT || 3001),
  db: {
    driver: process.env.DB_DRIVER || 'sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'obraneta_user',
    password: process.env.DB_PASSWORD || 'obraneta_password',
    database: process.env.DB_NAME || 'obraneta',
    testDatabase: process.env.DB_NAME_TEST || 'obraneta_test',
    sqlitePath: process.env.DB_PATH || './data/obraneta.sqlite',
    autoSeed: process.env.AUTO_SEED !== 'false'
  }
};
