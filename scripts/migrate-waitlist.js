const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Automatically trim hidden spaces or line breaks from the .env file
const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

console.log("=== DIAGNOSTICS ===");
console.log("URL Start:  ", url.substring(0, 20) + "...");
console.log("KEY Start:  ", key.substring(0, 15) + "...");
console.log("KEY Length: ", key.length, "characters");
console.log("===================");

// Safety kill switch
if (!key) {
  console.error("🛑 FATAL: No key found. Exiting.");
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

// ⚠️ IMPORTANT: Use the SERVICE_ROLE_KEY, not the anon/public key.
const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateWaitlist() {
  console.log('🚀 Starting waitlist migration...');

  const { data: waitlistUsers, error: fetchError } = await supabase
    .from('waitlist')
    .select('*')
    .eq('status', 'pending');

  if (fetchError) throw fetchError;
  if (!waitlistUsers || waitlistUsers.length === 0) {
    console.log('✅ No pending users found on the waitlist.');
    return;
  }

  console.log(`Found ${waitlistUsers.length} users to migrate.`);

  for (const user of waitlistUsers) {
    console.log(`Inviting: ${user.email}`);

    const { error: authError } = await supabase.auth.admin.inviteUserByEmail(
      user.email,
      { data: { original_waitlist_id: user.id } }
    );

    if (authError) {
      console.error(`❌ Failed to migrate ${user.email}:`, authError.message);
      continue;
    }

    const { error: updateError } = await supabase
      .from('waitlist')
      .update({ status: 'invited', migrated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error(`⚠️ User ${user.email} invited, but failed to update waitlist status.`);
    } else {
      console.log(`✅ Successfully migrated ${user.email}`);
    }
  }
  console.log('🎉 Migration complete!');
}

migrateWaitlist().catch(console.error);
