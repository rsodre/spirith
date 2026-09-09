# @spirith/agent

The Spirith MCP server, the cadence optimiser and the keeper CLI. Everything reads the Spirith
subgraph and the vault on Sepolia; nothing here holds funds.

## MCP server

Five tools over stdio: `namesAtRisk`, `runway`, `optimalCadence`, `portfolioHealth`,
`rescueProposal`. The server loads the nearest `.env` (it needs `SEPOLIA_RPC_URL` and
`SUBGRAPH_QUERY_URL`), so it runs from the repository root with no extra configuration.

Claude Code picks it up from the repository's `.mcp.json`:

```json
{
  "mcpServers": {
    "spirith": {
      "command": "pnpm",
      "args": ["--silent", "--filter", "@spirith/agent", "mcp"]
    }
  }
}
```

Claude Desktop (`claude_desktop_config.json`) needs the absolute path, and the built server:

```json
{
  "mcpServers": {
    "spirith": {
      "command": "node",
      "args": ["/path/to/spirith/packages/agent/dist/mcp.js"],
      "cwd": "/path/to/spirith"
    }
  }
}
```

Build it once with `pnpm build` at the repository root. Then ask: *which endowed names die in
the next 30 days and what should each renew for?*

## Keeper

```sh
pnpm --filter @spirith/agent keeper once --label spirithbeta --dry-run   # one name
pnpm --filter @spirith/agent keeper watch --interval 300                 # poll and renew
```

Without `KEEPER_PRIVATE_KEY` the keeper only simulates. The vault decides whether a renewal is
allowed and for how long; the keeper only asks, and collects the tip when it is.

## Optimiser

`optimalCadence` and `perpetualDeposit` are pure functions over the ENSv2 discount curve, the
vault's reserve rule and a yield range; `pnpm --filter @spirith/agent test` pins their numbers.
