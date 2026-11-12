Project Fieldcraft - hosting a server (3 steps)

1. In this folder, run:   npm install
2. Start the server:      node server.js
   It prints "listening on port 8080".
3. Players open:          http://YOUR-ADDRESS:8080
   (on the same computer: http://localhost:8080)
   Then ACCOUNT to log in or create one, then PLAY > PVP.

Accounts are saved in accounts.json next to server.js. Back it up if you want to keep them.
Admins: any account whose name is in config.json ("admins"). Register those names yourself before others can.
Other computers need port 8080 open in the firewall and your IP address.
Logins go over plain HTTP. For anything public, put the server behind HTTPS.
