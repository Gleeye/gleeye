import os
import re

root_dir = "/Users/davidegentile/Documents/app dev/gleeye erp"
target_string = "import('./hub_drawer.js"
replacement_string = "import('/js/features/pm/components/hub_drawer.js"

target_appt = "import('./hub_appointment_drawer.js"
replacement_appt = "import('/js/features/pm/components/hub_appointment_drawer.js"

for root, dirs, files in os.walk(root_dir):
    if "node_modules" in dirs:
        dirs.remove("node_modules")
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content.replace(target_string, replacement_string)
            new_content = new_content.replace(target_appt, replacement_appt)
            
            # Also fix some specific ones that might have different query params
            new_content = re.sub(r"import\('\./hub_drawer\.js\?v=\d+'\)", r"import('/js/features/pm/components/hub_drawer.js?v=400')", new_content)
            new_content = re.sub(r"import\('\./hub_appointment_drawer\.js\?v=\d+'\)", r"import('/js/features/pm/components/hub_appointment_drawer.js?v=400')", new_content)

            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {path}")
