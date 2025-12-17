import pkg from 'pg';
const { Pool } = pkg;

const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'xdb_user',
  password: 'password',
  database: 'xrp_gamma',
});

const targetPool = new Pool({
  host: 'localhost',
  port: 5656,
  user: 'postgres',
  password: 'richlist_postgres_2025',
  database: 'xrp_list_db',
});

const TABLES = ['xrp_price', 'stats', 'top10percentages', 'top18accountstats', 'wallets'];

async function migrateTable(tableName) {
  try {
    console.log(`\nMigrating table: ${tableName}`);
    
    // Get table schema from source
    const schemaResult = await sourcePool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    if (schemaResult.rows.length === 0) {
      console.warn(`⚠ Table ${tableName} not found in source database`);
      return;
    }

    // Drop existing table in target if it exists
    await targetPool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    console.log(`  ✓ Dropped existing table`);

    // Create table in target
    const createTableSQL = `CREATE TABLE ${tableName} (`;
    const columns = schemaResult.rows.map((col) => {
      let colDef = `"${col.column_name}" ${col.data_type}`;
      if (col.column_default && !col.column_default.includes('_seq')) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      if (col.is_nullable === 'NO') {
        colDef += ` NOT NULL`;
      }
      return colDef;
    });
    
    const finalSQL = createTableSQL + columns.join(', ') + ')';
    await targetPool.query(finalSQL);
    console.log(`  ✓ Created table schema`);

    // Copy data from source to target in batches
    const dataResult = await sourcePool.query(`SELECT * FROM ${tableName}`);
    
    if (dataResult.rows.length === 0) {
      console.log(`  ✓ No data to copy`);
      return;
    }

    const columnNames = schemaResult.rows.map(c => c.column_name);
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < dataResult.rows.length; i += BATCH_SIZE) {
      const batch = dataResult.rows.slice(i, i + BATCH_SIZE);
      const values = [];
      let placeholderIdx = 1;
      const placeholders = batch.map(() => {
        const ph = columnNames.map(() => `$${placeholderIdx++}`).join(', ');
        return `(${ph})`;
      }).join(', ');

      for (const row of batch) {
        for (const col of columnNames) {
          values.push(row[col]);
        }
      }

      const insertSQL = `INSERT INTO ${tableName} (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders}`;
      await targetPool.query(insertSQL, values);
      insertedCount += batch.length;
      console.log(`  Progress: ${insertedCount}/${dataResult.rows.length} rows`);
    }

    console.log(`  ✓ Inserted ${insertedCount} rows`);

  } catch (error) {
    console.error(`✗ Error migrating ${tableName}:`, error.message);
  }
}

async function main() {
  try {
    console.log('Starting table migration from xrp_gamma to xrp_list_db...\n');

    for (const table of TABLES) {
      await migrateTable(table);
    }

    console.log('\n✓ Migration completed!');
  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
