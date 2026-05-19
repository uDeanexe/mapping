const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const knexFactory = require('knex');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function connectionFromEnv(env = process.env) {
  const connection = (env.DB_CONNECTION || env.DATABASE_CONNECTION || 'sqlite').toLowerCase();
  return {
    connection,
    sqlitePath: env.DATABASE_PATH || './database/app.db',
    host: env.DB_HOST || '127.0.0.1',
    port: env.DB_PORT ? Number(env.DB_PORT) : connection === 'sqlserver' ? 1433 : 3306,
    database: env.DB_DATABASE || env.DB_NAME || 'mapping',
    user: env.DB_USER || env.DB_USERNAME || 'root',
    password: env.DB_PASSWORD || '',
    encrypt: String(env.DB_ENCRYPT || '0') === '1',
    trustServerCertificate: String(env.DB_TRUST_SERVER_CERTIFICATE || '1') === '1'
  };
}

function normalizeDialect(connection) {
  if (['mysql', 'mysql2'].includes(connection)) return 'mysql';
  if (['mssql', 'sqlserver', 'sqlsrv'].includes(connection)) return 'sqlserver';
  return 'sqlite';
}

function quoteIdentifier(dialect, identifier) {
  if (dialect === 'mysql') return `\`${identifier}\``;
  if (dialect === 'sqlserver') return `[${identifier}]`;
  return `"${identifier}"`;
}

function openDb(configOrPath) {
  const config =
    typeof configOrPath === 'string'
      ? { ...connectionFromEnv(), sqlitePath: configOrPath }
      : { ...connectionFromEnv(), ...(configOrPath || {}) };
  const dialect = normalizeDialect(config.connection);

  if (dialect === 'sqlite') {
    const dbPath = path.resolve(__dirname, '..', config.sqlitePath);
    ensureDir(path.dirname(dbPath));
    const raw = new sqlite3.Database(dbPath);
    raw.__dialect = 'sqlite';
    return raw;
  }

  const client = dialect === 'mysql' ? 'mysql2' : 'mssql';
  const connection =
    dialect === 'mysql'
      ? {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password
        }
      : {
          server: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          options: {
            encrypt: config.encrypt,
            trustServerCertificate: config.trustServerCertificate
          }
        };

  const knex = knexFactory({ client, connection, pool: { min: 0, max: 10 } });
  knex.__dialect = dialect;
  return knex;
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRawResult(dialect, raw) {
  if (dialect === 'mysql') {
    const rows = Array.isArray(raw) ? raw[0] : raw;
    return Array.isArray(rows) ? rows : [];
  }
  if (dialect === 'sqlserver') {
    if (Array.isArray(raw)) return raw;
    if (raw?.recordset) return raw.recordset;
    return [];
  }
  return raw;
}

function normalizeRunResult(dialect, raw) {
  if (dialect === 'mysql') {
    const info = Array.isArray(raw) ? raw[0] : raw;
    return { lastID: info?.insertId || 0, changes: info?.affectedRows || 0 };
  }
  if (dialect === 'sqlserver') {
    const rows = raw?.recordset || (Array.isArray(raw) ? raw : []);
    const lastID = rows?.[0]?.lastID || rows?.[0]?.id || 0;
    const changes = Array.isArray(raw?.rowsAffected) ? raw.rowsAffected[0] || 0 : 0;
    return { lastID, changes: changes || (lastID ? 1 : 0) };
  }
  return raw;
}

function transformSqlServerLimit(sql) {
  const limitMatch = sql.match(/\s+LIMIT\s+(\d+)\s*$/i);
  if (!limitMatch) return sql;
  const limit = limitMatch[1];
  const withoutLimit = sql.replace(/\s+LIMIT\s+\d+\s*$/i, '');
  return withoutLimit.replace(/^\s*SELECT\s+/i, `SELECT TOP ${limit} `);
}

function transformSql(dialect, sql) {
  if (dialect === 'sqlserver') return transformSqlServerLimit(sql);
  return sql;
}

function alterColumnType(dialect, type) {
  if (dialect === 'sqlserver') {
    if (/^TEXT$/i.test(type)) return 'NVARCHAR(MAX)';
    if (/^DATETIME$/i.test(type)) return 'DATETIME2';
    if (/^INTEGER\b/i.test(type)) return type.replace(/^INTEGER/i, 'INT');
  }
  if (dialect === 'mysql') {
    if (/^INTEGER\b/i.test(type)) return type.replace(/^INTEGER/i, 'INT');
  }
  return type;
}

function promisifyDb(db) {
  const dialect = db.__dialect || 'sqlite';

  if (dialect === 'sqlite') {
    return {
      dialect,
      exec(sql) {
        return new Promise((resolve, reject) => {
          db.exec(sql, (err) => (err ? reject(err) : resolve()));
        });
      },
      all(sql, params = []) {
        return new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
        });
      },
      get(sql, params = []) {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
        });
      },
      run(sql, params = []) {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
          });
        });
      },
      async columns(table) {
        const rows = await this.all(`PRAGMA table_info(${quoteIdentifier(dialect, table)})`);
        return rows.map((r) => ({ name: r.name, type: r.type }));
      },
      alterColumnType(type) {
        return alterColumnType(dialect, type);
      }
    };
  }

  return {
    dialect,
    async exec(sql) {
      for (const statement of splitSql(sql)) {
        await db.raw(transformSql(dialect, statement));
      }
    },
    async all(sql, params = []) {
      const raw = await db.raw(transformSql(dialect, sql), params);
      return normalizeRawResult(dialect, raw);
    },
    async get(sql, params = []) {
      const rows = await this.all(sql, params);
      return rows[0];
    },
    async run(sql, params = []) {
      let statement = transformSql(dialect, sql);
      if (dialect === 'sqlserver' && /^\s*INSERT\s+/i.test(statement)) {
        statement = `${statement}; SELECT SCOPE_IDENTITY() AS lastID`;
      }
      const raw = await db.raw(statement, params);
      return normalizeRunResult(dialect, raw);
    },
    async columns(table) {
      if (dialect === 'mysql') {
        return this.all(
          `
          SELECT COLUMN_NAME AS name, DATA_TYPE AS type
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          `,
          [table]
        );
      }
      return this.all(
        `
        SELECT COLUMN_NAME AS name, DATA_TYPE AS type
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        `,
        [table]
      );
    },
    alterColumnType(type) {
      return alterColumnType(dialect, type);
    }
  };
}

