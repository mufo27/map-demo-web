# Stage 1: Build the Angular application
FROM node:18 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Angular application
RUN npm run build -- --configuration=staging

# Stage 2: Serve the application using Nginx
FROM nginx:1.25-alpine

# Copy the built Angular app from the previous stage
COPY --from=build app/dist/map-demo-web/browser /usr/share/nginx/html/map-demo-web/

# Copy custom Nginx configuration (if needed)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
