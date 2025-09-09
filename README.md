# Obsidian Book Prioritization Script

A DataviewJS script for Obsidian that intelligently organizes and prioritizes your book reading list. This script parses book entries from your notes and displays them in organized sections based on reading status, priority, and media type.

## Features

- **Smart Book Detection**: Automatically identifies book entries using Obsidian links (`[[Book Title]]`), hashtags (`#tag`), or "by Author" syntax
- **Priority-Based Organization**: Sort books by priority (1-5 scale) with higher priorities shown first
- **Media Type Support**: Organize books by media type (print, audio, family reading)
- **Reading Status Management**: Track books by status (currently-reading, up-next, to-read, finished, etc.)
- **Work-in-Progress (WIP) Limits**: Enforce limits on concurrent reading to avoid overcommitment
- **Flexible Configuration**: Easy-to-modify constants for limits and preferences
- **Comprehensive Testing**: Full test suite with unit tests, integration tests, and edge case coverage

## Installation

### Option 1: Copy Script to Obsidian

1. Copy the contents of `src/index.js`
2. In your Obsidian vault, create or edit a note where you want the book prioritization to appear
3. Add a DataviewJS code block with the script:

````javascript
```dataviewjs
// Paste the entire contents of src/index.js here
````

````

### Option 2: Use as Obsidian Template

1. Save `src/index.js.js` in your Obsidian vault's scripts folder
2. Create a template note with:

```javascript
```dataviewjs
await dv.view("src/index.js")
```
````

## Usage

The script automatically detects book entries in the following formats:

### Book Entry Formats

**Obsidian Links (Recommended)**

```markdown
1. [[Book Title]] #📚/status/currently-reading #media-type/print #priority/4
2. [[Author Name#Book Title|Display Name]] #📚/status/to-read #priority/3
```

**Plain Text with Author**

```markdown
- Book Title by Author Name #📚/status/currently-reading #priority/5
- Another Book by Famous Author #📚/status/to-read
```

**Inline Fields (Alternative)**

```markdown
1. Book Title status::currently-reading media-type::audio priority::3
```

### Status Tags

- `#📚/status/currently-reading` - Books you're actively reading
- `#📚/status/up-next` - Books queued to read next (higher priority than to-read)
- `#📚/status/to-read` - Books in your general reading list
- `#📚/status/finished` - Completed books (not displayed in prioritization)
- `#📚/status/paused` - Books you've started but paused
- `#📚/status/dnf` - Did not finish (abandoned books)

### Media Types

- `#media-type/print` or `#slot/print` - Physical or digital books (default)
- `#media-type/audio` or `#slot/audio` - Audiobooks
- `#media-type/family` or `#slot/family` - Family reading books

### Priority Levels

- `#priority/5` - Highest priority (must read)
- `#priority/4` - High priority
- `#priority/3` - Medium priority (default)
- `#priority/2` - Low priority
- `#priority/1` - Lowest priority

## Configuration

Modify these constants at the top of the script to customize behavior:

```javascript
const WIP = { print: 2, audio: 1, family: 2 }; // Work-in-progress limits per media type
const NEXT_LIMIT = 5; // Maximum books in "Next" queue
const LATER_LIMIT = 50; // Maximum books to display in "Later" section
```

## Output Sections

The script generates the following organized sections:

### Currently Reading

- Displays books with `currently-reading` status
- Organized by media type (print, audio, family)
- Sorted by priority (highest first)
- Respects WIP limits to prevent overcommitment

### Next (Queue)

- Shows next books to read (up to `NEXT_LIMIT`)
- Prioritizes `up-next` status books first
- Fills remaining slots with highest-priority `to-read` books
- Ensures no duplicates

### Later

- Remaining `to-read` books not in the Next queue
- Sorted by priority (highest first)
- Limited to `LATER_LIMIT` for performance
- Removes duplicate titles

## Example Book List Structure

````markdown
# My Reading List

## Currently Reading

1. [[The Passage]] #📚/status/currently-reading #media-type/print #priority/3
2. The Island of Sea Women #📚/status/currently-reading #media-type/audio #priority/4
3. [[On the Hippie Trail]] by Rick Steves #📚/status/currently-reading #media-type/family #priority/5

