# n8n-nodes-smartling

This is an [n8n](https://n8n.io/) community node package for [Smartling](https://www.smartling.com/) — a cloud-based translation management platform. It lets you automate translation workflows directly from n8n.

## Nodes

### Smartling

Action node with the following operations:

| Resource | Operation | Description |
|----------|-----------|-------------|
| Machine Translation | Translate Text via Machine Translation | Machine translate text using MT profile |
| Machine Translation | Translate File via Machine Translation | Machine translate file using MT profile |
| Translation | Request Translation | Upload a file to a daily job to request its translation |
| File | Download Translated File | Download translated file for target locale |

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

### Running locally with n8n

```bash
npm install n8n -g                # install n8n globally
npm run build                     # build the node package
npm link                          # register this package for linking
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm link n8n-nodes-smartling      # link the node into n8n's custom nodes
n8n start                         # start n8n with the Smartling nodes available
```

### Testing triggers locally with ngrok

To test SmartlingTrigger webhooks from localhost, use [ngrok](https://ngrok.com/) to expose n8n's port:

```bash
ngrok http 5678
export WEBHOOK_URL=https://<uuid>.ngrok-free.app && n8n start
```

This sets n8n's webhook base URL to the ngrok tunnel so Smartling can deliver webhook events to your local instance.

## Known Limitations

These are upstream n8n platform issues that affect this node:

- **Dropdowns may not refresh when changing projects** — n8n's `loadOptions` does not re-trigger when the dependency is a `resourceLocator` field ([community discussion](https://community.n8n.io/t/how-to-re-trigger-loadoptions/190792)). If a dropdown (e.g. target locales, workflows) shows stale options after switching projects, close and re-open the dropdown to refresh.

- **Project search may show incorrect results** — Changing the search query in the project picker before the previous search completes can cause stale results to appear ([n8n#22123](https://github.com/n8n-io/n8n/issues/22123)). If results look wrong, clear the search field and try again.

## License

[MIT](LICENSE)
