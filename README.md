# 🚀 Kubernetes Full-Stack Deployment Guide

A **beginner-friendly, step-by-step guide** for deploying a full-stack app (Express API + React) to Kubernetes using Docker, Helm, and Ingress / Gateway API.

---

## 📁 Project Structure

```
k8s/
├── simple-api/               # Backend — Express.js REST API
│   ├── server.js             # Entry point (routes: /, /api/health, /api/users)
│   ├── Dockerfile            # Multi-stage Docker build (node:20-alpine)
│   ├── .dockerignore
│   ├── deployment.yaml       # K8s Deployment + ClusterIP Service
│   ├── package.json
│   └── .env                  # PORT=3000
│
└── react-app-3/              # Frontend — React + Vite, served via Nginx
    ├── src/
    ├── nginx.conf            # Nginx config (SPA routing + optional API proxy)
    ├── Dockerfile            # Multi-stage: Vite build → Nginx serve
    ├── .dockerignore
    ├── deployment.yaml           # Deployment + Service + Gateway API (HTTPRoute)
    ├── deployment-with-ingress.yaml  # Alternative: Deployment + Service + Ingress
    └── package.json
```

---

## 🛠️ Prerequisites

Before starting, verify the following tools are installed:

```bash
# Docker
docker --version

# Kubernetes CLI
kubectl version --client

# Helm (package manager for K8s)
helm version

# (Optional) Check if a cluster is running (e.g., minikube, kind, Docker Desktop)
kubectl cluster-info
```

> **New to K8s locally?**
> Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and enable Kubernetes from **Settings → Kubernetes → Enable Kubernetes**.

---

## 🐳 Part 1 — Docker: Build & Push Images

Docker packages your app into a portable **image** that K8s can run as containers.

### Step 1.1 — Log in to Docker Hub

```bash
docker login
# Enter your Docker Hub username and password when prompted
```

---

### Step 1.2 — Build the Backend Image (`simple-api`)

```bash
cd simple-api

docker build -t YOUR_DOCKERHUB_USERNAME/simple-express-api:1.0 .
```

**What happens inside the Dockerfile (multi-stage build):**
- **Stage 1 (`deps`)** — Installs only production `node_modules` using `npm ci --omit=dev`
- **Stage 2 (`production`)** — Copies deps + source into a clean image, runs as a **non-root user** for security
- Exposes port `3000` and runs a **HEALTHCHECK** against `/api/health`

---

### Step 1.3 — Build the Frontend Image (`react-app-3`)

> ⚠️ **Important:** The `nginx.conf` file is bundled into the image at build time. It controls how Nginx serves the React SPA and (optionally) proxies `/api` requests. Always review it before building.

```bash
cd react-app-3

docker build -t YOUR_DOCKERHUB_USERNAME/simple-react-app:1.0 .
```

**What happens inside the Dockerfile (multi-stage build):**
- **Stage 1 (`builder`)** — Installs deps and runs `npm run build` (Vite outputs to `dist/`)
- **Stage 2 (`nginx:alpine`)** — Copies the static `dist/` files and the custom `nginx.conf`
- Serves on port `80`

**About `nginx.conf`:**
```nginx
server {
    listen 80;

    # Serves the React SPA — falls back to index.html for client-side routing
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri /index.html;   # <-- critical for React Router
    }

    # Optional: proxy /api/* to the backend (only if NOT using Ingress/Gateway)
    # location /api {
    #     proxy_pass http://simple-api-svc;
    # }
}
```

---

### Step 1.4 — Verify Images Locally

```bash
docker images
# You should see both images listed

# Test the backend container locally:
docker run -p 3000:3000 YOUR_DOCKERHUB_USERNAME/simple-express-api:1.0

# Test the frontend container locally:
docker run -p 8080:80 YOUR_DOCKERHUB_USERNAME/simple-react-app:1.0
# Open http://localhost:8080 in your browser
```

---

### Step 1.5 — Push Images to Docker Hub

```bash
docker push YOUR_DOCKERHUB_USERNAME/simple-express-api:1.0
docker push YOUR_DOCKERHUB_USERNAME/simple-react-app:1.0
```

