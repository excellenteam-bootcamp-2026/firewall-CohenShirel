FROM node:20-alpine
WORKDIR /app

# Leverage Docker cache for dependencies
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]