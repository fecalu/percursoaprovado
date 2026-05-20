FROM node:20-alpine AS build

ARG VITE_BASE_PATH=/

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
