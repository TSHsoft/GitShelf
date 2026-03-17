<div align="center">

<!-- Replace with your actual logo path -->
<img src="public/favicon.svg" alt="GitShelf Logo" width="72" height="72" />

# GitShelf

**A bookmark‑style tool for collecting and managing GitHub projects, suitable for anyone who loves to curate GitHub repositories.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![GitHub OAuth](https://img.shields.io/badge/GitHub-OAuth-181717?logo=github&logoColor=white)](https://docs.github.com/en/apps/oauth-apps)

</div>

---

## ✨ What is GitShelf?

GitShelf is a **browser-based bookmark manager for GitHub repositories**. Sign in with your GitHub account, add any public repo you care about, tag and filter them, and keep your collection in sync — all stored privately in your own GitHub Gist as JSON. No server. No database. No tracking.

---

## 🚀 Features

### 📚 Repo & Profile Management
- **Add any GitHub repository or profile** by URL or shorthand (e.g., `owner/repo` or `owner`)
- **Profile Bookmarking** — Add any GitHub user or organization to generate a visual **Profile Dashboard** showing:
    - User bio, social links, and status emojis
    - Followers/Following counts and location
    - Rendered "Special README" repository
    - Pinned and Popular repositories with star/fork metrics
- **Folders & Workspaces** — Organize your shelf into custom, color-coded folders
- **Drag & Drop Organization** — Easily move items into folders by dragging them from the list to the sidebar
- **Smart Update Indicators** — Blinking visual indicators (🔴) appear when a project has new commits since your last GitHub visit
- **Star & Release Tracking** — Monitor star growth trends (↑/↓) and stay updated with automatically detected latest releases
- **Smart Favorites (♥)** — Pin important projects for quick access; favorites are always pinned to the top of any view
- **Three view modes** — Card, Table, and Grouped views
- **Tokenized Search** — Full-text search across name, owner, description, and language, plus support for `@topic` mentions to instantly filter by GitHub topics
- **Bulk actions** — Tag, Move, or Delete multiple items at once from the toolbar

### 🏷️ Tagging & Filtering
- Create **custom tags** with adjustable color palettes, supporting multiple tags per repo, with **multi-select filtering** to find exactly what you need.
- **Advanced Filter Bar** — filter by Type (Repo/Profile), Favorites, Status, Tag, Language, Stars, and Recency
- **Status tracking** — Automatically detects `active`, `archived`, `renamed`, `stale`, or `not_found`
- **Language breakdown** — Visual distribution bar for repository languages

### 🔄 Sync & Offline Support
- **One-click sync** to refresh metadata (stars, description, language, latest release) for all bookmarked repos
- **Offline-First** — All data is persisted to **IndexedDB**, allowing you to browse and manage your shelf without an internet connection. Changes sync to Gist once you're back online.
- GitHub **API rate-limit badge** displayed in Settings so you always know your quota

### ☁️ Gist Backup & Restore
- Auto-backup your shelf to a **private GitHub Gist** on an interval you choose (5–30 min)
- **Manual backup** and **restore** from Gist with a single click
- Encrypted token storage keeps your GitHub access token safe in `localStorage`

### 📄 README Viewer
- Click any repo to open a **drawer with the rendered README** — full GitHub-Flavored Markdown, images, and syntax highlighting
- Relative image and link paths are resolved to GitHub raw content automatically

### 📦 Import / Export
- Export your entire shelf as a JSON file for offline backup
- Import from a JSON backup or from a browser bookmarks export

### 🌗 Themes & UI
- **Interface** — Responsive user interface
- **Themes** — Light and Dark theme support

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React 19](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org) |
| **Build Tool** | [Vite 7](https://vitejs.dev) |
| **State** | [Zustand](https://zustand-demo.pmnd.rs) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) |
| **Validation** | [Zod](https://zod.dev) |
| **Auth** | GitHub OAuth 2.0 (`gist` + `read:user` scopes only) |
| **Storage** | GitHub Gist (cloud) + IndexedDB / `localStorage` (local) |
| **Markdown** | `react-markdown` + `remark-gfm` + `rehype-sanitize` |
| **Icons** | [Lucide React](https://lucide.dev) |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- A GitHub OAuth App (for local development)

### 1. Clone the repository

```bash
git clone https://github.com/TSHsoft/GitShelf.git
cd GitShelf
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Follow the local URL shown in your terminal (usually [http://localhost:5173](http://localhost:5173)).
> **Note:** To enable GitHub OAuth sign-in locally, you'll need to register a GitHub OAuth App, deploy a Cloudflare Worker, and configure your local `.env` file as described in the **GitHub OAuth Setup** section.

### 4. Build for production

```bash
npm run build
```

---

## 🔑 GitHub OAuth Setup

GitShelf requests only **minimal, read-only permissions**:

| Scope | Reason |
|---|---|
| `gist` | Read and write your private backup Gist |
| `read:user` | Display your username and avatar |

No write access to your repositories is ever requested.

To self-host with your own OAuth App, you need a GitHub OAuth App and a Cloudflare Worker (to safely exchange the OAuth code for an access token without exposing your Client Secret to the browser).

### 1. Create a GitHub OAuth App
1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set the **Homepage URL** to your deployed URL or `http://localhost:5173` for local development.
3. Set the **Authorization callback URL** to your deployment URL or `http://localhost:5173`.
4. Generate a **Client ID** and a **Client Secret**.

### 2. Deploy a Cloudflare Worker
Create a new Cloudflare Worker that accepts a `POST` request with `{ code }`, exchanges it via `https://github.com/login/oauth/access_token`, and returns the `{ access_token }`.
1. In your Cloudflare Worker settings, configure the environment variables:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
2. Ensure the worker handles CORS properly for your domain.

### 3. Configure Local Environment Variables
Create a `.env` file based on `.env.example`:

```env
VITE_GITHUB_CLIENT_ID=your_github_client_id
VITE_WORKER_URL=https://your-worker-name.your-worker-subdomain.workers.dev
VITE_CRYPTO_SECRET=your_generated_random_secret_here
```

> **Important**: You must generate a secure, random string for `VITE_CRYPTO_SECRET`. This key is used to encrypt your GitHub access token in the browser's local storage.
> **GitShelf uses account-bound encryption**: This secret is combined with your unique GitHub User ID to derive the final encryption key, ensuring that tokens are securely tied to your specific account.
> You can easily generate a strong random 32-byte hex string by running this command in your terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> For online deployments of the frontend app, make sure to add `VITE_CRYPTO_SECRET` to your hosting provider's environment variables (e.g., your Vercel project settings or Cloudflare Pages settings). It is NOT needed in your Cloudflare Worker.

---

## 🚀 Deployment (Frontend)

You can deploy the GitShelf frontend to any static hosting provider. Here is how to do it with **Vercel**:

1.  **Import your Project**: Link your GitHub repository to Vercel.
2.  **Configure Environment Variables**: In your Vercel Project Settings, go to **Environment Variables** and add the following:
    *   `VITE_GITHUB_CLIENT_ID`
    *   `VITE_WORKER_URL`
    *   `VITE_CRYPTO_SECRET` (Use the 32-byte hex string generated earlier)
3.  **Deploy**: Vercel will automatically build and deploy your app.
4.  **Note**: If you update your environment variables later, you must **Redeploy** the latest deployment in the Vercel dashboard for the changes to take effect.


---

## 🤝 Contributing



Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Commit** your changes with a clear message:
   ```bash
   git commit -m "feat: add keyboard shortcuts"
   ```
4. **Push** to your fork and open a **Pull Request**

Please make sure your code:
- Passes `npm run lint`
- Follows the existing TypeScript + Zod schema patterns
- Does not introduce new external dependencies without discussion

---

## 🐛 Reporting Issues

Found a bug? Please [open an issue](https://github.com/TSHsoft/GitShelf/issues) and include:
- Steps to reproduce
- Expected vs. actual behaviour
- Browser and OS version

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">

Made with ❤️ — Star ⭐ this repo if you find it useful!

</div>
