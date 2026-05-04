FROM node:18-alpine
WORKDIR /app

# Copy and install dependencies for api-gateway
COPY backend/api-gateway/package*.json ./backend/api-gateway/
RUN cd backend/api-gateway && npm install

# Copy the api-gateway source and the frontend static files
COPY backend/api-gateway ./backend/api-gateway
COPY frontend ./frontend

WORKDIR /app/backend/api-gateway
EXPOSE 3000

CMD ["node", "server.js"]
