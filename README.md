# Sinan VMS — Frontend

Visitor Management System frontend for Sinan, built with Next.js and MUI. Developed by **Whitewall Digital Solutions**.

## Tech Stack

- **Framework:** Next.js (React)
- **UI Library:** MUI (Material UI)
- **Hosting:** Vercel

## Live URLs

| Environment | URL |
|---|---|
| UAT | https://uat.sinan.whitewall.solutions |
| Production | https://sinan.whitewall.solutions |

## Local Development

### Prerequisites
- Node.js 20+

### Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

Deployed automatically via **Vercel**:

- UAT branch → UAT environment
- Main branch → Production environment

## Backend APIs

| | UAT | Production |
|---|---|---|
| REST API | https://api-uat.sinan.whitewall.solutions/api/v1 | https://api.sinan.whitewall.solutions/api/v1 |
| Socket | https://api-uat.sinan.whitewall.solutions | https://api.sinan.whitewall.solutions |
