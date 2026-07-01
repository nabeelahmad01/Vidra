# Use Debian Bookworm slim for Puppeteer/Chromium compatibility
FROM node:20-bookworm-slim

# Install system dependencies: python3 (for yt-dlp), ffmpeg (for merging), and chromium (for scraping)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download latest yt-dlp binary during build time to bypass runtime API limits
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    ln -sf /usr/bin/python3 /usr/bin/python

# Tell Puppeteer to use the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install npm dependencies
RUN npm install --legacy-peer-deps

# Copy application source
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Create downloads folder
RUN mkdir -p temp_downloads && chmod 777 temp_downloads

# Run server
CMD ["node", "dist/index.js"]
