#!/bin/sh
cd /home/claude/s2 && mkdir -p dist
cat head.html b1.js settings.js b2.js models.js preview.js chars.js conquest.js mode.js net.js account.js game.js > dist/index.html
python3 -I - <<'P'
import re
s=open('/home/claude/s2/dist/index.html').read()
open('/tmp/claude-0/-home-claude/93d413e5-da5c-5669-84b2-1786265c5c29/scratchpad/index.mjs','w').write(re.search(r'<script type="module">(.*)</script>',s,re.S).group(1))
P
node --check /tmp/claude-0/-home-claude/93d413e5-da5c-5669-84b2-1786265c5c29/scratchpad/index.mjs && echo SYNTAX_OK
wc -c dist/index.html
cp dist/index.html server/game.html
