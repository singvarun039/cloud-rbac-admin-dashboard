# Frontend (Web)

React (Vite) admin UI for the RBAC API.

## Local development

The preferred dev workflow (Postgres + API + Web) is via Docker Compose from the repo root:

- See `../README.md`

If you want to run the frontend outside Docker, it’s a standard Vite app:

```bash
npm install
npm run dev
```

## Code layout (quick map)

- `src/pages/` — route pages (Dashboard, Users, Roles, Projects, Audit Logs)
- `src/routes/` — app router
- `src/api/` — API client wrappers
- `src/auth/` — auth context + token handling
- `src/components/` — shared UI components

## AWS deploy (Terraform)

See `infra/terraform/README.md` for the Terraform deployment.

### What gets deployed

In the AWS/Terraform deployment, the frontend is served by nginx (not the Vite dev server):

- Builds the production image from `frontend/Dockerfile`
- Serves the compiled SPA (`dist/`) on port 80
- Proxies `/api/*` to the backend container

Browser behavior:

- Use `http://<ec2-public-ip>/` as the single entrypoint.
- Call the API via same-origin paths like `GET /api/health`.

### Troubleshooting (AWS)

On the EC2 instance:

```bash
cd /opt/app
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs --tail=200 nginx
curl -fsS http://127.0.0.1/api/health
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
