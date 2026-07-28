from bs4 import BeautifulSoup
import os

html_path = "/home/ubuntu/browser_html/markzinmaanow_lovable_app_auth_1777992920416.html"

with open(html_path, 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

# Check for Web App Manifest
manifest = soup.find('link', rel='manifest')
manifest_href = manifest['href'] if manifest else "Not Found"

# Check for Service Worker registration in scripts
scripts = soup.find_all('script')
has_sw_registration = False
for script in scripts:
    if script.string and ('serviceWorker' in script.string or 'register' in script.string):
        has_sw_registration = True
        break
    if script.get('src') and ('sw.js' in script.get('src') or 'service-worker' in script.get('src')):
        has_sw_registration = True
        break

# Check for theme-color
theme_color = soup.find('meta', attrs={'name': 'theme-color'})
theme_color_val = theme_color['content'] if theme_color else "Not Found"

# Check for icons (apple-touch-icon)
apple_icon = soup.find('link', rel='apple-touch-icon')
apple_icon_href = apple_icon['href'] if apple_icon else "Not Found"

print(f"Manifest: {manifest_href}")
print(f"Service Worker Registration in HTML: {has_sw_registration}")
print(f"Theme Color: {theme_color_val}")
print(f"Apple Touch Icon: {apple_icon_href}")
