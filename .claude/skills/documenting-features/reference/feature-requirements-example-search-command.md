# Feature Requirements: Search Command

## Overview

Enable users to search for podcasts using keywords to discover feed URLs for downloading episodes.

## Feature ID
`FEAT-001`

## Priority
High - Core discovery feature

## User Story

As a podcast listener, I want to search for podcasts by keywords so that I can find feed URLs to download specific episodes.

## Command Syntax

```bash
pullapod search <query> [options]
```

### Arguments

- `<query>` (required) - Search term(s) to find podcasts

### Options

- `--max <number>` - Maximum results to return (default: 10, range: 1-100)
- `--title-only` - Search titles only instead of all fields (more precise)
- `--similar` - Include similar matches in results (fuzzy matching)
- `--language <code>` - Filter by language code (e.g., 'en', 'es', 'fr')

### Examples

```bash
# Basic search
pullapod search javascript

# Search with result limit
pullapod search "web development" --max 20

# Title-only search
pullapod search "The Daily" --title-only

# Filter by language
pullapod search technology --language en

# Include similar matches (fuzzy search)
pullapod search "javascrpt" --similar
```

## Functional Requirements

### FR-1: Search Execution
- Execute search query against Podcast Index API
- Use `searchByTerm()` for general search
- Use `searchByTitle()` when `--title-only` flag is set
- Handle multi-word queries correctly

### FR-2: Result Display
Display search results in numbered list format with:
- Podcast title
- Author/creator name
- Total episode count
- Language
- Feed URL (prominently displayed)
- Description (truncated to ~200 characters)

### FR-3: Result Ordering
- Display results in order returned by API (relevance-ranked)
- Number results starting from 1

### FR-4: Result Limits
- Default to 10 results if `--max` not specified
- Enforce minimum of 1 result
- Enforce maximum of 100 results (API supports up to 1000, but limit for CLI usability)
- Display actual count returned if less than requested max

### FR-5: No Results Handling
- Display clear message when no results found
- Suggest alternative searches or checking spelling
- Exit gracefully with exit code 0

### FR-6: User Guidance
- Include helpful message showing how to use feed URL with download command
- Example: "Use feed URL with: pullapod --feed <feed-url> [options]" or "pullapod download --feed <feed-url> [options]"

## Output Format

```
Found 5 podcasts matching "javascript":

1. JavaScript Jabber
   by Devchat.tv
   Episodes: 547 | Language: en
   Feed: https://feeds.fireside.fm/javascriptjabber/rss
   Description: Weekly panel discussion about JavaScript, front-end
   development, and the life of a software developer. Lorem ipsum dolor
   sit amet, consectetur adipiscing elit...

2. JS Party – JavaScript, CSS, Web Development
   by Changelog Media
   Episodes: 312 | Language: en
   Feed: https://changelog.com/jsparty/feed
   Description: A community celebration of JavaScript and the web.
   Panelists include Jerod Santo, Feross Aboukhadijeh, Kevin Ball...

3. Syntax - Tasty Web Development Treats
   by Wes Bos & Scott Tolinski
   Episodes: 685 | Language: en
   Feed: https://feed.syntax.fm/rss
   Description: Full Stack Developers Wes Bos and Scott Tolinski dive
   deep into web development topics, explaining how they work and talking...

---
Tip: Download episodes with: pullapod --feed <feed-url> --date YYYY-MM-DD
```

## Non-Functional Requirements

### NFR-1: Performance
- Search requests should complete within 5 seconds under normal network conditions
- Display results as soon as received (no artificial delays)

### NFR-2: Error Handling
- Network errors: Display clear message with suggestion to check connection
- API errors: Display error message from Podcast Index API
- Invalid parameters: Show helpful error with correct usage
- Rate limiting: Display clear message about rate limits and suggest retry timing

### NFR-3: API Configuration
- Require Podcast Index API credentials to be configured
- Display helpful error message if credentials missing
- Reference configuration documentation

### NFR-4: Output Quality
- Ensure feed URLs are copy-pasteable (no line wrapping within URL)
- Truncate descriptions at word boundaries (don't cut mid-word)
- Handle special characters in titles/descriptions correctly
- Format consistently with existing pullapod CLI output

## API Integration

### Podcast Index API Methods Used

**For general search:**
```typescript
await client.searchByTerm({
  q: query,
  max: maxResults,
  similar: similarFlag,  // Optional: include similar matches
  // Note: language filtering not directly supported by searchByTerm
});
```

**For title-only search:**
```typescript
await client.searchByTitle({
  q: query,
  max: maxResults,
  similar: similarFlag,  // Optional: include similar matches
  // Note: language filtering not directly supported by searchByTitle
});
```

### Response Data Used
From `PodcastFeed` interface:
- `title` - Podcast title
- `author` or `ownerName` - Creator name
- `episodeCount` - Total episodes
- `language` - Language code
- `url` - RSS feed URL
- `description` - Podcast description

## Dependencies

- Existing `PodcastIndexClient` class
- Podcast Index API credentials configured
- Commander.js for CLI argument parsing
- Existing configuration system (`loadPodcastIndexConfig()`)

## Edge Cases

1. **Empty query string**: Display error and usage help
2. **Very long descriptions**: Truncate with "..." indicator
3. **Missing episode count**: Display "N/A" or omit field
4. **No feed URL**: Skip result or show "N/A" (should not happen with API)
5. **Special characters in query**: Pass through to API (let API handle)
6. **Language filter on title-only**: Note that language filtering may require client-side filtering if not supported by API

## Testing Requirements

### Unit Tests
- Query parsing and validation
- Option parsing and defaults
- Result formatting logic
- Error message formatting

### Integration Tests
- Search with various query types
- Option combinations work correctly
- API error handling
- Network timeout handling

### Manual Testing
- Search for known podcasts
- Test with no results
- Test with max results limit
- Test language filtering
- Verify feed URLs work with download command

## Future Enhancements

- Add `--format json` option for programmatic use
- Add `--category` filter option
- Interactive result selection (prompt user to choose)
- Cache recent searches for faster repeat queries

## Acceptance Criteria

- [ ] Command accepts query and all specified options
- [ ] Search results display in specified format
- [ ] Feed URLs are correct and usable with download command
- [ ] All options work as specified
- [ ] Error handling covers all specified cases
- [ ] Help text is clear and accurate
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated