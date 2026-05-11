import os
import re

root_dir = "/Users/davidegentile/Documents/app dev/gleeye erp"

for root, dirs, files in os.walk(root_dir):
    if "node_modules" in dirs:
        dirs.remove("node_modules")
    for file in files:
        if file.endswith(".js") or file.endswith(".html"):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace all occurrences of ?v=digits with ?v=1000
            new_content = re.sub(r'\?v=\d+', '?v=1000', content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated versions in {path}")

print("Done.")
