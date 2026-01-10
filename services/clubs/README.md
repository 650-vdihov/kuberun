# Clubs Service

Microservice for managing clubs, memberships, and invitations.

## Features

- Create and manage clubs
- Invite users to clubs
- Accept/decline club invitations
- Member management (kick, promote, demote)
- Club preferences management

## Endpoints

### Public
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics

### Authenticated
- `GET /clubs` - Get user's clubs
- `POST /clubs` - Create a new club
- `GET /clubs/:id` - Get club details
- `GET /clubs/:id/members` - Get club members
- `POST /clubs/:id/invite` - Invite user to club (admin only)
- `DELETE /clubs/:id/leave` - Leave club
- `GET /invites` - Get pending invites
- `POST /invites/:id/accept` - Accept invite
- `POST /invites/:id/decline` - Decline invite
- `DELETE /clubs/:clubId/members/:userId` - Kick member (admin only)
- `POST /clubs/:clubId/members/:userId/promote` - Promote to admin (admin only)
- `POST /clubs/:clubId/members/:userId/demote` - Demote from admin (admin only)
- `PUT /clubs/:id/preferences` - Update club preferences (admin only)

## Database Schema

- `clubs` - Club information
- `club_members` - Club membership records
- `club_invites` - Pending invitations

## Environment Variables

See `.env.example`

## Development

```bash
# Install dependencies (from root)
pnpm install

# Generate DB schema
pnpm run db:generate

# Push schema to database
pnpm run db:push

# Run in development
pnpm run dev
```
