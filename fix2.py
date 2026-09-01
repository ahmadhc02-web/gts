import sys

with open('src/components/EntrySheet.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "const handleSaveSheet = async () => {" in line:
        skip = True
    if skip and "// Restores a historical ledger card" in line:
        skip = False
    if not skip:
        new_lines.append(line)

with open('src/components/EntrySheet.tsx', 'w') as f:
    f.writelines(new_lines)
