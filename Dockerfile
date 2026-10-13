FROM node:22-alpine

WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.mjs"]
