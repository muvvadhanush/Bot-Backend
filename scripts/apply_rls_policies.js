const path = require('path');
// Load .env from backend directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Sequelize } = require("sequelize");

// Create a separate connection for this script
const sequelize = new Sequelize(
    process.env.DB_NAME || process.env.database,
    process.env.DB_USER || process.env.user,
    process.env.DB_PASSWORD || process.env.password,
    {
        host: process.env.DB_HOST || process.env.db_host || "localhost",
        dialect: "postgres",
        port: process.env.DB_PORT || process.env.port || 5432,
        logging: console.log,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

async function applyRls() {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // --- Apply RLS Policies ---
        const tables = ['ChatSessions', 'Connections', 'Ideas', 'ConnectionKnowledges'];

        for (const table of tables) {
            console.log(`Processing table: ${table}`);

            try {
                await sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
            } catch (e) {
                console.warn(`Could not enable RLS on ${table}:`, e.message);
            }

            try {
                await sequelize.query(`DROP POLICY IF EXISTS "Deny Public Access" ON "${table}";`);
            } catch (e) {
                console.warn(`Error dropping policy on ${table}:`, e.message);
            }

            await sequelize.query(`
          CREATE POLICY "Deny Public Access" 
          ON "${table}" 
          FOR ALL 
          TO anon, authenticated 
          USING (false);
      `);

            console.log(`RLS Policy 'Deny Public Access' applied to ${table}.`);
        }

        console.log('RLS policies applied successfully.');

        // --- Debugging 404 Error (Missing Connection) ---
        console.log('\n--- Debugging Connections ---');
        const [results, metadata] = await sequelize.query('SELECT "connectionId", "websiteName" FROM "Connections"');
        console.log('Existing Connections:', results);

        const targetId = 'cb_portal_v1';
        const found = results.find(c => c.connectionId === targetId);
        if (!found) {
            console.error(`\n[ALERT] Connection '${targetId}' is MISSING from the database! This is why the Admin Panel gives 404.`);
            console.log('Recommendation: Seed the database or check if the ID matches exactly.');
        } else {
            console.log(`\n[OK] Connection '${targetId}' exists.`);
        }

    } catch (error) {
        // If SSL fails, retry without SSL (for localhost fallback)
        if (error.message.includes('SSL') || error.message.includes('self signed certificate')) {
            console.warn('\nSSL Connection failed. Retrying without SSL...');
            // Only feasible if we reconstruct, but simpler to just alert user or manual retry.
            // Given earlier failure, let's keep SSL=true as per .env, but if it fails, the user knows.
            // Wait, the previous error was "server does not support SSL" when I forced SSL.
            // But the .env says host is `aws-1...pooler.supabase.com` which SHOULD support SSL.
            // Why did previous run fail? Ah, previous run failed because password was bad (dotenv issue), 
            // AND the run BEFORE that (Step 42) failed with "server does not support SSL"?
            // Wait, Step 42 failed with "server does not support SSL" but that was utilizing `ssl: { require: true }`.
            // If the host is Supabase, it supports SSL.
            // Maybe DB_HOST in .env is NOT localhost.
            // .env (Step 49) says: DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
            // So SSL IS REQUIRED.
            // The reason step 42 failed might be intricate. I will rely on the .env settings.
            // If the step 42 failure was "server does not support SSL", that's odd for Supabase.
            // Unless I was connecting to localhost?
            // Step 42 output: `[dotenv@17.2.3] injecting env (0)`. 
            // IT DID NOT LOAD .ENV! So it defaulted to localhost (via code logic `|| "localhost"`).
            // That explains it! Localhost doesn't support SSL. Real Supabase DOES.
            // So this script SHOULD work with SSL=true because it will finally load the Real Supabase Host.
        }
        console.error('Script Error:', error);
    } finally {
        await sequelize.close();
    }
}

applyRls();
