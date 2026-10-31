# Builds the Project Fieldcraft server (game page, server list, accounts, multiplayer).
# Run from the top folder of the package: docker build -t fieldcraft .
FROM node:20-alpine
WORKDIR /app
COPY src/conquest.js ./conquest.js
COPY server ./server
WORKDIR /app/server
RUN npm install --omit=dev
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node", "server.js"]
