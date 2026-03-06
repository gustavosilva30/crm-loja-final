FROM node:20

WORKDIR /app

# Ignora node_modules local e garante instalação limpa
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Expõe a porta 5000 (configurada no server.ts)
EXPOSE 5000

# Comando para rodar o backend com tsx
CMD ["npx", "tsx", "backend/server.ts"]