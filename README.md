# n8n-nodes-smartling

This is an [n8n](https://n8n.io/) community node package for [Smartling](https://www.smartling.com/) — a cloud-based translation management platform. It lets you automate translation workflows directly from n8n.

## Nodes

### Smartling

Action node with the following operations:

| Resource | Operation | Description |
|----------|-----------|-------------|
| Machine Translation | Translate Text | Translate plain text using Smartling MT |
| Machine Translation | Translate File | Translate a file using Smartling MT (returns translated file as binary) |
| Translation | Request Translation | Upload a file to a daily translation job for human translation |
| File | Download | Download a published translated file |

The node is also available as an **AI tool** (`usableAsTool: true`), so it can be used by AI agents in n8n.

### Smartling Trigger

Webhook trigger node that starts a workflow when a Smartling event occurs. Supported events:

- **File** — Published
- **Source Issues** — Created, Updated, Deleted, Comment Created/Updated/Deleted
- **Translation Issues** — Created, Updated, Deleted, Comment Created/Updated/Deleted
- **Translation Jobs** — Created, Updated, Completed, Canceled

Events can optionally be filtered by project.

## Prerequisites

- n8n (self-hosted or cloud)
- A Smartling account with API credentials (User Identifier + User Secret) from **Account Settings > API**

## Installation

### In n8n (Community Nodes)

1. Go to **Settings > Community Nodes**
2. Enter `n8n-nodes-smartling`
3. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-smartling
```

Restart n8n after installation.

## Credentials

1. In n8n, go to **Credentials > New Credential**
2. Search for **Smartling API**
3. Enter your **User Identifier** and **User Secret**
4. Click **Test** to verify the connection

## Development

```bash
npm install
npm run build        # compile TypeScript + copy assets
npm run dev          # watch mode
npm test             # run all tests
npm run lint         # check code style
```

## License

[MIT](LICENSE)
