FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-data-ara \
  tesseract-ocr-data-aze \
  tesseract-ocr-data-deu \
  tesseract-ocr-data-eng \
  tesseract-ocr-data-rus \
  tesseract-ocr-data-tur
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
EXPOSE 3000
CMD ["node", "src/server.js"]
