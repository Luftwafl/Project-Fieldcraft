# Builds the Project Fieldcraft server (game page, server list, accounts, multiplayer).
# Run from the top folder of the package: docker build -t fieldcraft .
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install --omit=dev
EXPOSE 8080
CMD ["node", "server.js"]
