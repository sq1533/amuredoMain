import glob
import os

files = glob.glob('c:/Users/dndnDG/amuredo/amuredoMain/static/*.html')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    if 'globalWholesale.js' not in content:
        content = content.replace('</body>', '<script src="/static/globalWholesale.js?v=1.0"></script>\n</body>')
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
print("Injection complete.")
