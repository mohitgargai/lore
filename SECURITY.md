# Security

## How secrets are handled

- Your LLM API key is stored in `~/.config/lore/config.json` (chmod 600), never
  in the repository. Environment variables override the file, so CI can stay
  env-only.
- The recall log and unreviewed drafts under `.lore/` are gitignored.
- Auto-capture and `lore check` send your git diff, and, for capture, a tail of
  the session transcript, to the LLM endpoint you configure. If your code can't
  leave your machine, point them at a local model (e.g. Ollama); the endpoint is
  yours to choose.

## Reporting a vulnerability

Please open a GitHub security advisory (Security → Report a vulnerability)
rather than a public issue, so it can be handled before disclosure.
