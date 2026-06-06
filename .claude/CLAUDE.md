# Project: Fonio AI Hackathon

## Stack
- Backend: Node.js/TypeScript, Express
- Frontend: React/Vite/Tailwind
- DB: MongoDB

## Commands
- `npm run dev` – start dev server
- `npm test` – tests

## Conventions
- Commits: feat/fix/chore prefix
- No console.log in production code
- TypeScript NO strict mode

## Architecture

### Webhook Server

A server with webhook for incoming requests regarding cancellations from appointments from Fonio.
This server will then trigger an outbound call to Fonio to call good fits for this empty slot.

### Web Interface

On this interface, we simulate a small part of the CRM: The customers who are willing to reschedule. They are ranked by willingness to reschedule.
This webinterface will also give the dentist a look behind the scenes to see how well his calendar is filled (Google Calendar integration) and which conversations are currently happening.

Stack:
- Next.js
- Shadcn
- Tailwind CSS

You MUST use Shadcn components whenever possible.
When asked to modify a component, check if it makes sense to modify the component at the shadcn level (eg. not every box should have className="rounded", do this at the shadcn component level)
