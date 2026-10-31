# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime stage (small image: only the standalone server)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/backfill_image_variants.mjs ./scripts/backfill_image_variants.mjs
COPY --from=builder /app/lib/imageVariantStorage.js /app/lib/imageVariants.mjs /app/lib/productImages.mjs /app/lib/heroImages.mjs ./lib/
EXPOSE 8080
CMD ["node", "server.js"]
