import re

# 1. Fix auth.ts
with open('apps/backend/src/middleware/auth.ts', 'r') as f:
    content = f.read()

content = re.sub(r"async function attachUser.*?\}", "", content, flags=re.DOTALL)

old_auth_check = """  try {
    const payload = verifyBearer(req);
    const email = payload?.email?.toLowerCase().trim();

    if (!email) {
      return unauthorized(res);
    }

    await attachUser(res, next, eq(schema.users.email, email), req);
  } catch (err) {
    unauthorized(res);
  }"""

new_auth_check = """  try {
    const payload = verifyBearer(req);
    if (!payload?.sub) {
      return unauthorized(res);
    }

    req.user = { id: payload.sub, email: payload.email || '' };
    next();
  } catch (err) {
    unauthorized(res);
  }"""

content = content.replace(old_auth_check, new_auth_check)

old_bot_auth = """  try {
    const payload = verifyBearer(req, true);
    if (payload?.sub) {
      const onBehalfOf = payload.sub;
      await attachUser(res, next, eq(schema.users.id, onBehalfOf), req);
      return;
    }
  } catch {}"""

new_bot_auth = """  try {
    const payload = verifyBearer(req, true);
    if (payload?.sub) {
      req.user = { id: payload.sub, email: payload.email || '' };
      next();
      return;
    }
  } catch {}"""

content = content.replace(old_bot_auth, new_bot_auth)
content = content.replace("import { db, schema } from '@moneyapp/db';", "")
content = content.replace("import { SQL, eq } from 'drizzle-orm';", "")

with open('apps/backend/src/middleware/auth.ts', 'w') as f:
    f.write(content)

# 2. Fix users.ts
with open('apps/backend/src/routes/users.ts', 'r') as f:
    content = f.read()

content = content.replace("users.", "userSettings.")
content = content.replace("schema.users", "schema.userSettings")

with open('apps/backend/src/routes/users.ts', 'w') as f:
    f.write(content)

# 3. Fix bot.ts
with open('apps/backend/src/routes/bot.ts', 'r') as f:
    content = f.read()

content = content.replace("const { users, transactions, categories, accounts, loans } = schema;", "const { userSettings, transactions, categories, accounts, loans } = schema;")

# /users/by-telegram/:telegramId
content = content.replace("users.telegramId", "userSettings.telegramId")
content = content.replace("from(users)", "from(userSettings)")
content = content.replace("id: users.id", "id: userSettings.id")

# /users/all
content = content.replace("email: users.email,", "") # userSettings has no email

# /link-telegram
old_link = """botRouter.post('/link-telegram', async (req, res, next) => {
  try {
    const { email, telegramId, name } = req.body as { email?: string; telegramId?: string; name?: string };

    if (!email || !telegramId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    let user = await db.query.users.findFirst({ where: eq(users.email, emailLower) });
    if (!user) {
      const displayName = name?.trim() || emailLower.split('@')[0]!;
      const [created] = await db.insert(users).values({ email: emailLower, name: displayName }).returning();
      user = created!;
      await ensureDefaultCategories(user.id);
    }

    await db.update(users).set({ telegramId, updatedAt: new Date() }).where(eq(users.id, user.id));

    res.json({ id: user.id });
  } catch (err) {
    next(err);
  }
});"""

new_link = """botRouter.post('/link-telegram', async (req, res, next) => {
  try {
    const { userId, telegramId } = req.body as { userId?: string; telegramId?: string };

    if (!userId || !telegramId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    let settings = await db.query.userSettings.findFirst({ where: eq(userSettings.id, userId) });
    if (!settings) {
      const [created] = await db.insert(userSettings).values({ id: userId, telegramId }).returning();
      settings = created!;
      await ensureDefaultCategories(userId);
    } else {
      await db.update(userSettings).set({ telegramId }).where(eq(userSettings.id, userId));
    }

    res.json({ id: userId });
  } catch (err) {
    next(err);
  }
});"""

content = content.replace(old_link, new_link)

with open('apps/backend/src/routes/bot.ts', 'w') as f:
    f.write(content)
