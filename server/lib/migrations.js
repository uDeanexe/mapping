const bcrypt = require('bcryptjs');
const { connectionFromEnv, openDb, promisifyDb, initSchema } = require('./db');

async function ensureMigrationsTable(db) {
  if (db.dialect === 'sqlserver') {
    await db.exec(`
      IF OBJECT_ID(N'schema_migrations', N'U') IS NULL
      CREATE TABLE schema_migrations (
        id NVARCHAR(120) NOT NULL PRIMARY KEY,
        applied_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `);
    return;
  }

  const idType = db.dialect === 'mysql' || db.dialect === 'postgres' ? 'VARCHAR(120)' : 'TEXT';
  const appliedAtType = db.dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id ${idType} PRIMARY KEY,
      applied_at ${appliedAtType} DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function listAppliedMigrations(db) {
  try {
    const rows = await db.all('SELECT id FROM schema_migrations');
    return new Set(rows.map((r) => String(r.id)));
  } catch (_) {
    return new Set();
  }
}

async function markMigrationApplied(db, id) {
  await db.run('INSERT INTO schema_migrations (id) VALUES (?)', [id]);
}

function migrationList(schemaPathAbs) {
  return [
    {
      id: '001_init_schema',
      async up(db) {
        await initSchema(db, schemaPathAbs);
      }
    },
    {
      id: '002_incidents_add_columns',
      async up(db) {
        const addColumnType = (type) => (db.alterColumnType ? db.alterColumnType(type) : type);
        const columns = await db.columns('incidents');
        const columnNames = new Set(columns.map((c) => c.name));
        const incidentColumns = [
          ['noc_admin_name', 'TEXT'],
          ['technician_name', 'TEXT'],
          ['technician_contact', 'TEXT'],
          ['technician_email', 'TEXT'],
          ['work_order_notes', 'TEXT'],
          ['technician_report', 'TEXT'],
          ['photo_path', 'TEXT'],
          ['assigned_at', 'DATETIME'],
          ['completed_at', 'DATETIME']
        ];

        for (const [name, type] of incidentColumns) {
          if (!columnNames.has(name)) {
            await db.run(`ALTER TABLE incidents ADD COLUMN ${name} ${addColumnType(type)}`);
          }
        }
      }
    },
    {
      id: '003_users_add_columns',
      async up(db) {
        const addColumnType = (type) => (db.alterColumnType ? db.alterColumnType(type) : type);
        const userColumns = await db.columns('users');
        const userColumnNames = new Set(userColumns.map((c) => c.name));
        for (const [name, type] of [
          ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
          ['updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
        ]) {
          if (!userColumnNames.has(name)) {
            await db.run(`ALTER TABLE users ADD COLUMN ${name} ${addColumnType(type)}`);
          }
        }
      }
    },
    {
      id: '004_incidents_normalize_status',
      async up(db) {
        await db.run("UPDATE incidents SET status = 'reported' WHERE status = 'open'");
        await db.run("UPDATE incidents SET status = 'closed' WHERE status IS NULL OR status = ''");
      }
    },
    {
      id: '005_seed_node_types_and_superadmin',
      async up(db) {
        const defaultNodeTypes = [
          [1, 'odc', 'ODC', 'odc.png'],
          [2, 'pon', 'PON', 'pon.png'],
          [3, 'box', 'Box / ODP', 'box.png'],
          [4, 'pole', 'Tiang', 'pole.png'],
          [5, 'customer', 'Customer', 'customer.png'],
          [6, 'server', 'Server', 'server.png'],
          [7, 'olc', 'OLC', 'olc.png']
        ];

        for (const [id, name, label, icon] of defaultNodeTypes) {
          const exists = await db.get('SELECT id FROM node_types WHERE id = ? OR name = ? LIMIT 1', [id, name]);
          if (!exists) {
            await db.run('INSERT INTO node_types (id, name, label, icon) VALUES (?, ?, ?, ?)', [id, name, label, icon]);
          }
        }

        const defaultEmail = process.env.DEFAULT_SUPERADMIN_EMAIL || 'jonusadeveloper@gmail.com';
        const defaultPassword = process.env.DEFAULT_SUPERADMIN_PASSWORD || 'superadmin123';
        const existingSuperadmin = await db.get('SELECT id FROM users WHERE role = ? LIMIT 1', ['superadmin']);
        if (!existingSuperadmin) {
          const passwordHash = await bcrypt.hash(defaultPassword, 10);
          await db.run(
            'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
            ['Super Admin', defaultEmail, passwordHash, 'superadmin', 1]
          );
        }
      }
    },
    {
      id: '006_optional_seed_demo',
      async up(db) {
        if (String(process.env.AUTO_SEED_DEMO || '0').trim() !== '1') return;
        const nodeCountRow = await db.get('SELECT COUNT(*) AS total FROM nodes');
        const nodeCount = Number(nodeCountRow?.total || 0);
        if (nodeCount > 0) return;

        await db.run(
          `
          INSERT INTO nodes (node_type_id, code, name, latitude, longitude, address, notes)
          VALUES
            (1, 'ODC-DEMO-01', 'ODC Demo', -6.2615, 107.1528, 'Demo', 'Auto seed demo'),
            (2, 'PON-DEMO-01', 'PON Demo', -6.2621, 107.1540, 'Demo', 'Auto seed demo'),
            (3, 'ODP-DEMO-01', 'ODP Demo', -6.2630, 107.1552, 'Demo', 'Auto seed demo')
          `
        );

        const nodes = await db.all('SELECT id, code FROM nodes WHERE code IN (?, ?, ?) ORDER BY id ASC', [
          'ODC-DEMO-01',
          'PON-DEMO-01',
          'ODP-DEMO-01'
        ]);
        const byCode = new Map(nodes.map((n) => [n.code, n.id]));
        if (byCode.get('ODC-DEMO-01') && byCode.get('PON-DEMO-01')) {
          await db.run(
            `
            INSERT INTO links (source_node_id, target_node_id, cable_type, core_count, notes)
            VALUES (?, ?, ?, ?, ?)
            `,
            [byCode.get('ODC-DEMO-01'), byCode.get('PON-DEMO-01'), 'FO', 12, 'Auto seed demo']
          );
        }
      }
    }
    ,
    {
      id: '007_optional_seed_demo_incidents',
      async up(db) {
        if (String(process.env.AUTO_SEED_DEMO || '0').trim() !== '1') return;
        const incidentCountRow = await db.get('SELECT COUNT(*) AS total FROM incidents');
        const incidentCount = Number(incidentCountRow?.total || 0);
        if (incidentCount > 0) return;

        const node = await db.get('SELECT id, code FROM nodes ORDER BY id ASC LIMIT 1');
        const nodeId = node?.id || null;

        await db.run(
          `
          INSERT INTO incidents
          (
            node_id, category, title, description, reporter_name, reporter_contact,
            noc_admin_name, work_order_notes, status
          )
          VALUES
          (?, 'internet_mati', 'Internet mati total', 'Tidak ada koneksi sejak pagi. Modem LOS.', 'User Demo', '08xxxx', 'NOC Demo', 'Cek redaman, pastikan patchcord, follow SOP. Update via WA.', 'reported'),
          (?, 'kerusakan', 'Kabel drop putus', 'Kabel terlihat putus di dekat tiang.', 'User Demo', '08xxxx', 'NOC Demo', 'Bawa dropcore cadangan + konektor. Dokumentasikan foto sebelum/sesudah.', 'reported')
          `,
          [nodeId, nodeId]
        );
      }
    }
  ];
}

async function ensureDatabaseExists() {
  const env = connectionFromEnv(process.env);
  const connection = (env.connection || 'sqlite').toLowerCase();
  const dialect = ['mysql', 'mysql2'].includes(connection)
    ? 'mysql'
    : ['mssql', 'sqlserver', 'sqlsrv'].includes(connection)
      ? 'sqlserver'
      : ['postgres', 'postgresql', 'pg'].includes(connection)
        ? 'postgres'
        : 'sqlite';
  if (dialect === 'sqlite') return;
  if (dialect === 'postgres') return; // Supabase/managed Postgres: create DB is not supported here.
  if (String(process.env.ALLOW_DB_CREATE || '0').trim() !== '1') return;

  const dbName = env.database;
  if (!dbName) return;

  // NOTE: Connecting to the MySQL/MariaDB system DB (`mysql`) often fails for
  // restricted app users. `information_schema` is generally readable and works
  // as a safe bootstrap DB for CREATE DATABASE checks.
  const mysqlBootstrapDb =
    process.env.DB_ADMIN_DATABASE ||
    process.env.MYSQL_ADMIN_DATABASE ||
    process.env.MARIADB_ADMIN_DATABASE ||
    'information_schema';

  const adminConfig =
    dialect === 'mysql'
      ? {
          connection: 'mysql',
          host: env.host,
          port: env.port,
          database: mysqlBootstrapDb,
          user: env.user,
          password: env.password
        }
      : {
          connection: 'sqlserver',
          host: env.host,
          port: env.port,
          database: 'master',
          user: env.user,
          password: env.password,
          encrypt: env.encrypt,
          trustServerCertificate: env.trustServerCertificate
        };

  const rawAdmin = openDb(adminConfig);
  const adminDb = promisifyDb(rawAdmin);

  try {
    if (dialect === 'mysql') {
      await adminDb.exec(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } else {
      const safeDbName = dbName.replace(/]/g, ']]').replace(/'/g, "''");
      await adminDb.exec(`
        IF DB_ID(N'${safeDbName}') IS NULL
        CREATE DATABASE [${safeDbName}]
      `);
    }
  } finally {
    try {
      await rawAdmin.destroy?.();
    } catch (_) {}
  }
}

async function runMigrations(db, schemaPathAbs) {
  await ensureMigrationsTable(db);
  const applied = await listAppliedMigrations(db);
  const migrations = migrationList(schemaPathAbs);
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await m.up(db);
    await markMigrationApplied(db, m.id);
  }
}

module.exports = { ensureDatabaseExists, runMigrations };
