# Project Context & Deployment Rules

**Project stack**:
- **Backend**: Supabase (Database, Auth, Edge Functions).
- **Frontend**: Vanilla Javascript (ES6 modules), HTML5, CSS3.
- **Infrastructure**: Vercel (Production Hosting).

**Deployment Process**:
- **Main/Production branch**: `main` (verified by `git status`).
- **Deployment command**: `git push origin main`.
- **Database changes**: Apply directly to Supabase Cloud (remotely) during development, then document in `.sql` files.

**Permanent Rules**:
- **ALWAYS** remember that the deployment to production is done via **GitHub push**.
- **DO NOT** ask the user how to deploy if the task is to put things in production; use `git push`.
- **Production URL**: Usually linked to the master branch on Vercel.