## Up Next

1. [[Good Anger]] #📚/status/up-next #media-type/print #priority/3
2. [[Meditations for Mortals]] #📚/status/up-next #media-type/print #priority/4

## To Read

1. [[Factfulness]] by [[Hans Rosling]] #📚/status/to-read #media-type/print #priority/5
2. [[Connections]] by James Burke #📚/status/to-read #media-type/print #priority/1
3. How Asia Works #📚/status/to-read #media-type/print #priority/3

## Finished Books

1. [[Like Water for Chocolate]] #📚/status/finished
2. [[The Underdogs - A Novel of the Mexican Revolution]] #📚/status/finished

```dataviewjs
// Paste the src/index.js.js script contents here
```
````

````

## Development

### Prerequisites

- Node.js 14+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Testing

The project includes comprehensive testing:

- **Unit Tests** (`helpers.test.js`): Test individual helper functions
- **Integration Tests** (`script.test.js`): Test full script functionality with mocked DataView API
- **Edge Case Tests** (`edge-cases.test.js`): Test error handling and unusual inputs

```bash
# Run all tests with coverage
npm test

# Run specific test file
npx jest helpers.test.js

# Run tests matching pattern
npx jest --testNamePattern="extractTitle"

# Continuous testing with Wallaby.js (if installed)
# See WALLABY.md for setup instructions
```

### Code Structure

The script follows a functional programming approach with pure functions:

- **Configuration**: `WIP`, `NEXT_LIMIT`, `LATER_LIMIT`
- **Basic Helpers**: `lower`, `trim`, `startsWith`, `isDigit`
- **Text Processing**: `stripCodeFences`, `stripListMarker`, `findTag`, `inlineField`
- **Book Parsing**: `extractTitle`, `looksLikeBookLine`, `statusFrom`, `mediaFrom`, `scoreFrom`
- **Array Processing**: `takeTop`, `sortByScoreDesc`, `uniqByTitle`

## Compatibility

- **Obsidian DataView Plugin**: Required for script execution
- **JavaScript**: ES2021 features, CommonJS compatible for testing
- **No External Dependencies**: Pure vanilla JavaScript for DataView compatibility
- **Browser Safe**: Script guards prevent errors when copied to browser environments

## Common Use Cases

### Academic Research
```markdown
- [[Research Methods in Psychology]] #📚/status/currently-reading #priority/5 #media-type/print
- [[Statistical Analysis Guide]] #📚/status/up-next #priority/4
```

### Fiction Reading
```markdown
- [[The Name of the Wind]] #📚/status/currently-reading #priority/3 #media-type/audio
- [[The Way of Kings]] #📚/status/to-read #priority/2
```

### Family Reading Time
```markdown
- [[Charlotte's Web]] #📚/status/currently-reading #media-type/family #priority/5
- [[Harry Potter and the Sorcerer's Stone]] #📚/status/up-next #media-type/family #priority/4
```

## Troubleshooting

### Books Not Appearing
- Ensure books have proper status tags (`#📚/status/...`)
- Check that lines contain book indicators (links, hashtags, or "by Author")
- Verify the book line isn't inside a code block

### Wrong Priority Order
- Confirm priority tags use format `#priority/1` through `#priority/5`
- Remember higher numbers = higher priority
- Check for typos in priority tags

### Missing Media Types
- Default media type is "print" if not specified
- Use `#media-type/audio` or `#slot/audio` format
- Verify spelling of media type tags

### WIP Limits Not Working
- Check WIP configuration matches your media types
- Ensure media type tags are properly formatted
- Remember WIP only applies to "currently-reading" books

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and add tests
4. Run the test suite (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - feel free to use and modify for your personal or commercial projects.

## Changelog

### v1.0.0
- Initial release with core prioritization features
- Comprehensive test suite with 95+ tests
- Support for multiple book entry formats
- WIP limits and configurable display limits
- Media type organization (print, audio, family)
- Priority-based sorting with 5-point scale
````
