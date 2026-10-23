# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- development / test image ---------------------------------------------------------
FROM node:24-alpine AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- production build -------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
ARG SITE_URL=http://localhost:3000
ARG PUBLIC_CONTACT_EMAIL=
ARG PUBLIC_CONTACT_PHONE=
ENV SITE_URL=$SITE_URL PUBLIC_CONTACT_EMAIL=$PUBLIC_CONTACT_EMAIL PUBLIC_CONTACT_PHONE=$PUBLIC_CONTACT_PHONE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime image (standalone output, non-root) ----------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app
ARG SITE_URL=http://localhost:3000
ARG PUBLIC_CONTACT_EMAIL=
ARG PUBLIC_CONTACT_PHONE=
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    SITE_URL=$SITE_URL PUBLIC_CONTACT_EMAIL=$PUBLIC_CONTACT_EMAIL PUBLIC_CONTACT_PHONE=$PUBLIC_CONTACT_PHONE
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
