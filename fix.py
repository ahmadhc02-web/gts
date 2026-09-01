import re

with open('src/components/EntrySheet.tsx', 'r') as f:
    code = f.read()

# Fix the await in useEffect by wrapping with async IIFE
code = code.replace(
    "const targetMonthIdsToUpdate = new Set<string>();",
    "const targetMonthIdsToUpdate = new Set<string>();\n      (async () => {"
)
code = code.replace(
    "      } else {\n        toast.success(\"🎯 Connected Recovery Sheet Synced!\", {\n          description: `All recovery entries are permanently synchronized with recovery sheet database (${currentMonthId || 'Active Month'}).`,\n          duration: 4000\n        });\n      }",
    "      } else {\n        toast.success(\"🎯 Connected Recovery Sheet Synced!\", {\n          description: `All recovery entries are permanently synchronized with recovery sheet database (${currentMonthId || 'Active Month'}).`,\n          duration: 4000\n        });\n      }\n      })();"
)

# Remove the trailing curly braces that are causing TS1128
code = re.sub(r'  \};\n    \} catch \(e: any\) \{\n      toast\.error\(getCleanErrorMessage\(e\)\);\n    \} finally \{\n      toast\.dismiss\(savingToastId\);\n      setIsSavingSheet\(false\);\n    \}\n  \};\n  \};\n', '', code)

with open('src/components/EntrySheet.tsx', 'w') as f:
    f.write(code)
