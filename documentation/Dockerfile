FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo/documentation

COPY documentation/package.json documentation/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY documentation/ ./
# Homepage assets are required from the client marketing folder (monorepo-relative).
COPY client/public/images/marketing /repo/client/public/images/marketing

RUN pnpm build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /repo/documentation/build /usr/share/nginx/html
COPY documentation/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
