import re

with open('packages/db/src/schema.ts', 'r') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if 'export const userSettingsRelations' in lines[i]:
        lines[i] = lines[i].replace('{ one, many }', '{ many }')
    elif 'export const categoriesRelations' in lines[i]:
        lines[i] = lines[i].replace('{ one, many }', '{ many }')
    elif 'export const accountsRelations' in lines[i]:
        lines[i] = lines[i].replace('{ one, many }', '{ many }')

with open('packages/db/src/schema.ts', 'w') as f:
    f.writelines(lines)
