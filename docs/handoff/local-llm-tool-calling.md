# Local LLM Tool Calling Handoff

Date: 2026-05-21

This note captures the local tool-calling setup for the llama.cpp box and the steps to mirror it on the secondary Pi. The target model is `qwen3.5-35b-claude`, served by the llama.cpp router at `http://127.0.0.1:8080`.

## Current Result

`qwen3.5-35b-claude` is the best current local model for tool-calling tests on this box. It is fast enough for agent loops, has 128k context configured, and successfully emitted parseable tool calls through all tested paths:

- llama.cpp OpenAI-compatible `/v1/chat/completions`
- llama.cpp Anthropic-compatible `/v1/messages`
- opencode built-in tools: `websearch`, `webfetch`, `grep`
- Claude Code built-in `Grep` tool via local `ANTHROPIC_BASE_URL`

No llama.cpp preset change is required for tool calling. The existing model preset already has the important pieces:

```ini
[qwen3.5-35b-claude]
ctx-size = 131072
gpu-layers = all
n-cpu-moe = 32
fit = off
cache-type-k = q4_0
cache-type-v = q4_0
reasoning = on
reasoning-format = deepseek
temp = 0.6
top-k = 20
top-p = 0.95
repeat-penalty = 1
```

The router service is still the llama.cpp preset server on port `8080`, with `--jinja` enabled. That is required for structured tool-call rendering and parsing.

## opencode Setup

Global opencode config lives at:

```text
/home/faber/.config/opencode/opencode.json
```

Use the local llama.cpp provider already configured at `http://127.0.0.1:8080/v1`, and make Qwen 3.5 the default model:

```json
{
  "model": "llama-cpp/qwen3.5-35b-claude",
  "small_model": "llama-cpp/qwen3.5-35b-claude"
}
```

Using Qwen for both `model` and `small_model` avoids cold-swapping the llama.cpp router away from Qwen during title or small-agent calls while the router is running with `--models-max 1`.

For predictable agent behavior, add deterministic options to the existing `qwen3.5-35b-claude` model entry:

```json
"qwen3.5-35b-claude": {
  "name": "Qwen 3.5 35B-A3B Claude-Opus-Distilled 128k (llama.cpp)",
  "limit": {
    "context": 131072,
    "output": 4096
  },
  "options": {
    "temperature": 0,
    "topP": 1
  }
}
```

Enable web search for the opencode web service:

```ini
# /home/faber/.config/systemd/user/opencode-web.service
[Service]
Environment=OPENCODE_ENABLE_EXA=1
```

Then reload and restart:

```bash
systemctl --user daemon-reload
systemctl --user restart opencode-web.service
systemctl --user show opencode-web.service -p Environment
```

For CLI sessions, either export the variable in the shell or prefix the command:

```bash
OPENCODE_ENABLE_EXA=1 opencode run --model llama-cpp/qwen3.5-35b-claude "Use websearch to find the current OpenCode tools docs."
```

Expected result from validation:

```text
TOOL_OK https://open-code.ai/en/docs/tools
FETCH_OK
SEARCH_OK
```

Notes:

- `webfetch` is available without Exa.
- `websearch` requires `OPENCODE_ENABLE_EXA=1` unless using the hosted OpenCode provider.
- No Exa API key was required in the tested OpenCode version.

## Claude Code Setup

Claude Code can use this llama.cpp build directly because the server exposes an Anthropic-compatible endpoint at:

```text
http://127.0.0.1:8080/v1/messages
```

Keep Claude Code cloud-default for normal use, and use an opt-in wrapper or shell prefix when testing the local model:

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:8080 \
ANTHROPIC_AUTH_TOKEN=local \
ANTHROPIC_MODEL=qwen3.5-35b-claude \
ANTHROPIC_CUSTOM_MODEL_OPTION=qwen3.5-35b-claude \
ANTHROPIC_CUSTOM_MODEL_OPTION_NAME="Qwen 3.5 local llama.cpp" \
CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1 \
CLAUDE_CODE_ATTRIBUTION_HEADER=0 \
claude --model qwen3.5-35b-claude
```

Read-only tool-call smoke test:

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:8080 \
ANTHROPIC_AUTH_TOKEN=local \
ANTHROPIC_MODEL=qwen3.5-35b-claude \
ANTHROPIC_CUSTOM_MODEL_OPTION=qwen3.5-35b-claude \
CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1 \
CLAUDE_CODE_ATTRIBUTION_HEADER=0 \
claude -p --verbose \
  --model qwen3.5-35b-claude \
  --output-format stream-json \
  --tools Grep \
  --allowedTools Grep \
  -- "Use Grep to find files mentioning llama-cpp metrics in this repository. Then answer CLAUDE_TOOL_OK if at least one match is found."
```

