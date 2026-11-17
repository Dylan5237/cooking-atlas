FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/meal-engine/package.json packages/meal-engine/package.json
COPY packages/shopping-engine/package.json packages/shopping-engine/package.json
RUN npm install
COPY . .
RUN npm --workspace @cooking-atlas/api run db:generate && npm --workspace @cooking-atlas/api run build
EXPOSE 3001
CMD ["npm","--workspace","@cooking-atlas/api","run","start"]
