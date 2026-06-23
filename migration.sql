BEGIN;

CREATE TABLE user_settings (
    id integer PRIMARY KEY,
    telegram_id varchar(50) UNIQUE,
    settings jsonb DEFAULT '{"requireReceipts": true}' NOT NULL
);

INSERT INTO user_settings (id, telegram_id, settings)
SELECT CASE id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END, telegram_id, settings FROM users;

ALTER TABLE categories ADD COLUMN new_user_id integer;
UPDATE categories SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_users_id_fk;
ALTER TABLE categories DROP COLUMN user_id;
ALTER TABLE categories RENAME COLUMN new_user_id TO user_id;
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

ALTER TABLE accounts ADD COLUMN new_user_id integer;
UPDATE accounts SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_users_id_fk;
ALTER TABLE accounts DROP COLUMN user_id;
ALTER TABLE accounts RENAME COLUMN new_user_id TO user_id;
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

ALTER TABLE transactions ADD COLUMN new_user_id integer;
UPDATE transactions SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_users_id_fk;
ALTER TABLE transactions DROP COLUMN user_id;
ALTER TABLE transactions RENAME COLUMN new_user_id TO user_id;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

ALTER TABLE subscriptions ADD COLUMN new_user_id integer;
UPDATE subscriptions SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_users_id_fk;
ALTER TABLE subscriptions DROP COLUMN user_id;
ALTER TABLE subscriptions RENAME COLUMN new_user_id TO user_id;
ALTER TABLE subscriptions ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

ALTER TABLE investments ADD COLUMN new_user_id integer;
UPDATE investments SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_users_id_fk;
ALTER TABLE investments DROP COLUMN user_id;
ALTER TABLE investments RENAME COLUMN new_user_id TO user_id;
ALTER TABLE investments ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

ALTER TABLE loans ADD COLUMN new_user_id integer;
UPDATE loans SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_user_id_users_id_fk;
ALTER TABLE loans DROP COLUMN user_id;
ALTER TABLE loans RENAME COLUMN new_user_id TO user_id;
ALTER TABLE loans ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

ALTER TABLE shared_links ADD COLUMN new_user_id integer;
UPDATE shared_links SET new_user_id = CASE user_id WHEN '29a397c6-cfd1-4423-817f-80621a2e656c' THEN 7 WHEN '15f95270-aa4d-4a02-bf36-b6ac788f742d' THEN 8 WHEN 'f09636de-ec0b-42b8-a085-bf67f4fbd4da' THEN 11 WHEN 'a6130e13-8481-4d37-be0f-1fdcd8ffff4b' THEN 9 WHEN 'e364894a-0b56-415f-8139-17dfe57270eb' THEN 10 WHEN '7dc9c58c-becc-4a9f-b72a-ae9d5b221da9' THEN 13 WHEN 'b1533820-5284-4ca3-a60a-792926b2941f' THEN 6 WHEN 'ff250438-1eb5-4bad-90fb-0b2fd4102b7b' THEN 12 END;
ALTER TABLE shared_links DROP CONSTRAINT IF EXISTS shared_links_user_id_users_id_fk;
ALTER TABLE shared_links DROP COLUMN user_id;
ALTER TABLE shared_links RENAME COLUMN new_user_id TO user_id;
ALTER TABLE shared_links ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shared_links_user_id ON shared_links(user_id);

DROP TABLE users;

COMMIT;
