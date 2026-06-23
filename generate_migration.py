import json

mapping = {
    "cenibonato@gmail.com": {"lh_id": 7, "uuid": "29a397c6-cfd1-4423-817f-80621a2e656c"},
    "chris_bonato@hotmail.com": {"lh_id": 8, "uuid": "15f95270-aa4d-4a02-bf36-b6ac788f742d"},
    "gui_priebe@hotmail.com": {"lh_id": 11, "uuid": "f09636de-ec0b-42b8-a085-bf67f4fbd4da"},
    "leonardo@drlassessoriacontabil.com.br": {"lh_id": 9, "uuid": "a6130e13-8481-4d37-be0f-1fdcd8ffff4b"},
    "raphaell.costa_rs@hotmail.com": {"lh_id": 10, "uuid": "e364894a-0b56-415f-8139-17dfe57270eb"},
    "fabiofestinalli@gmail.com": {"lh_id": 13, "uuid": "7dc9c58c-becc-4a9f-b72a-ae9d5b221da9"},
    "guilhermebonato@proton.me": {"lh_id": 6, "uuid": "b1533820-5284-4ca3-a60a-792926b2941f"},
    "x_fintech_x@proton.me": {"lh_id": 12, "uuid": "ff250438-1eb5-4bad-90fb-0b2fd4102b7b"},
}

tables = ['categories', 'accounts', 'transactions', 'subscriptions', 'investments', 'loans', 'shared_links']

sql = "BEGIN;\n\n"

# 1. Create user_settings table
sql += """CREATE TABLE user_settings (
    id integer PRIMARY KEY,
    telegram_id varchar(50) UNIQUE,
    settings jsonb DEFAULT '{"requireReceipts": true}' NOT NULL
);\n\n"""

# 2. Populate user_settings
sql += "INSERT INTO user_settings (id, telegram_id, settings)\n"
sql += "SELECT "
cases_id = "CASE id "
cases_tg = "CASE id "
cases_st = "CASE id "
for email, ids in mapping.items():
    cases_id += f"WHEN '{ids['uuid']}' THEN {ids['lh_id']} "

sql += cases_id + "END, telegram_id, settings FROM users;\n\n"

# 3. Process each table
for table in tables:
    sql += f"ALTER TABLE {table} ADD COLUMN new_user_id integer;\n"
    update_case = f"UPDATE {table} SET new_user_id = CASE user_id "
    for email, ids in mapping.items():
        update_case += f"WHEN '{ids['uuid']}' THEN {ids['lh_id']} "
    update_case += "END;\n"
    sql += update_case
    sql += f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_user_id_users_id_fk;\n"
    sql += f"ALTER TABLE {table} DROP COLUMN user_id;\n"
    sql += f"ALTER TABLE {table} RENAME COLUMN new_user_id TO user_id;\n"
    sql += f"ALTER TABLE {table} ALTER COLUMN user_id SET NOT NULL;\n"
    # Optional: add index on the new user_id column
    sql += f"CREATE INDEX IF NOT EXISTS idx_{table}_user_id ON {table}(user_id);\n\n"

# 4. Drop users table
sql += "DROP TABLE users;\n\n"

sql += "COMMIT;\n"

with open('migration.sql', 'w') as f:
    f.write(sql)
