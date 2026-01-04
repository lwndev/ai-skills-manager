# Feature Requirements: Episodes Command

## Overview

Enable users to preview recent episodes from a podcast feed before deciding which specific episodes to download.

## Feature ID
`FEAT-002`

## Priority
High - Core preview feature

## User Story

As a podcast listener, I want to see recent episodes from a feed so that I can identify which specific episodes I want to download by date or name.

## Command Syntax

```bash
pullapod episodes <feed-url> [options]
```

### Arguments

- `<feed-url>` (required) - RSS feed URL or Podcast Index feed ID

### Options

- `--max <number>` - Maximum episodes to show (default: 20, range: 1-100)
- `--since <date>` - Only episodes after date (YYYY-MM-DD format)
- `--full` - Show full descriptions instead of truncated

### Examples

```bash
# Show recent episodes from feed
pullapod episodes https://feeds.fireside.fm/javascriptjabber/rss

# Show recent episodes using feed ID
pullapod episodes 920666

# Limit to 10 episodes
pullapod episodes https://feeds.fireside.fm/javascriptjabber/rss --max 10

# Episodes since specific date
pullapod episodes https://feeds.fireside.fm/javascriptjabber/rss --since 2024-01-01

# Show full descriptions
pullapod episodes https://feeds.fireside.fm/javascriptjabber/rss --full
```

## Functional Requirements

### FR-1: Feed Resolution
- Accept both RSS feed URL and Podcast Index feed ID as input
- If feed URL provided: Query API with `getEpisodesByFeedUrl()`
- If numeric ID provided: Query API with `getEpisodesByFeedId()`
- Auto-detect input type (numeric = ID, URL = feed URL)

### FR-2: Episode Display
Display episodes in numbered list format with:
- Episode number/identifier (if available)
- Episode title
- Publish date (human-readable format)
- Duration (human-readable: e.g., "52 min", "1h 23min")
- Audio file URL
- Description (truncated to ~150 characters unless `--full` flag)

### FR-3: Ordering
- Display episodes in reverse chronological order (newest first)
- Number episodes starting from 1

### FR-4: Result Limits
- Default to 20 episodes if `--max` not specified
- Enforce minimum of 1 episode
- Enforce maximum of 100 episodes (API supports more, but limit for CLI usability)
- Display actual count if fewer episodes exist than requested

### FR-5: Date Filtering
- Support `--since` option with YYYY-MM-DD format
- Convert date to Unix timestamp for API
- Validate date format before API call
- Show clear error for invalid date format

### FR-6: Duration Formatting
- Format seconds as human-readable duration
- Examples:
  - 0-59 seconds: "45 sec"
  - 60-3599 seconds: "52 min"
  - 3600+ seconds: "1h 23min"
- Handle missing/zero duration: display "N/A"

