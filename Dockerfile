FROM node:22.18.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
COPY server ./server
COPY public ./public
COPY vendor ./vendor
COPY showcase ./showcase
ENV STUDIO_BIND=0.0.0.0 PORT=4328 STUDIO_DATA=/data NODE_ENV=production
RUN mkdir -p /data && chown node /data
EXPOSE 4328
USER node
CMD ["node","server/index.mjs"]
