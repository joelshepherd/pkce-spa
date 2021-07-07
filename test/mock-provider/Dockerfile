FROM node:14-alpine

WORKDIR /app

COPY . .

RUN npm install --production

RUN chown -R node:node /app

USER 1000

CMD ["node", "server.js"]