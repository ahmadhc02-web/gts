import re

with open('src/components/BillingTab.tsx', 'r') as f:
    lines = f.readlines()

# The pattern is an input tag containing id related to comments, or comments handleSaveRowField nearby
for i, line in enumerate(lines):
    if "value={rowRef.comments || ''}" in line:
        # The next line is likely disabled={!isBillingUnlocked}
        if "disabled={!isBillingUnlocked}" in lines[i+1]:
            lines[i+1] = lines[i+1].replace("disabled={!isBillingUnlocked}", "disabled={false}")
        elif "disabled={!isBillingUnlocked}" in lines[i-1]:
            lines[i-1] = lines[i-1].replace("disabled={!isBillingUnlocked}", "disabled={false}")

with open('src/components/BillingTab.tsx', 'w') as f:
    f.writelines(lines)
