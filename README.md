# SuperClaw Dashboard

A beautiful web dashboard for monitoring and managing your OpenClaw installation.

## Free vs Pro

SuperClaw is split into two packages:

- **superclaw-dashboard** (this repo, public) - Free tier features
- **superclaw-dashboard-pro** (private repo) - Pro features

### Free Features
- Dashboard overview
- Chat interface
- Sessions management
- Agent monitoring
- Workspace file browser
- Basic error tracking

### Pro Features (requires license)
- **Smart Router** - AI model selection and routing
- **Settings** - License management and advanced configuration
- **Team** - Multi-user team management
- **Tasks** - Project and task tracking
- **Stats** - Advanced analytics and insights
- **Skills** - Skills marketplace
- **Command** - Command palette
- **Scheduled** - Job scheduling

## Installation

### via SuperClaw CLI (recommended)
```bash
npm install -g @superclaw/cli
superclaw install
```

The CLI will automatically install Pro features if you have a valid license.

### Manual Installation
```bash
git clone https://github.com/skunkceo/superclaw-dashboard
cd superclaw-dashboard
npm install
npm run build
npm start
```

**To add Pro features manually:**
```bash
# Requires access to private pro repo
git clone https://github.com/skunkceo/superclaw-dashboard-pro /tmp/pro
cd /tmp/pro
node install.js
```

## Development

```bash
npm run dev     # Start dev server on port 3000
npm run build   # Production build
npm start       # Start production server
```

## Architecture

SuperClaw dashboard connects to your local OpenClaw gateway to fetch data and manage your AI agents. It does not store any data itself - it's a pure UI layer.

**Tech stack:**
- Next.js 15
- TypeScript
- Tailwind CSS
- SQLite (for user auth only)

## License

MIT

**Pro package:** Proprietary - requires valid license from skunkglobal.com