Observed result:

```text
CLAUDE_TOOL_OK
```

Direct Anthropic endpoint validation:

```bash
curl -sS http://127.0.0.1:8080/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3.5-35b-claude",
    "max_tokens": 512,
    "messages": [
      { "role": "user", "content": "Use the search_repo tool to find files mentioning llama-cpp metrics." }
    ],
    "tools": [
      {
        "name": "search_repo",
        "description": "Search repository text for a pattern.",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" }
          },
          "required": ["query"]
        }
      }
    ]
  }'
```

Expected response shape includes:

```json
{
  "type": "tool_use",
  "name": "search_repo",
  "input": {
    "query": "llama-cpp metrics"
  }
}
```

## Secondary Pi Setup

If the secondary Pi runs opencode or Claude Code as a client but does not run llama.cpp locally, point clients at the llama.cpp box instead of `127.0.0.1`.

Use the LAN address when on the local network:

```text
http://192.168.1.215:8080
```

Use the Tailscale address or MagicDNS name when remote. Verify the actual address first:

```bash
tailscale status --self --peers=false
tailscale status
```

For opencode on the Pi:

```json
{
  "provider": {
    "llama-cpp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "llama.cpp (local network)",
      "options": {
        "baseURL": "http://192.168.1.215:8080/v1"
      }
    }
  },
  "model": "llama-cpp/qwen3.5-35b-claude",
  "small_model": "llama-cpp/qwen3.5-35b-claude"
}
```

For Claude Code on the Pi:

```bash
ANTHROPIC_BASE_URL=http://192.168.1.215:8080 \
ANTHROPIC_AUTH_TOKEN=local \
ANTHROPIC_MODEL=qwen3.5-35b-claude \
ANTHROPIC_CUSTOM_MODEL_OPTION=qwen3.5-35b-claude \
CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1 \
claude --model qwen3.5-35b-claude
```

Before testing tools from the Pi, confirm connectivity:

```bash
curl -sf http://192.168.1.215:8080/health
curl -sf http://192.168.1.215:8080/v1/models
```

If those fail, check the llama.cpp service bind address, firewall rules, and whether the Pi should use the LAN address or Tailscale address.

## Validation Checklist

Run these after changing either machine:

```bash
opencode debug config
systemctl --user show opencode-web.service -p Environment
curl -sf http://127.0.0.1:8080/v1/models
```

On a remote Pi client, replace `127.0.0.1` with the llama.cpp host address.

Run one opencode web search:

```bash
OPENCODE_ENABLE_EXA=1 opencode run \
  --model llama-cpp/qwen3.5-35b-claude \
  "Use websearch to find the current OpenCode tools documentation. Then answer TOOL_OK and the URL."
```

Run one Claude Code local tool test:

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:8080 \
ANTHROPIC_AUTH_TOKEN=local \
ANTHROPIC_MODEL=qwen3.5-35b-claude \
ANTHROPIC_CUSTOM_MODEL_OPTION=qwen3.5-35b-claude \
CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1 \
claude -p --verbose --model qwen3.5-35b-claude \
  --output-format stream-json \
  --tools Grep \
  --allowedTools Grep \
  -- "Use Grep to find files mentioning llama-cpp metrics. Then answer CLAUDE_TOOL_OK if any match exists."
```

## References

- OpenCode tools: https://opencode.ai/docs/tools/
- OpenCode config: https://opencode.ai/docs/config/
- OpenCode permissions: https://opencode.ai/docs/permissions/
- OpenCode providers: https://opencode.ai/docs/providers/
- Claude Code environment variables: https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables
- Claude Code LLM gateway: https://docs.anthropic.com/en/docs/claude-code/llm-gateway
- Claude Code tools: https://docs.anthropic.com/en/docs/claude-code/settings#tools-available-to-claude
- llama.cpp function calling: https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md
