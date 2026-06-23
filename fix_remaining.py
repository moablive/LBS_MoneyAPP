with open('apps/backend/src/routes/users.ts', 'r') as f:
    content = f.read()

content = content.replace(", updatedAt: new Date() ", " ")
with open('apps/backend/src/routes/users.ts', 'w') as f:
    f.write(content)

with open('packages/db/src/schema.ts', 'r') as f:
    content = f.read()

content = content.replace("({ one, many })", "({ many })")
with open('packages/db/src/schema.ts', 'w') as f:
    f.write(content)
