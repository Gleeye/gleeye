import os
import re

def sync_versions(directory, version):
    print(f"Syncing versions to v={version} in {directory}...")
    
    # Regex for static imports: from './path.js' or from './path.js?v=...'
    static_regex = re.compile(r"(from\s+['\"](\.?\.?\/.*\.js))(\?[^'\"]*)?(['\"])")
    # Regex for dynamic imports: import('./path.js') or import('./path.js?v=...')
    dynamic_regex = re.compile(r"(import\(['\"](\.?\.?\/.*\.js))(\?[^'\"]*)?(['\"]\))")

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".js"):
                path = os.path.join(root, file)
                with open(path, 'r') as f:
                    content = f.read()
                
                new_content = static_regex.sub(rf"\1?v={version}\4", content)
                new_content = dynamic_regex.sub(rf"\1?v={version}\4", new_content)
                
                if content != new_content:
                    with open(path, 'w') as f:
                        f.write(new_content)
                    print(f"Updated {path}")

if __name__ == "__main__":
    # Current version
    CURRENT_VERSION = "156"
    sync_versions("js", int(CURRENT_VERSION))
