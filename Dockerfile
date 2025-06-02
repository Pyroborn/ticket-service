# Stage 1: Build Node.js application
#FROM node:18-alpine AS app
FROM node:18-alpine
# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Create a directory for static files that will be shared with Nginx
RUN mkdir -p /app/public

# Stage 2: Create Nginx image for static files
#FROM nginx:alpine AS nginx
   
# Copy configuration
#COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy static files
#COPY ./public /usr/share/nginx/html

# Set default environment variables
#ENV USER_SERVICE_URL=http://user-service:3003
#ENV STATUS_SERVICE_URL=http://status-service:4001
#ENV DOWNLOADER_SERVICE_URL=http://downloader-service:3004

# Final Stage: Create the app image
#FROM node:18-alpine

# Create app directory
#WORKDIR /app

# Copy from build stage
#COPY --from=app /app /app

# Create volume mount point for static files
#VOLUME /app/public

# Expose API port
EXPOSE 3005

# Create an entrypoint script to handle file copying
RUN echo '#!/bin/sh\n\
# Copy static files to the shared volume if it exists and is mounted\n\
if [ -d "/app/public" ] && [ -d "/app/shared-public" ] && [ "$(ls -A /app/public)" ]; then\n\
  echo "Copying static files to shared volume..."\n\
  cp -r /app/public/* /app/shared-public/\n\
fi\n\
# Start the application\n\
exec node index.js\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Command to run the application with entrypoint script
CMD ["/app/entrypoint.sh"]