function tableSql(dialect, table, columns) {
  if (dialect === 'sqlserver') {
    return `
      IF OBJECT_ID(N'${table}', N'U') IS NULL
      CREATE TABLE ${table} (${columns.sqlserver.join(', ')})
    `;
  }
  return `CREATE TABLE IF NOT EXISTS ${table} (${columns[dialect].join(', ')})`;
}

async function createPortableSchema(db) {
  const id =
    db.dialect === 'mysql'
      ? 'id INT AUTO_INCREMENT PRIMARY KEY'
      : db.dialect === 'sqlserver'
        ? 'id INT IDENTITY(1,1) PRIMARY KEY'
        : 'id INTEGER PRIMARY KEY AUTOINCREMENT';
  const fixedId = db.dialect === 'sqlite' ? 'id INTEGER PRIMARY KEY' : 'id INT PRIMARY KEY';
  const text = db.dialect === 'sqlserver' ? 'NVARCHAR(MAX)' : 'TEXT';
  const shortText = db.dialect === 'sqlserver' ? 'NVARCHAR(255)' : db.dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT';
  const dt = db.dialect === 'sqlserver' ? 'DATETIME2 DEFAULT SYSDATETIME()' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
  const now = db.dialect === 'sqlserver' ? 'SYSDATETIME()' : 'CURRENT_TIMESTAMP';

  const c = (...cols) => ({ sqlite: cols, mysql: cols, sqlserver: cols });

  const tables = [
    ['node_types', c(fixedId, `name ${shortText} NOT NULL UNIQUE`, `label ${shortText} NOT NULL`, `icon ${shortText}`, `created_at ${dt}`)],
    [
      'nodes',
      c(
        id,
        'node_type_id INT NOT NULL',
        `code ${shortText} NOT NULL UNIQUE`,
        `name ${shortText}`,
        'latitude REAL',
        'longitude REAL',
        `address ${text}`,
        `photo_path ${shortText}`,
        `notes ${text}`,
        'topology_x INT DEFAULT 100',
        'topology_y INT DEFAULT 100',
        `created_at ${dt}`,
        `updated_at ${dt}`
      )
    ],
    [
      'links',
      c(
        id,
        'source_node_id INT NOT NULL',
        'target_node_id INT NOT NULL',
        `cable_type ${shortText}`,
        'core_count INT',
        `core_number ${shortText}`,
        `pon_name ${shortText}`,
        `odc_name ${shortText}`,
        `notes ${text}`,
        `created_at ${dt}`,
        `updated_at ${dt}`
      )
    ],
    ['photos', c(id, 'node_id INT NOT NULL', `file_path ${shortText} NOT NULL`, `caption ${text}`, `created_at ${dt}`)],
    ['activity_logs', c(id, `action ${shortText} NOT NULL`, `entity_type ${shortText} NOT NULL`, 'entity_id INT', `description ${text}`, `created_at ${dt}`)],
    ['users', c(id, `name ${shortText} NOT NULL`, `email ${shortText} NOT NULL UNIQUE`, `password_hash ${shortText} NOT NULL`, `role ${shortText} NOT NULL`, 'is_active INT NOT NULL DEFAULT 1', `created_at ${dt}`, `updated_at ${dt}`)],
    [
      'incidents',
      c(
        id,
        'node_id INT',
        `category ${shortText} NOT NULL`,
        `title ${shortText} NOT NULL`,
        `description ${text}`,
        `reporter_name ${shortText}`,
        `reporter_contact ${shortText}`,
        `photo_path ${shortText}`,
        `noc_admin_name ${shortText}`,
        `technician_name ${shortText}`,
        `technician_contact ${shortText}`,
        `technician_email ${shortText}`,
        `work_order_notes ${text}`,
        `technician_report ${text}`,
        `status ${shortText} NOT NULL DEFAULT 'reported'`,
        `assigned_at ${db.dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME'}`,
        `completed_at ${db.dialect === 'sqlserver' ? 'DATETIME2' : 'DATETIME'}`,
        `created_at ${dt}`,
        `updated_at ${dt}`
      )
    ],
    [
      'work_reports',
      c(
        id,
        'incident_id INT',
        'node_id INT',
        `technician_name ${shortText}`,
        `report_title ${shortText} NOT NULL`,
        `description ${text} NOT NULL`,
        `photo_path ${shortText}`,
        `status ${shortText} NOT NULL DEFAULT 'completed'`,
        `created_at ${dt}`,
        `updated_at ${dt}`
      )
    ]
  ];

  for (const [table, columns] of tables) {
    await db.exec(tableSql(db.dialect, table, columns));
  }

  try {
    await db.exec('CREATE UNIQUE INDEX links_unique_pair ON links(source_node_id, target_node_id)');
  } catch (_) {}

  return now;
}

async function initSchema(db, schemaPath) {
  if (db.dialect === 'sqlite') {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(sql);
    return;
  }
  await createPortableSchema(db);
}

module.exports = { ensureDir, openDb, promisifyDb, initSchema, connectionFromEnv };
