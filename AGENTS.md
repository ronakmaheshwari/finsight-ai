# AGENTS.md

## Monorepo Overview
This is a Turborepo managed workspace using NPM.
Apps live in /apps and shared libraries in /packages.

## Setup
- Install dependencies: `npm install`
- Start everything: `npm run dev`
- Build all apps: `npm build`
- Test everything: `npm test`

## Code Quality
- Strict TypeScript across all apps
- Use ESLint + Prettier
- Use SWC for builds
- Commit format: Conventional Commits (feat:, fix:, chore:)

## Agent Rules
1. When implementing features:
   - Prefer updating shared components in /packages/ui.
   - Reflect all type changes across all apps.
   - Generate tests for all modified modules.

2. When modifying shared libraries:
   - Update their Storybook stories.
   - Increment version in package.json.
   - Add a changeset entry.

## Guardrails
- Do not generate .env files; refer to environment variables abstractly.