Verify on [hub.docker.com](https://hub.docker.com) that both images appear in your repositories.

---

## ☸️ Part 2 — Kubernetes: Deploy Backend

### Step 2.1 — Understand `deployment.yaml` (Backend)

The file at `simple-api/deployment.yaml` contains two K8s resources separated by `---`:

**Resource 1: Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: simple-api
spec:
  replicas: 2                   # Run 2 identical pods
  strategy:
    type: RollingUpdate         # Zero-downtime updates
    rollingUpdate:
      maxSurge: 1               # Spin up 1 extra pod during update
      maxUnavailable: 0         # Never kill a pod before a new one is ready
  template:
    spec:
      containers:
        - name: simple-api
          image: kalees64/simple-express-api:1.0
          imagePullPolicy: Always   # Always pull the latest from Docker Hub
          ports:
            - containerPort: 3000
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits:   { cpu: "500m", memory: "256Mi" }
          livenessProbe:            # Restart pod if this fails 3 times
            httpGet: { path: /api/health, port: 3000 }
          readinessProbe:           # Only send traffic when this passes
            httpGet: { path: /api/health, port: 3000 }
```

**Resource 2: Service (ClusterIP)**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: simple-api-svc
spec:
  selector:
    app: simple-api             # Routes traffic to pods with this label
  type: ClusterIP               # Only reachable inside the cluster
  ports:
    - port: 80                  # Service listens on 80
      targetPort: 3000          # Forwards to container port 3000
```

> **ClusterIP vs NodePort vs LoadBalancer:**
> - `ClusterIP` — internal only (use with Ingress/Gateway for external access) ✅ recommended
> - `NodePort` — exposes on a random port on every node (quick local testing)
> - `LoadBalancer` — provisions a cloud load balancer (AWS ELB, GCP GLB, etc.)

---

### Step 2.2 — Apply Backend to Kubernetes

```bash
cd simple-api

kubectl apply -f deployment.yaml
```

### Step 2.3 — Verify Backend is Running

```bash
# See everything created
kubectl get all

# Check deployments specifically
kubectl get deployments

# Check pods (should show 2 pods, both Running)
kubectl get pods

# Check services
kubectl get svc

# Describe a pod for detailed events/logs
kubectl describe pod <pod-name>

# Stream live logs from a pod
kubectl logs -f <pod-name>
```

---

## ☸️ Part 3 — Kubernetes: Deploy Frontend

The frontend has **two deployment options** depending on which load balancer you use.

### Option A — Using **Ingress** (`deployment-with-ingress.yaml`)

Ingress is the **stable, widely-supported** approach using `networking.k8s.io/v1`.

**Requires Nginx Ingress Controller. Install it with Helm:**

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx
```

**Apply the manifest:**
```bash
cd react-app-3
kubectl apply -f deployment-with-ingress.yaml
```

**What the Ingress resource does:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.local
      http:
        paths:
          - path: /        # All traffic → React frontend
            pathType: Prefix
            backend:
              service: { name: react-app-service, port: { number: 80 } }

          - path: /api     # /api/* traffic → Express backend
            pathType: Prefix
            backend:
              service: { name: simple-api-svc, port: { number: 3000 } }
```

**Add local hostname (run as Administrator):**
```bash
# Windows: edit C:\Windows\System32\drivers\etc\hosts
# Add this line:
127.0.0.1  myapp.local
```

---

### Option B — Using **Gateway API** (`deployment.yaml`)

Gateway API is the **next-generation** K8s networking API (more powerful than Ingress).

**Requires NGINX Gateway Fabric. Install with Helm:**
```bash
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --create-namespace -n nginx-gateway \
  --set service.type=NodePort
```

**Apply the manifest:**
```bash
cd react-app-3
kubectl apply -f deployment.yaml
```

**Gateway API components in the YAML:**
```
GatewayClass → defines which controller handles traffic (nginx)
    ↓
Gateway → listens on port 80 for host myapp.local
    ↓
HTTPRoute → routes:
    /     → react-app-service (port 80)
    /api  → simple-api-svc   (port 80)
```

---

### Step 3.1 — Verify Frontend is Running

```bash
kubectl get deployments
kubectl get pods
kubectl get svc

# For Ingress:
kubectl get ingress

# For Gateway API:
kubectl get gateway
kubectl get httproute
```

---

## 🔐 Part 4 — Private Docker Hub Images (Using Secrets)

If your Docker Hub images are **private**, K8s needs credentials to pull them.

### Step 4.1 — Create a Pull Secret

```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_PASSWORD \
  --docker-email=YOUR_EMAIL
```

```bash
# Verify the secret was created
kubectl get secrets
```

### Step 4.2 — Reference the Secret in Your Deployment

Add `imagePullSecrets` to the pod `spec` in your deployment YAML:

```yaml
spec:
  imagePullSecrets:
    - name: dockerhub-secret    # ← must match the secret name above

  containers:
    - name: simple-api
      image: YOUR_USERNAME/simple-express-api:1.0
      imagePullPolicy: Always   # Always pull from Docker Hub
```

### Step 4.3 — Local Images (No Docker Hub)

If you built the image locally and don't want to push it, use `imagePullPolicy: Never`:

```yaml
containers:
  - name: simple-api
    image: YOUR_USERNAME/simple-express-api:1.0
    imagePullPolicy: Never      # Use the local image, never pull from registry
```

> ⚠️ `imagePullPolicy: Never` only works if the image exists on the **same node** where the pod runs. For multi-node clusters, always push to a registry.

---

## 🔄 Part 5 — Updating Deployments (Rolling Updates)

### Scenario A — Pushed a new image **with the same tag** (e.g., `:1.0`)

K8s won't automatically detect the change because the tag didn't change. Force a rollout:

```bash
kubectl rollout restart deployment simple-api
kubectl rollout restart deployment react-app
```

### Scenario B — Pushed a new image **with a new tag** (e.g., `:2.0`)

1. Update the image tag in your `deployment.yaml`:
```yaml
image: YOUR_USERNAME/simple-express-api:2.0   # changed from 1.0
```

2. Apply the updated YAML:
```bash
kubectl apply -f deployment.yaml
```

K8s uses the `RollingUpdate` strategy — new pods start **before** old ones are terminated, ensuring zero downtime.

### Monitor a Rollout

```bash
kubectl rollout status deployment simple-api
kubectl rollout status deployment react-app

# Rollback to the previous version if something goes wrong
kubectl rollout undo deployment simple-api
```

---

## 🧹 Part 6 — Useful kubectl Commands

```bash
# ── Apply / Delete ──────────────────────────────────────────
kubectl apply -f deployment.yaml          # Create or update resources
kubectl delete -f deployment.yaml         # Delete all resources in the file
kubectl delete deployment simple-api      # Delete a specific deployment
kubectl delete pod <pod-name>             # Delete a pod (K8s will recreate it)

# ── Inspect ─────────────────────────────────────────────────
kubectl get all                           # Overview of all resources
kubectl get deployments
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get secrets

kubectl describe deployment simple-api    # Detailed info + events
kubectl describe pod <pod-name>

# ── Logs ────────────────────────────────────────────────────
kubectl logs <pod-name>                   # Print logs
kubectl logs -f <pod-name>               # Stream live logs
kubectl logs <pod-name> --previous        # Logs from a crashed pod

# ── Exec into a pod (like SSH) ──────────────────────────────
kubectl exec -it <pod-name> -- sh

# ── Port-forward (test without Ingress) ─────────────────────
kubectl port-forward svc/simple-api-svc 3000:80
# Now curl http://localhost:3000/api/health

kubectl port-forward svc/react-app-service 8080:80
# Now open http://localhost:8080
```

---

## 🗺️ Architecture Overview

```
                        Internet / Browser
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Ingress / Gateway  │  (Load Balancer / Router)
                    │   host: myapp.local  │
                    └─────────┬───────────┘
                              │
               ┌──────────────┼──────────────┐
               │ path: /      │              │ path: /api
               ▼              │              ▼
    ┌──────────────────┐      │   ┌──────────────────────┐
    │  react-app-svc   │      │   │   simple-api-svc     │
    │  (ClusterIP :80) │      │   │   (ClusterIP :80)    │
    └────────┬─────────┘      │   └──────────┬───────────┘
             │                │              │
             ▼                │              ▼
    ┌──────────────────┐      │   ┌──────────────────────┐
    │  react-app Pod   │      │   │  simple-api Pod x2   │
    │  nginx:alpine    │      │   │  node:20-alpine      │
    │  serves dist/    │      │   │  port 3000           │
    │  port 80         │      │   │  /api/health ✓       │
    └──────────────────┘      │   └──────────────────────┘
                              │
                     Docker Hub Registry
                     kalees64/simple-react-app:1.0
                     kalees64/simple-express-api:1.0
```

---

## ⚡ Quick Reference — Full Deployment Checklist

```bash
# 1. Build and push images
docker build -t YOUR_USER/simple-express-api:1.0 ./simple-api
docker build -t YOUR_USER/simple-react-app:1.0   ./react-app-3
docker push YOUR_USER/simple-express-api:1.0
docker push YOUR_USER/simple-react-app:1.0

# 2. Deploy backend
kubectl apply -f simple-api/deployment.yaml

# 3. Deploy frontend (choose one)
kubectl apply -f react-app-3/deployment-with-ingress.yaml   # Ingress
kubectl apply -f react-app-3/deployment.yaml                # Gateway API

# 4. Verify everything
kubectl get all
kubectl get ingress     # or: kubectl get gateway && kubectl get httproute

# 5. Add local DNS (Windows, run as Admin)
#    Add to C:\Windows\System32\drivers\etc\hosts:
#    127.0.0.1  myapp.local

# 6. Open in browser
#    http://myapp.local       → React frontend
#    http://myapp.local/api/health → Express health check
```

---

## 📚 Key Concepts Glossary

| Term | What it means |
|------|--------------|
| **Image** | A packaged snapshot of your app (built by Docker) |
| **Container** | A running instance of an image |
| **Pod** | The smallest K8s unit — wraps one or more containers |
| **Deployment** | Manages a set of identical pods + rolling updates |
| **Service** | Stable network endpoint that routes to pods |
| **ClusterIP** | Service type reachable only inside the cluster |
| **NodePort** | Service type exposed on a port of every node |
| **Ingress** | Routes external HTTP(S) traffic to services (stable API) |
| **Gateway API** | Next-gen routing API (more expressive than Ingress) |
| **Helm** | K8s package manager — installs complex apps via charts |
| **Rolling Update** | Gradually replaces old pods with new ones, zero downtime |
| **Liveness Probe** | K8s check — restarts pod if it fails |
| **Readiness Probe** | K8s check — stops sending traffic until pod is ready |
| **Secret** | K8s object to store sensitive data (credentials, tokens) |
| **imagePullPolicy** | Controls when K8s pulls the image: `Always`, `IfNotPresent`, `Never` |