### FR-7: Description Handling
- Truncate descriptions to ~150 characters by default
- Truncate at word boundaries (don't cut mid-word)
- Add "..." if truncated
- With `--full` flag: display complete description
- Strip HTML tags from descriptions
- Handle missing descriptions: display "No description available"

### FR-8: Podcast Context
- Display podcast title at top of output
- Provide context about which feed is being shown

### FR-9: User Guidance
- Include helpful message showing how to download episodes
- Example: "Download with: pullapod <feed-url> --date YYYY-MM-DD"

### FR-10: No Episodes Handling
- Display clear message when no episodes found
- Differentiate between "no episodes exist" vs "no episodes match filter"
- Exit gracefully with exit code 0

## Output Format

```
Recent episodes from "JavaScript Jabber":

1. JSJ 547: Modern React Patterns with Dan Abramov
   Published: Jan 15, 2024
   Duration: 52 min
   URL: https://cdn.fireside.fm/episode547.mp3
   Description: In this episode we discuss modern React patterns with special
   guest Dan Abramov, covering server components, suspense, and the future of
   React development...

2. JSJ 546: TypeScript 5.0 Deep Dive
   Published: Jan 08, 2024
   Duration: 48 min
   URL: https://cdn.fireside.fm/episode546.mp3
   Description: A deep dive into the new features in TypeScript 5.0, including
   decorators, const type parameters, and improved type inference...

3. JSJ 545: Web Performance Tips
   Published: Jan 01, 2024
   Duration: 1h 15min
   URL: https://cdn.fireside.fm/episode545.mp3
   Description: Performance optimization techniques for modern web applications,
   covering bundle size, lazy loading, caching strategies, and measuring...

---
Showing 3 episodes (use --max to show more)
Download with: pullapod <feed-url> --date YYYY-MM-DD --name "episode title"
```

## Non-Functional Requirements

### NFR-1: Performance
- Episode list requests should complete within 5 seconds under normal conditions
- Display results as soon as received

### NFR-2: Error Handling
- Invalid feed URL: Display clear error message
- Invalid feed ID: Display error indicating feed not found
- Network errors: Display clear message with retry suggestion
- API errors: Display error message from Podcast Index API
- Invalid date format: Show error with correct format example
- Rate limiting: Display clear message about rate limits

### NFR-3: API Configuration
- Require Podcast Index API credentials
- Display helpful error if credentials missing

### NFR-4: Output Quality
- Ensure audio URLs are copy-pasteable (no line wrapping)
- Format dates consistently (e.g., "Jan 15, 2024" or "2024-01-15")
- Handle special characters in titles/descriptions correctly
- Align formatting with existing pullapod CLI output

### NFR-5: Data Validation
- Validate feed URL format before API call
- Validate feed ID is numeric
- Validate date format matches YYYY-MM-DD

## API Integration

### Podcast Index API Methods Used

**For feed URL:**
```typescript
const result = await client.getEpisodesByFeedUrl({
  url: feedUrl,
  max: maxEpisodes,
  since: sinceTimestamp, // if --since provided
  fulltext: true, // always request full text
});
```

**For feed ID:**
```typescript
const result = await client.getEpisodesByFeedId({
  id: feedId,
  max: maxEpisodes,
  since: sinceTimestamp,
  fulltext: true,
});
```

### Response Data Used
From `PodcastEpisode` interface:
- `title` - Episode title
- `datePublished` - Unix timestamp
- `duration` - Duration in seconds
- `enclosureUrl` - Audio file URL
- `description` - Episode description
- `episode` - Episode number (if available)
- `feedTitle` - Podcast title

## Dependencies

- Existing `PodcastIndexClient` class
- Podcast Index API credentials configured
- Commander.js for CLI argument parsing
- Date parsing utilities
- HTML stripping utility (for descriptions)

## Edge Cases

1. **Feed doesn't exist**: Display "Feed not found" error
2. **Feed has no episodes**: Display "No episodes found" message
3. **Very long titles**: Allow wrapping but maintain readability
4. **Missing episode numbers**: Omit episode number, just show title
5. **Zero duration**: Display "N/A" or omit duration field
6. **HTML in descriptions**: Strip all HTML tags
7. **Malformed audio URLs**: Still display, let download command handle validation
8. **Future dates**: Display as provided (may happen with scheduled episodes)
9. **Feed URL vs Feed ID ambiguity**: Prefer feed ID if input is purely numeric

## Testing Requirements

### Unit Tests
- Feed URL vs ID detection logic
- Date format validation and conversion
- Duration formatting logic
- Description truncation at word boundaries
- HTML stripping from descriptions

### Integration Tests
- Query by feed URL
- Query by feed ID
- Date filtering with --since
- Max results limiting
- Full description display
- API error handling

### Manual Testing
- Test with known feeds
- Test with feed that has few episodes
- Test with invalid feed URLs
- Test date filtering
- Verify audio URLs work with download command
- Test with feeds that have HTML in descriptions

## Future Enhancements

- Add `--search` option to filter episodes by keyword
- Add `--format json` for programmatic use
- Show episode file size
- Show episode explicit flag
- Add pagination for very long episode lists
- Interactive episode selection
- Date range filtering (--start and --end)

## Acceptance Criteria

- [ ] Command accepts feed URL or feed ID
- [ ] Episodes display in specified format
- [ ] Date filtering works correctly
- [ ] Duration formatting is human-readable
- [ ] Descriptions are properly truncated/displayed
- [ ] All options work as specified
- [ ] Error handling covers all specified cases
- [ ] Help text is clear and accurate
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated