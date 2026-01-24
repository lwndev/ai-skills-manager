# Anthropic Skills Documentation

This directory contains local copies of Anthropic's official documentation for Claude Code Agent Skills.

## About This Documentation

Anthropic maintains documentation for their implementation of Agent Skills within Claude Code. This documentation is specific to how Claude Code discovers, loads, and executes skills.

**Key characteristics:**

- Vendor-specific to Claude Code
- Covers Claude Code's skill loading behavior and frontmatter fields
- Includes best practices tailored to Claude's capabilities
- Maintained at [platform.claude.com](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

## Contents

| File | Description | Source |
|------|-------------|--------|
| `agent-skills-overview-20251229.md` | Overview of how Agent Skills work in Claude Code | [Link](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) |
| `agent-skills-quickstart-20251229.md` | Quick start guide for creating skills | [Link](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart) |
| `agent-skills-best-practices-20251229.md` | Best practices for writing effective skills | [Link](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) |

## Relationship to Open Source Specification

The open source Agent Skills specification at [agentskills.io](https://agentskills.io) defines a vendor-neutral format that multiple AI tools can support. Anthropic's documentation describes how Claude Code specifically implements and extends this format.

See `docs/agent-skills-io/` for the open source specification.
