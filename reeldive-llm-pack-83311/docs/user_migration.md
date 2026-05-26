🚚 Supabase User Migration Guide
Core Directive: The auth.users schema is isolated. We use scripts/migrate-waitlist.js to securely invite waitlist users via the Admin API using the SERVICE_ROLE_KEY.

1. Running the Script
Run this locally to process the migration:
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-secret-service-key"
node scripts/migrate-waitlist.js

2. Post-Migration Database Trigger
CRITICAL: Run the following SQL in the Supabase SQL Editor. This trigger ensures that whenever a user is created in auth.users, a corresponding row is automatically created in the public profiles table.

SQL
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

📋 Operational Workflows
1. Migrating the Entire Waitlist (Bulk)
By default, the script processes everyone with status = 'pending'. To migrate the entire list:

Ensure all target rows in the waitlist table have status set to 'pending'.

Run: node scripts/migrate-waitlist.js

2. Migrating a Specific Batch (e.g., Early Beta Users)
If you only want to move a specific group (e.g., users from a certain marketing campaign or date range):

In the Supabase SQL Editor, tag only those users:

SQL
UPDATE waitlist SET status = 'pending' WHERE created_at < '2026-01-01';
UPDATE waitlist SET status = 'hold' WHERE created_at >= '2026-01-01';
Run the script. It will only invite the 'pending' group.

3. Migrating One Specific User (VIP/Testing)
To migrate a single person immediately without touching the rest of the list:

Set all users to 'hold' and then target the individual:

SQL
UPDATE waitlist SET status = 'hold';
UPDATE waitlist SET status = 'pending' WHERE email = 'vip-user@example.com';
Run the script.

Reset the rest of the list back to 'pending' afterward if desired.

🚨 Troubleshooting & Resetting
Did someone lose their invite? To re-send an invite to a user who is already marked as 'invited', you must manually change their status back to 'pending' in the database and run the script again.

Script shows "0 users found": Check the waitlist table. If the status column is empty (NULL) or set to 'invited', the script will ignore those rows.

