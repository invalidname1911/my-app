# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Framework: Next.js 15 (App Router) with React 19 and TypeScript
- Styling: Tailwind CSS v4 (via @tailwindcss/postcss) and tw-animate-css
- Package manager: pnpm (pnpm-lock.yaml present)
- Directory model: App Router in app/, shared components in components/

Commands
- Install dependencies: pnpm install
- Build production bundle: pnpm build
- Run production server (after build): pnpm start
- Lint (Next.js ESLint integration): pnpm lint
- Type-check only (build ignores TS errors, so use this when needed): pnpm exec tsc --noEmit
- Tests: No test runner is configured and there is no test script in package.json

Architecture and code structure
- App Router (app/)
  - app/layout.tsx defines global HTML structure, injects Geist fonts, and wraps all pages with components/ThemeProvider to manage light/dark themes via next-themes (attribute="class"). It also exports Metadata used by Next.
  - app/page.tsx is the home route. It composes the main UI from components/Sidebar and components/MainContent.
  - app/globals.css sets design tokens (CSS variables) and Tailwind v4 theme values. It uses @custom-variant dark and @theme inline to map variables to Tailwind design tokens. Tailwind is enabled via @import 'tailwindcss' in this file and is processed through postcss.config.mjs.

- Components (components/)
  - Top-level components like sidebar.tsx, main-content.tsx, conversion-history.tsx implement primary UI sections.
  - components/ui/ contains reusable UI primitives (Radix-based/shadcn-style building blocks: button, dialog, dropdown-menu, form, input, tabs, toast, etc.). These are meant to be composed by feature components rather than modified frequently. Hooks like use-toast.ts are colocated with UI primitives to standardize notifications.
  - ThemeProvider (components/theme-provider.tsx) centralizes theme management for the entire app.

- Configuration
  - next.config.mjs
    - eslint.ignoreDuringBuilds: true and typescript.ignoreBuildErrors: true. Builds will not fail on lint or TS errors; prefer running pnpm lint and pnpm exec tsc --noEmit locally to catch issues.
    - images.unoptimized: true (disables Next image optimization pipeline).
  - tsconfig.json
    - Path alias @/* points to the project root (e.g., import { Sidebar } from '@/components/sidebar').
    - moduleResolution: bundler, strict true, noEmit true; Next plugin enabled.
  - postcss.config.mjs
    - Uses @tailwindcss/postcss to power Tailwind v4 processing. No separate tailwind.config file is required for this setup.

Notes for working in this repo
- Use pnpm for all install and run commands.
- Because the build is configured to ignore ESLint and TypeScript errors, run pnpm lint and pnpm exec tsc --noEmit during development to catch issues early.
- UI primitives under components/ui are shared building blocks. Favor composing them in higher-level components rather than duplicating styles.
- Do not run pnpm dev server, let user run it.
- Whenever you need to install / use any new packages, use context7 MCP to gather context first.
- Run lint when you finished editing / creating files.
