# ─────────────────────────────────────────────────────────────
#  Backend Dockerfile — Node.js Express API
# ─────────────────────────────────────────────────────────────

# Use Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for Docker layer caching)
# This means npm install only reruns when package.json changes
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy rest of source code
COPY . .

# Create uploads directories
RUN mkdir -p uploads/videos uploads/photos

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/auth/me || exit 1

# Start server
CMD ["node", "server.js"]
