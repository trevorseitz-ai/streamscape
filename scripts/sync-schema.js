const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncSchema() {
  console.log('🔍 Fetching live schema details via RPC...');

  // This calls the SQL function we created in the Supabase dashboard
  const { data, error } = await supabase.rpc('get_schema_details');

  if (error) {
    console.error('❌ RPC Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ No tables found in the public schema.');
    return;
  }

  // Organize the flat list of columns into a table-based object
  const schema = {};
  data.forEach(row => {
    if (!schema[row.table_name]) schema[row.table_name] = [];
    schema[row.table_name].push({ name: row.column_name, type: row.data_type });
  });

  let markdown = '# 🗃️ Database Schema (Auto-generated)\n\n';
  markdown += `*Last Updated: ${new Date().toLocaleString()}*\n\n---\n\n`;

  for (const [tableName, columns] of Object.entries(schema)) {
    markdown += `## 📋 Table: ${tableName}\n\n`;
    markdown += '| Column | Type |\n| :--- | :--- |\n';
    columns.forEach(col => {
      markdown += `| \`${col.name}\` | ${col.type} |\n`;
    });
    markdown += '\n';
  }

  const docsPath = path.resolve(__dirname, '../docs/database_schema.md');
  fs.writeFileSync(docsPath, markdown);
  console.log('✅ Documentation updated at docs/database_schema.md');
}

syncSchema();
