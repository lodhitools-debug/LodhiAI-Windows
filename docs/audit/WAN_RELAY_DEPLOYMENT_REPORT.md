# LODHI AI — WAN RELAY ARCHITECTURE & DEPLOYMENT REPORT
**Task ID:** NET-004  
**Version:** 2.0  
**Target Service:** Lodhi AI Secure Cloud Relay Gateway  
**Date:** October 29, 2026  

---

## 1. Relay Protocol & Specifications

The Lodhi AI WAN Relay bridges communication between the commercial Windows Desktop application and remote mobile companions over public networks without requiring port forwarding or opening firewall holes.

### Key Architectural Invariants:
- **Protocol:** Bidirectional WebSocket (`wss://`) with fallback to HTTPS REST endpoints.
- **Port:** Default `:8080` (HTTP/WS) or `:443` (Reverse Proxy TLS termination).
- **Authentication:** RS256 JWT tokens with 15-minute expiry issued upon successful PIN pairing.
- **Data Privacy:** Zero persistence of message payloads; in-flight payloads are end-to-end encrypted or securely forwarded in-memory only.
- **Heartbeat & Keepalive:** Ping interval 15 seconds; disconnect threshold 45 seconds.

---

## 2. Dockerfile & Container Specification

The relay server source resides in `src/server/relay.ts`. A production Docker deployment configuration is defined below:

```dockerfile
# Multi-stage production container for Lodhi AI WAN Relay
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/server ./src/server
COPY src/types ./src/types
RUN npx tsc src/server/relay.ts --outDir dist-relay --module commonjs --target es2022

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist-relay ./dist
EXPOSE 8080
USER node
CMD ["node", "dist/server/relay.js"]
```

---

## 3. Deployment Steps to Cloud Run / AWS ECS

### Option A: Google Cloud Run (Serverless Container)
1. **Authenticate and set project:**
   ```bash
   gcloud config set project lodhi-ai-assistant
   ```
2. **Build and push container:**
   ```bash
   gcloud builds submit --tag gcr.io/lodhi-ai-assistant/lodhi-relay:v1.0
   ```
3. **Deploy with WebSocket support:**
   ```bash
   gcloud run deploy lodhi-relay \
     --image gcr.io/lodhi-ai-assistant/lodhi-relay:v1.0 \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="JWT_SECRET=production_secret_key_here,PORT=8080" \
     --session-affinity
   ```

### Option B: AWS ECS / Fargate
1. Push image to Amazon ECR (`lodhi-relay-repo`).
2. Create ECS Task Definition specifying 0.5 vCPU and 1 GB RAM.
3. Configure Application Load Balancer with stickiness enabled and target port 8080.

---

## 4. Current Verification & Blocker Status

- **Automated Integration Tests:**
  - `src/test/RelayServerE2E.test.ts`: **10 / 10 Tests Passing** (covers pairing handshake, token expiry, multi-tenant isolation, packet forwarding).
  - `src/test/AndroidRelay.test.ts`: **12 / 12 Tests Passing** (covers companion reconnection and disconnect handling).
- **Live Deployment Status:** **BLOCKED (External)**  
  *Deployment to a live public host requires production cloud provider billing credentials, DNS registration, and SSL certificates, which must be provisioned by the operations team.*
