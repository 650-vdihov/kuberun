# Kuberun

A mobile application built with microservice architecture to help users track their runs and hikes, monitor monthly activity overviews, and stay motivated through social comparison features.

## Project Description

The goal of this project is to create a mobile application with microservice architecture. The app allows users to record their runs and hikes, view monthly activity summaries, and track their movement progress. It includes a social aspect where users can compare achievements with friends on leaderboards. Addressing the issue of sedentary lifestyles, the app aims to encourage more active living through simple tracking and social motivation.

## Project Organization

This is a monorepo managed with pnpm workspaces and Turbo. The structure is organized as follows:

- `apps/mobile/` - React Native/Expo mobile application
- `services/` - Microservices
- `infra/helm/` - Helm charts
- `packages/` - Common packages to reuse in services

## Local Development

### Prerequisites

- Node.js >= 18 ([installation](https://nodejs.org/en/download))
- pnpm ([installation](https://pnpm.io/installation))
- Expo GO mobile app ([installation](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/650-vdihov/kuberun.git
   cd kuberun
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run local containers
   ```bash
   docker-compose up -d
   ```

4. Init db of services
   ```bash
   cd services/{service}

   //In case of schema changes
   pnpm run db:generate
   
   pnpm run db:push
   ```

### Running the Application

- **Development mode** (runs mobile app locally):
  ```bash
  cd apps/mobile
  pnpm run dev
  ```

## Documentation

For detailed documentation, see [docs.md](./DOCS.md).