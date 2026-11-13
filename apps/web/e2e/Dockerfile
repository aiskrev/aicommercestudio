FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /e2e
ENV CI=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["npx", "playwright", "test"]
