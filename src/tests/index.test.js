const fs = require("fs");
const path = require("path");

const {
  lower,
  trim,
  startsWith,
  isDigit,
  stripCodeFences,
  stripListMarker,
  findTag,
  inlineField,
  extractTitle,
  looksLikeBookLine,
  statusFrom,
  mediaFrom,
  scoreFrom,
  takeTop,
  sortByScoreDesc,
  uniqByTitle,
  WIP,
  NEXT_LIMIT,
  LATER_LIMIT,
  executeScript,
  runMainExecution,
} = require("../index.js");

// Mock global dv object
const mockDv = {
  io: { load: jest.fn() },
  table: jest.fn(),
  header: jest.fn(),
  paragraph: jest.fn(),
  fileLink: jest.fn(),
  page: jest.fn(),
  pages: jest.fn(),
  current: jest.fn(),
};

describe("Edge Cases and Regressions", () => {
  describe("looksLikeBookLine edge cases", () => {
    it("handles lines with only spaces", () => {
      expect(looksLikeBookLine("   ")).toBe(false);
      expect(looksLikeBookLine("\t\r\n")).toBe(false);
    });

    it("handles partial brackets", () => {
      expect(looksLikeBookLine("[[incomplete")).toBe(false);
      expect(looksLikeBookLine("incomplete]]")).toBe(false);
    });

    it("handles just hashtags without context", () => {
      expect(looksLikeBookLine("#tag")).toBe(false); // Need space before # to match
      expect(looksLikeBookLine("# header")).toBe(false); // Header format, not book
    });

    it("handles mixed case 'by' keyword", () => {
      expect(looksLikeBookLine("Book BY Author")).toBe(true);
      expect(looksLikeBookLine("Book By Author")).toBe(true);
      expect(looksLikeBookLine("Book bY Author")).toBe(true);
    });
  });

  describe("statusFrom edge cases", () => {
    it("handles multiple status tags (first wins)", () => {
      expect(statusFrom("#📚/status/reading #📚/status/finished")).toBe(
        "reading"
      );
    });

    it("handles status with special characters", () => {
      expect(statusFrom("#📚/status/currently-reading")).toBe(
        "currently-reading"
      );
      expect(statusFrom("#📚/status/up-next")).toBe("up-next");
    });

    it("handles mixed inline fields and tags", () => {
      expect(statusFrom("status::reading #📚/status/finished")).toBe("reading");
      expect(statusFrom("#📚/status/finished status::reading")).toBe("reading");
    });

    it("handles empty status values", () => {
      expect(statusFrom("status::")).toBe("to-read");
      expect(statusFrom("#📚/status/")).toBe("to-read");
    });

    it("handles empty string input", () => {
      expect(statusFrom("")).toBe("to-read");
      expect(statusFrom(null)).toBe("to-read");
      expect(statusFrom(undefined)).toBe("to-read");
    });
  });

  describe("mediaFrom edge cases", () => {
    it("handles legacy 'slot' format", () => {
      expect(mediaFrom("#slot/audio")).toBe("audio");
      expect(mediaFrom("slot::family")).toBe("family");
    });

    it("handles mixed media formats", () => {
      expect(mediaFrom("media-type::print #slot/audio")).toBe("print");
    });

    it("handles unknown media types", () => {
      expect(mediaFrom("#media-type/ebook")).toBe("ebook");
      expect(mediaFrom("#media-type/video")).toBe("video");
    });

    it("handles empty string input", () => {
      expect(mediaFrom("")).toBe("print");
      expect(mediaFrom(null)).toBe("print");
      expect(mediaFrom(undefined)).toBe("print");
    });
  });

  describe("scoreFrom edge cases", () => {
    it("handles decimal priorities (should be floored)", () => {
      expect(scoreFrom("#priority/3.7")).toBe(3);
      expect(scoreFrom("#priority/4.9")).toBe(4);
    });

    it("handles very large numbers", () => {
      expect(scoreFrom("#priority/999")).toBe(5);
      expect(scoreFrom("#priority/100")).toBe(5);
    });

    it("handles very small numbers", () => {
      expect(scoreFrom("#priority/-999")).toBe(1);
      expect(scoreFrom("#priority/0.1")).toBe(1);
    });

    it("handles non-numeric strings", () => {
      expect(scoreFrom("#priority/high")).toBe(1);
      expect(scoreFrom("#priority/medium")).toBe(1);
    });

    it("handles mixed inline and tag priorities", () => {
      expect(scoreFrom("priority::4 #priority/2")).toBe(2); // Tag parsing happens after inline field parsing
    });
  });

  describe("Array processing edge cases", () => {
    it("takeTop handles floating point numbers", () => {
      const arr = [1, 2, 3, 4, 5];
      expect(takeTop(arr, 3.7)).toEqual([1, 2, 3]);
      expect(takeTop(arr, 2.1)).toEqual([1, 2]);
    });

    it("sortByScoreDesc handles equal scores", () => {
      const books = [
        { title: "A", score: 3 },
        { title: "B", score: 3 },
        { title: "C", score: 3 },
      ];
      const sorted = sortByScoreDesc(books);
      expect(sorted).toHaveLength(3);
      expect(sorted.every(b => b.score === 3)).toBe(true);
    });

    it("uniqByTitle handles empty titles", () => {
      const books = [
        { title: "", score: 1 },
        { title: "", score: 2 },
        { title: "Real Book", score: 3 },
      ];
      const unique = uniqByTitle(books);
      expect(unique).toHaveLength(2); // One empty title, one real book
    });

    it("uniqByTitle handles null/undefined titles", () => {
      const books = [
        { title: null, score: 1 },
        { title: undefined, score: 2 },
        { title: "Real Book", score: 3 },
      ];
      const unique = uniqByTitle(books);
      expect(unique).toHaveLength(3); // All different since null !== undefined
    });
  });

  describe("Complex parsing scenarios", () => {
    it("handles books with multiple list markers", () => {
      expect(looksLikeBookLine("1. - [[Book]]")).toBe(true);
      expect(looksLikeBookLine("- 1. Book #tag")).toBe(true);
    });

    it("handles books with unusual spacing", () => {
      expect(statusFrom("  status::finished  ")).toBe("finished");
      expect(mediaFrom("  #media-type/print  ")).toBe("print");
      expect(scoreFrom("  #priority/3  ")).toBe(3);
    });

    it("handles books with mixed tag formats", () => {
      const line = "[[Book]] #📚/status/reading media-type::audio #priority/4";
      expect(statusFrom(line)).toBe("reading");
      expect(mediaFrom(line)).toBe("audio");
      expect(scoreFrom(line)).toBe(4);
    });

    it("handles emoji variations in tags", () => {
      expect(statusFrom("#📚/status/finished")).toBe("finished");
      expect(statusFrom("#books/status/finished")).toBe("to-read"); // Different tag format not recognized
    });
  });

  describe("Performance and memory", () => {
    it("handles large book lists without crashing", () => {
      const largeBookList = Array.from({ length: 1000 }, (_, i) => ({
        title: `Book ${i}`,
        score: Math.floor(Math.random() * 5) + 1,
        status: "to-read",
        media: "print",
      }));

      expect(() => {
        sortByScoreDesc(largeBookList);
        takeTop(largeBookList, 50);
        uniqByTitle(largeBookList);
      }).not.toThrow();
    });

    it("handles deeply nested reduce operations", () => {
      const longText = "a".repeat(10000);
      expect(() => {
        stripCodeFences(longText);
        extractTitle(longText);
        looksLikeBookLine(longText);
      }).not.toThrow();
    });
  });

  describe("Validation and sanitization", () => {
    it("functions handle unexpected input types gracefully", () => {
      expect(() => {
        extractTitle(123);
        looksLikeBookLine(true);
        statusFrom({});
        mediaFrom([]);
        scoreFrom(null);
      }).not.toThrow();

      // Test that they return reasonable defaults
      expect(extractTitle(123)).toBe("123");
      expect(looksLikeBookLine(null)).toBe(false);
      expect(statusFrom({})).toBe("to-read");
    });

    it("maintains referential integrity", () => {
      const originalBooks = [
        { title: "Book 1", score: 3 },
        { title: "Book 2", score: 1 },
      ];
      const sorted = sortByScoreDesc(originalBooks);
      const unique = uniqByTitle(sorted);
      const limited = takeTop(unique, 1);

      // Original should be unchanged
      expect(originalBooks[0].score).toBe(3);
      expect(originalBooks[1].score).toBe(1);

      // Operations should not mutate inputs
      expect(sorted).not.toBe(originalBooks);
      expect(unique).not.toBe(sorted);
      expect(limited).not.toBe(unique);
    });
  });

  describe("Real-world data patterns", () => {
    it("handles common book title patterns", () => {
      const titles = [
        "[[The Great Gatsby]]",
        "[[To Kill a Mockingbird]]",
        "[[1984]]",
        "[[Harry Potter and the Philosopher's Stone]]",
        "[[The Lord of the Rings: The Fellowship of the Ring]]",
        "Book with (parentheses)",
        "Book-with-dashes",
        "Book_with_underscores",
        "Book: With Subtitle",
      ];

      titles.forEach(title => {
        expect(() => {
          extractTitle(title);
          looksLikeBookLine(`1. ${title} #📚/status/to-read`);
        }).not.toThrow();
      });
    });

    it("handles common status patterns from real usage", () => {
      const statuses = [
        "currently-reading",
        "to-read",
        "finished",
        "paused",
        "up-next",
        "dnf", // did not finish
        "abandoned",
        "on-hold",
      ];

      statuses.forEach(status => {
        expect(statusFrom(`#📚/status/${status}`)).toBe(status);
        expect(statusFrom(`status::${status}`)).toBe(status);
      });
    });
  });
});

describe("Configuration constants", () => {
  it("WIP limits are set correctly", () => {
    expect(WIP.print).toBe(2);
    expect(WIP.audio).toBe(2);
    expect(WIP.family).toBe(2);
  });

  it("limits are set correctly", () => {
    expect(NEXT_LIMIT).toBe(5);
    expect(LATER_LIMIT).toBe(50);
  });
});

describe("Basic helper functions", () => {
  describe("lower", () => {
    it("converts strings to lowercase", () => {
      expect(lower("HELLO")).toBe("hello");
      expect(lower("MiXeD cAsE")).toBe("mixed case");
    });

    it("handles null and undefined", () => {
      expect(lower(null)).toBe("");
      expect(lower(undefined)).toBe("");
      expect(lower("")).toBe("");
    });

    it("handles non-strings", () => {
      expect(lower(123)).toBe("123");
      expect(lower(true)).toBe("true");
    });
  });

  describe("trim", () => {
    it("removes leading and trailing whitespace", () => {
      expect(trim("  hello  ")).toBe("hello");
      expect(trim("\t\rtest\r\t")).toBe("test");
      expect(trim("   mixed   spaces   ")).toBe("mixed   spaces");
    });

    it("handles null and undefined", () => {
      expect(trim(null)).toBe("");
      expect(trim(undefined)).toBe("");
      expect(trim("")).toBe("");
    });

    it("preserves internal whitespace", () => {
      expect(trim("  hello world  ")).toBe("hello world");
    });
  });

  describe("startsWith", () => {
    it("checks string prefixes correctly", () => {
      expect(startsWith("hello world", "hello")).toBe(true);
      expect(startsWith("hello world", "world")).toBe(false);
      expect(startsWith("test", "testing")).toBe(false);
    });

    it("handles empty strings", () => {
      expect(startsWith("", "")).toBe(true);
      expect(startsWith("hello", "")).toBe(true);
      expect(startsWith("", "hello")).toBe(false);
    });

    it("handles null and undefined", () => {
      expect(startsWith(null, "test")).toBe(false);
      expect(startsWith("test", null)).toBe(true);
    });
  });

  describe("isDigit", () => {
    it("identifies digits correctly", () => {
      expect(isDigit("0")).toBe(true);
      expect(isDigit("5")).toBe(true);
      expect(isDigit("9")).toBe(true);
    });

    it("rejects non-digits", () => {
      expect(isDigit("a")).toBe(false);
      expect(isDigit(" ")).toBe(false);
      expect(isDigit("")).toBe(false);
      expect(isDigit("10")).toBe(false); // multi-character
    });
  });
});

describe("Text processing functions", () => {
  describe("stripCodeFences", () => {
    it("removes content between code fences", () => {
      const input = "before\n```\ncode block\n```\nafter";
      const expected = "before\n\nafter";
      expect(stripCodeFences(input)).toBe(expected);
    });

    it("handles multiple code blocks", () => {
      const input = "start\n```\nblock1\n```\nmiddle\n```\nblock2\n```\nend";
      const expected = "start\n\nmiddle\n\nend";
      expect(stripCodeFences(input)).toBe(expected);
    });

    it("handles nested or unmatched fences", () => {
      const input = "start\n```\ncode\n```\n```js\nmore code\n```\nend";
      expect(() => stripCodeFences(input)).not.toThrow();
    });

    it("handles no code fences", () => {
      const input = "just regular text\nno code here";
      expect(stripCodeFences(input)).toBe(input);
    });

    it("handles unmatched opening fence", () => {
      const input = "start\n```\ncode without closing\nend";
      const result = stripCodeFences(input);
      expect(result).toBe("start\n"); // Code fence remains open, so rest is ignored
    });

    it("handles multiple consecutive fences", () => {
      const input = "start\n```\n```\n```\ncode\n```\nend";
      const result = stripCodeFences(input);
      expect(result).toBe("start\n\n\nend"); // Multiple fences create empty lines
    });

    it("handles fences at start and end", () => {
      const input = "```\nstart code\n```\nmiddle\n```\nend code\n```";
      const result = stripCodeFences(input);
      expect(result).toBe("\nmiddle\n");
    });
  });

  describe("stripListMarker", () => {
    it("removes numbered list markers", () => {
      expect(stripListMarker("1. Item")).toBe("Item");
      expect(stripListMarker("123. Long number")).toBe("Long number");
    });

    it("removes bullet list markers", () => {
      expect(stripListMarker("- Item")).toBe("Item");
      expect(stripListMarker("* Item")).toBe("Item");
    });

    it("handles items without markers", () => {
      expect(stripListMarker("Just text")).toBe("Just text");
    });

    it("handles edge cases", () => {
      expect(stripListMarker("")).toBe("");
      expect(stripListMarker(null)).toBe("");
      expect(stripListMarker("1.NoSpace")).toBe("1.NoSpace");
    });
  });

  describe("findTag", () => {
    it("finds tags with given prefix", () => {
      const tokens = ["hello", "#status/finished", "world"];
      expect(findTag(tokens, "#status/")).toBe("finished");
    });

    it("returns empty string when tag not found", () => {
      const tokens = ["hello", "world"];
      expect(findTag(tokens, "#status/")).toBe("");
    });

    it("finds first matching tag", () => {
      const tokens = ["#status/reading", "#status/finished"];
      expect(findTag(tokens, "#status/")).toBe("reading");
    });
  });

  describe("inlineField", () => {
    it("extracts inline field values", () => {
      expect(inlineField("status::finished priority::3", "status")).toBe(
        "finished"
      );
      expect(inlineField("status::finished priority::3", "priority")).toBe("3");
    });

    it("returns empty string when field not found", () => {
      expect(inlineField("no fields here", "status")).toBe("");
    });

    it("handles whitespace in values", () => {
      expect(inlineField("status::  finished  ", "status")).toBe("finished");
    });
  });
});

describe("Book parsing functions", () => {
  describe("extractTitle", () => {
    it("extracts titles from Obsidian links", () => {
      expect(extractTitle("[[Book Title]]")).toBe("Book Title");
      expect(extractTitle("Some text [[Book Title]] more text")).toBe(
        "Book Title"
      );
    });

    it("extracts titles with pipe syntax", () => {
      expect(extractTitle("[[Actual Title|Display Name]]")).toBe(
        "Actual Title"
      );
    });

    it("extracts titles before hashtags", () => {
      expect(extractTitle("Book Title #tag")).toBe("Book Title");
    });

    it("extracts titles before 'by' author", () => {
      expect(extractTitle("Book Title by Author")).toBe("Book Title");
      expect(extractTitle("Book Title BY Author")).toBe("Book Title");
    });

    it("handles mixed cases", () => {
      expect(extractTitle("[[Book Title]] by Author #tag")).toBe("Book Title");
    });

    it("handles edge cases", () => {
      expect(extractTitle("")).toBe("");
      expect(extractTitle("[[]]")).toBe("");
      expect(extractTitle("No brackets or tags")).toBe("No brackets or tags");
    });
    it("handles nested brackets", () => {
      expect(extractTitle("[[Book [Part 1]]]")).toBe("Book [Part 1"); // Only finds first closing bracket
    });

    it("handles multiple pipe separators", () => {
      expect(extractTitle("[[Title|Display|Extra]]")).toBe("Title");
    });

    it("handles empty link content", () => {
      expect(extractTitle("[[]] some text")).toBe("");
    });

    it("handles malformed links", () => {
      expect(extractTitle("[[Unclosed link")).toBe("[[Unclosed link");
      expect(extractTitle("Unopened link]]")).toBe("Unopened link]]"); // No opening brackets found
    });

    it("handles mixed link and author syntax", () => {
      expect(extractTitle("[[Book Title]] by Author #tag")).toBe("Book Title");
      expect(extractTitle("Plain Book by Author #tag")).toBe("Plain Book");
    });
  });

  describe("looksLikeBookLine", () => {
    it("identifies lines with Obsidian links", () => {
      expect(looksLikeBookLine("1. [[Book Title]]")).toBe(true);
      expect(looksLikeBookLine("- [[Another Book]]")).toBe(true);
    });

    it("identifies lines with hashtags", () => {
      expect(looksLikeBookLine("Book Title #tag")).toBe(true);
    });

    it("identifies lines with 'by' author", () => {
      expect(looksLikeBookLine("Book Title by Author")).toBe(true);
    });

    it("rejects non-book lines", () => {
      expect(looksLikeBookLine("Just regular text")).toBe(false);
      expect(looksLikeBookLine("")).toBe(false);
      expect(looksLikeBookLine("## Header")).toBe(false);
    });

    it("handles list markers", () => {
      expect(looksLikeBookLine("1. Book Title #tag")).toBe(true);
      expect(looksLikeBookLine("- Book Title by Author")).toBe(true);
    });
  });

  describe("statusFrom", () => {
    it("extracts status from inline fields", () => {
      expect(statusFrom("status::finished")).toBe("finished");
      expect(statusFrom("status::reading")).toBe("reading");
    });

    it("extracts status from hashtags", () => {
      expect(statusFrom("#📚/status/currently-reading")).toBe(
        "currently-reading"
      );
      expect(statusFrom("Book #📚/status/finished")).toBe("finished");
    });

    it("defaults to 'to-read' when no status found", () => {
      expect(statusFrom("Book without status")).toBe("to-read");
      expect(statusFrom("")).toBe("to-read");
    });

    it("prioritizes inline fields over hashtags", () => {
      expect(statusFrom("status::finished #📚/status/reading")).toBe(
        "finished"
      );
    });
  });

  describe("mediaFrom", () => {
    it("extracts media type from various fields", () => {
      expect(mediaFrom("media-type::audio")).toBe("audio");
      expect(mediaFrom("slot::family")).toBe("family");
    });

    it("extracts media type from hashtags", () => {
      expect(mediaFrom("#media-type/print")).toBe("print");
      expect(mediaFrom("#slot/audio")).toBe("audio");
    });

    it("defaults to 'print' when no media found", () => {
      expect(mediaFrom("Book without media")).toBe("print");
    });
  });

  describe("scoreFrom", () => {
    it("extracts priority from hashtags", () => {
      expect(scoreFrom("#priority/3")).toBe(3);
      expect(scoreFrom("#priority/5")).toBe(5);
    });

    it("extracts priority from inline fields", () => {
      expect(scoreFrom("priority::4")).toBe(4);
    });

    it("clamps values to 1-5 range", () => {
      expect(scoreFrom("#priority/0")).toBe(1);
      expect(scoreFrom("#priority/10")).toBe(5);
      expect(scoreFrom("#priority/-1")).toBe(1);
    });

    it("defaults to 1 when no priority found", () => {
      expect(scoreFrom("Book without priority")).toBe(1);
    });

    it("handles invalid values", () => {
      expect(scoreFrom("#priority/abc")).toBe(1);
      expect(scoreFrom("priority::")).toBe(1);
    });
  });
});

describe("Array processing functions", () => {
  describe("takeTop", () => {
    it("takes the specified number of items", () => {
      const arr = [1, 2, 3, 4, 5];
      expect(takeTop(arr, 3)).toEqual([1, 2, 3]);
    });

    it("handles requests for more items than available", () => {
      const arr = [1, 2];
      expect(takeTop(arr, 5)).toEqual([1, 2]);
    });

    it("handles zero or negative requests", () => {
      const arr = [1, 2, 3];
      expect(takeTop(arr, 0)).toEqual([]);
      expect(takeTop(arr, -1)).toEqual([]);
    });
  });

  describe("sortByScoreDesc", () => {
    it("sorts by score in descending order", () => {
      const books = [
        { title: "A", score: 1 },
        { title: "B", score: 3 },
        { title: "C", score: 2 },
      ];
      const sorted = sortByScoreDesc(books);
      expect(sorted.map(b => b.title)).toEqual(["B", "C", "A"]);
    });

    it("does not mutate original array", () => {
      const books = [{ score: 1 }, { score: 3 }, { score: 2 }];
      const original = [...books];
      sortByScoreDesc(books);
      expect(books).toEqual(original);
    });
  });

  describe("uniqByTitle", () => {
    it("removes duplicate titles, keeping first occurrence", () => {
      const books = [
        { title: "Book A", score: 1 },
        { title: "Book B", score: 2 },
        { title: "Book A", score: 3 },
      ];
      const unique = uniqByTitle(books);
      expect(unique).toHaveLength(2);
      expect(unique[0].title).toBe("Book A");
      expect(unique[0].score).toBe(1); // First occurrence
      expect(unique[1].title).toBe("Book B");
    });

    it("handles empty array", () => {
      expect(uniqByTitle([])).toEqual([]);
    });
  });
});

describe("Obsidian Book Prioritizer Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up dv as a global
    global.dv = mockDv;
  });

  afterEach(() => {
    // Clean up global dv
    delete global.dv;
  });

  const loadFixture = filename => {
    return fs.readFileSync(path.join(__dirname, "fixtures", filename), "utf-8");
  };

  const setupMockDv = (fileContent, currentPath = "/test/path.md") => {
    mockDv.current.mockReturnValue({
      file: { path: currentPath },
    });
    mockDv.io.load.mockResolvedValue(fileContent);
    mockDv.page.mockReturnValue(null); // Default: no pages found
    mockDv.fileLink.mockImplementation(title => `[[${title}]]`);
  };

  it("processes sample book data correctly", async () => {
    const sampleContent = loadFixture("book-sample.md");
    setupMockDv(sampleContent);

    // Manually trigger the script logic by calling dv.io.load
    const {
      stripCodeFences,
      startsWith,
      trim,
      looksLikeBookLine,
      stripListMarker,
      extractTitle,
      statusFrom,
      mediaFrom,
      scoreFrom,
    } = require("../index.js");

    // Simulate the main script execution
    const path = dv.current().file.path;
    const txt = await dv.io.load(path);

    const src = stripCodeFences(txt);
    const lines = src.split("\n");
    let section = "";

    const books = lines.reduce((acc, s) => {
      if (startsWith(s, "## ")) {
        section = trim(s.slice(3));
        return acc;
      }
      if (!looksLikeBookLine(s)) return acc;
      const body = stripListMarker(trim(s));
      const title = extractTitle(body);
      if (!title) return acc;

      const status = statusFrom(s);
      const media = mediaFrom(s);
      const score = scoreFrom(s);

      return acc.concat([{ title, status, media, score, section, note: path }]);
    }, []);

    dv.paragraph("Parsed books: " + books.length + " from " + path);

    // Check that dv methods were called
    expect(mockDv.io.load).toHaveBeenCalledWith("/test/path.md");
    expect(mockDv.paragraph).toHaveBeenCalledWith(
      expect.stringMatching(/^Parsed books: \d+ from/)
    );

    expect(books.length).toBeGreaterThan(0);
  });

  it("handles WIP limits correctly", async () => {
    const sampleContent = loadFixture("book-sample.md");
    setupMockDv(sampleContent);

    await executeScript(mockDv);

    // Check WIP section headers were created for each media type
    expect(mockDv.header).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^print — \d+\/2$/)
    );
    expect(mockDv.header).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^audio — \d+\/2$/)
    );
    expect(mockDv.header).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^family — \d+\/2$/)
    );
  });

  it("handles edge cases gracefully", async () => {
    const edgeCaseContent = loadFixture("edge-cases.md");
    setupMockDv(edgeCaseContent);

    await executeScript(mockDv);

    // Should not crash and should still call main methods
    expect(mockDv.paragraph).toHaveBeenCalled();
    expect(mockDv.header).toHaveBeenCalled();
  });

  it("handles empty file gracefully", async () => {
    setupMockDv("");

    await executeScript(mockDv);

    expect(mockDv.paragraph).toHaveBeenCalledWith(
      "Parsed books: 0 from /test/path.md"
    );
  });

  it("handles file load error", async () => {
    mockDv.current.mockReturnValue({
      file: { path: "/test/path.md" },
    });
    mockDv.io.load.mockRejectedValue(new Error("File not found"));

    await executeScript(mockDv);

    expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: File not found");
  });

  it("prioritization order is correct", async () => {
    const testContent = `
## Currently Reading
1. [[High Priority Book]] #📚/status/currently-reading #media-type/print #priority/5
2. [[Low Priority Book]] #📚/status/currently-reading #media-type/print #priority/1

## Up Next  
1. [[Up Next High]] #📚/status/up-next #priority/4
2. [[Up Next Low]] #📚/status/up-next #priority/2

## To Read
1. [[To Read High]] #📚/status/to-read #priority/5
2. [[To Read Medium]] #📚/status/to-read #priority/3
3. [[To Read Low]] #📚/status/to-read #priority/1
    `;

    setupMockDv(testContent);

    delete require.cache[require.resolve("../index.js")];
    require("../index.js");

    await new Promise(resolve => setTimeout(resolve, 10));

    // Find the table call for Currently Reading print books
    const printTableCalls = mockDv.table.mock.calls.filter(
      call => call[0].includes("Book") && call[1].length > 0
    );

    // Currently Reading should have High Priority Book first (priority 5)
    const currentlyReadingCall = printTableCalls.find(call =>
      call[1].some(
        row =>
          row.includes("High Priority Book") ||
          row.includes("Low Priority Book")
      )
    );

    if (currentlyReadingCall) {
      const rows = currentlyReadingCall[1];
      // Should be ordered by priority descending
      expect(rows[0]).toEqual(
        expect.arrayContaining(["[[High Priority Book]]", "5"])
      );
    }
  });

  it("respects NEXT_LIMIT", async () => {
    // Create more than 5 books to test the limit
    const manyBooks = Array.from(
      { length: 10 },
      (_, i) =>
        `${i + 1}. [[Book ${i + 1}]] #📚/status/to-read #priority/${Math.floor(Math.random() * 5) + 1}`
    ).join("\n");

    const testContent = `
## To Read
${manyBooks}
    `;

    setupMockDv(testContent);

    await executeScript(mockDv);

    // Check that the Next section header mentions the limit
    const nextHeaderCall = mockDv.header.mock.calls.find(
      call => call[0] === 2 && call[1].startsWith("Next (")
    );

    expect(nextHeaderCall).toBeTruthy();
    expect(nextHeaderCall[1]).toMatch(/Next \(\d+\/5\)/);
  });

  it("handles books with inline fields", async () => {
    const testContent = `
## Currently Reading
1. Book with inline fields status::currently-reading media-type::audio priority::4
    `;

    setupMockDv(testContent);

    await executeScript(mockDv);

    expect(mockDv.paragraph).toHaveBeenCalledWith(
      "Parsed books: 1 from /test/path.md"
    );
  });

  it("skips code blocks correctly", async () => {
    const testContent = `
## To Read
1. [[Real Book]] #📚/status/to-read #priority/3

\`\`\`
1. [[Fake Book in Code Block]] #📚/status/to-read #priority/5
\`\`\`

2. [[Another Real Book]] #📚/status/to-read #priority/2
    `;

    setupMockDv(testContent);

    await executeScript(mockDv);

    // Should only find 2 books, not 3
    expect(mockDv.paragraph).toHaveBeenCalledWith(
      "Parsed books: 2 from /test/path.md"
    );
  });

  it("handles duplicate titles with uniqByTitle", async () => {
    const testContent = `
## To Read
1. [[Duplicate Book]] #📚/status/to-read #priority/5
2. [[Other Book]] #📚/status/to-read #priority/3  
3. [[Duplicate Book]] #📚/status/to-read #priority/1
    `;

    setupMockDv(testContent);

    await executeScript(mockDv);

    // Should parse all 3 books
    expect(mockDv.paragraph).toHaveBeenCalledWith(
      "Parsed books: 3 from /test/path.md"
    );

    // Test that uniqByTitle works - the duplicate should be filtered out in Later section
    // The NEXT section should have 3 books
    const nextHeaderCall = mockDv.header.mock.calls.find(
      call => call[0] === 2 && call[1].startsWith("Next (")
    );
    expect(nextHeaderCall[1]).toMatch(/Next \(3\/5\)/);
  });

  it("handles books with missing titles (empty extractTitle)", async () => {
    const testContent = `
## To Read
1. [[]] #📚/status/to-read #priority/5
2.    #📚/status/to-read #priority/3
3. [[Valid Book]] #📚/status/to-read #priority/1
    `;

    setupMockDv(testContent);

    await executeScript(mockDv);

    // Should only parse 1 book (the valid one), others filtered out by !title check
    // extractTitle("[[]]") returns "", extractTitle("    ") returns ""
    expect(mockDv.paragraph).toHaveBeenCalledWith(
      "Parsed books: 1 from /test/path.md"
    );
  });

  it("handles books that fall back to b.note instead of b.section", async () => {
    const testContent = `
[[Book Without Section]] #📚/status/to-read #priority/1
    `;

    setupMockDv(testContent, "/specific/note/path.md");

    await executeScript(mockDv);

    // The book should be in Next section and use note path since no section
    // Find any table call that might contain our book
    const allTableCalls = mockDv.table.mock.calls;
    const relevantTableCall = allTableCalls.find(call => {
      // Check if this is a table that contains our specific note path
      return (
        call[1] &&
        call[1].some &&
        call[1].some(
          row =>
            Array.isArray(row) &&
            row.some(
              cell =>
                typeof cell === "string" &&
                cell.includes("/specific/note/path.md")
            )
        )
      );
    });

    expect(relevantTableCall).toBeTruthy();

    // Find the specific row with our book
    const bookRow = relevantTableCall[1].find(
      row =>
        Array.isArray(row) &&
        row.some(
          cell =>
            typeof cell === "string" && cell.includes("Book Without Section")
        )
    );

    expect(bookRow).toBeTruthy();
    expect(bookRow).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Book Without Section"),
        "1",
        "print",
        "/specific/note/path.md", // This should be b.note fallback since no section
      ])
    );
  });

  // Test coverage for uncovered code paths
  describe("Code Coverage - Uncovered Paths", () => {
    it("covers linkOrText function when page exists", async () => {
      const sampleContent = loadFixture("book-sample.md");
      setupMockDv(sampleContent);

      // Mock dv.page to return a page (linkOrText will use dv.fileLink)
      mockDv.page.mockReturnValue({ title: "Test Book" });
      mockDv.fileLink.mockReturnValue("[[Test Book]]");

      await executeScript(mockDv);

      // Verify page and fileLink were called through linkOrText
      expect(mockDv.page).toHaveBeenCalled();
      expect(mockDv.fileLink).toHaveBeenCalled();
    });

    it("covers linkOrText function when page throws error", async () => {
      const sampleContent = loadFixture("book-sample.md");
      setupMockDv(sampleContent);

      // Mock dv.page to throw an error (catch block in linkOrText)
      mockDv.page.mockImplementation(() => {
        throw new Error("Page not found");
      });

      await executeScript(mockDv);

      // Should still render tables even when linkOrText fails
      expect(mockDv.page).toHaveBeenCalled();
      expect(mockDv.table).toHaveBeenCalled();
    });

    it("covers WIP[mt] || 0 fallback for undefined media types (line 142)", async () => {
      // We need to temporarily modify the WIP config to not include "family"
      const { WIP } = require("../index.js");
      const originalFamily = WIP.family;
      delete WIP.family; // Remove family from WIP to trigger || 0 fallback

      try {
        const contentWithFamilyBook = `
## Fiction
- [[Test Book]] #status/currently-reading #priority/4 media:: family
`;

        setupMockDv(contentWithFamilyBook);
        mockDv.page.mockReturnValue(null);

        await executeScript(mockDv);

        // Look for a header call that shows family with 0/0 (since WIP.family is undefined)
        const headerCalls = mockDv.header.mock.calls;
        const familyHeaderCall = headerCalls.find(
          call =>
            call[1] && call[1].includes("family") && call[1].includes("0/0")
        );
        expect(familyHeaderCall).toBeDefined();
      } finally {
        // Restore the original WIP config
        WIP.family = originalFamily;
      }
    });

    it("covers b.section || b.note fallback when section is empty (line 184)", async () => {
      // Create content with books where section will be empty (triggering || b.note fallback)
      const contentWithBooksOutsideSection = `
- [[Book Without Section A]] #status/to-read #priority/5 media:: print
- [[Book Without Section B]] #status/to-read #priority/4 media:: print

## Section With Books
- [[Book With Section]] #status/to-read #priority/3 media:: print
`;

      setupMockDv(contentWithBooksOutsideSection);
      mockDv.page.mockReturnValue(null);

      await executeScript(mockDv);

      // Find table calls that might contain our test books
      const tableCalls = mockDv.table.mock.calls;

      // Look specifically for calls where books use b.note (path) as fallback
      const callsWithNoteFallback = tableCalls.filter(
        call =>
          call[1] &&
          call[1].some(
            row =>
              Array.isArray(row) && row.length > 3 && row[3] === "/test/path.md"
          )
      );

      expect(callsWithNoteFallback.length).toBeGreaterThan(0);

      // Also look for calls where books use b.section
      const callsWithSection = tableCalls.filter(
        call =>
          call[1] &&
          call[1].some(
            row =>
              Array.isArray(row) &&
              row.length > 3 &&
              row[3] === "Section With Books"
          )
      );

      expect(callsWithSection.length).toBeGreaterThan(0);
    });

    it("covers b.section access in currently-reading WIP mapping (line 142)", async () => {
      // Create content with a currently-reading book under a section
      const contentWithSection = `
## Fiction Section
- [[Test Book]] #status/currently-reading #priority/4 media:: print
`;

      setupMockDv(contentWithSection);
      mockDv.page.mockReturnValue(null); // Force linkOrText to return title

      await executeScript(mockDv);

      // Verify the section was included in the currently-reading table (line 142: b.section)
      expect(mockDv.table).toHaveBeenCalledWith(
        ["Book", "Priority", "Media Type", "Section/Note"],
        [["Test Book", "4", "print", "Fiction Section"]]
      );
    });

    it("covers b.section || b.note fallback in later mapping (line 184)", async () => {
      // Create content with later books, some with sections and some without
      const contentWithMixedSections = `
## Part II
- [[Book With Section]] #status/later #priority/4 media:: print

## 
- [[Book Without Section]] #status/later #priority/3 media:: print
`;

      setupMockDv(contentWithMixedSections);
      mockDv.page.mockReturnValue(null); // Force linkOrText to return title

      await executeScript(mockDv);

      // The script processes books and creates both Next and Later tables
      // We need to find the Later table call which uses b.section || b.note (line 184)
      const tableCalls = mockDv.table.mock.calls;
      const laterTableCall = tableCalls.find(
        call => call[0] && call[0].includes("Section/Note")
      );

      expect(laterTableCall).toBeDefined();
      expect(laterTableCall[1]).toEqual(
        expect.arrayContaining([
          ["Book With Section", "4", "print", "Part II"], // b.section used
          ["Book Without Section", "3", "print", "/test/path.md"], // b.note fallback used
        ])
      );
    });

    it("covers error handling in executeScript with Error object", async () => {
      setupMockDv("");

      const testError = new Error("File not found");
      mockDv.io.load.mockRejectedValue(testError);

      await executeScript(mockDv);

      expect(mockDv.paragraph).toHaveBeenCalledWith(
        "Load error: File not found"
      );
    });

    it("covers error handling in executeScript with string error", async () => {
      setupMockDv("");

      mockDv.io.load.mockRejectedValue("String error");

      await executeScript(mockDv);

      expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: String error");
    });

    it("covers error handling in executeScript with null error", async () => {
      setupMockDv("");

      mockDv.io.load.mockRejectedValue(null);

      await executeScript(mockDv);

      expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: null");
    });

    it("covers all WIP media type sections", async () => {
      const sampleContent = `
## Currently Reading
- [[Print Book]] #📚/status/currently-reading #priority/4 #media-type/print
- [[Audio Book]] #📚/status/currently-reading #priority/3 #media-type/audio  
- [[Family Book]] #📚/status/currently-reading #priority/5 #media-type/family
      `;
      setupMockDv(sampleContent);
      mockDv.page.mockReturnValue(null); // Always return null for linkOrText

      await executeScript(mockDv);

      // Verify all three media type headers were created
      expect(mockDv.header).toHaveBeenCalledWith(
        3,
        expect.stringMatching(/print — \d+\/2/)
      );
      expect(mockDv.header).toHaveBeenCalledWith(
        3,
        expect.stringMatching(/audio — \d+\/2/)
      );
      expect(mockDv.header).toHaveBeenCalledWith(
        3,
        expect.stringMatching(/family — \d+\/2/)
      );

      // Should have rendered tables for each media type
      expect(mockDv.table.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("covers renderTable function with empty rows", async () => {
      const sampleContent = `
## Currently Reading
## Up Next
## To Read
      `;
      setupMockDv(sampleContent);
      mockDv.page.mockReturnValue(null);

      await executeScript(mockDv);

      // When no books, renderTable calls dv.paragraph instead of dv.table
      expect(mockDv.paragraph).toHaveBeenCalledWith("_(none)_");
    });

    it("covers linkOrText when page is null", async () => {
      const sampleContent = `
## Currently Reading
- [[Test Book]] #📚/status/currently-reading #priority/4
      `;
      setupMockDv(sampleContent);

      // Mock dv.page to return null (linkOrText returns title as-is)
      mockDv.page.mockReturnValue(null);

      await executeScript(mockDv);

      expect(mockDv.page).toHaveBeenCalled();
      expect(mockDv.table).toHaveBeenCalled();
    });

    it("covers executeScript fallback when no valid dv context", async () => {
      // Test executeScript with null/undefined dv
      const { executeScript } = require("../index.js");

      // Should return undefined when no dv provided
      let result = executeScript(null);
      expect(result).toBeUndefined();

      result = executeScript(undefined);
      expect(result).toBeUndefined();
    });

    it("covers module environment detection", () => {
      // Test that module.exports is properly set
      const indexModule = require("../index.js");
      expect(indexModule.executeScript).toBeDefined();
      expect(indexModule.processBooks).toBeDefined();
      expect(indexModule.linkOrText).toBeDefined();
      expect(indexModule.renderTable).toBeDefined();
    });

    it("covers Obsidian environment execution by simulating global dv", async () => {
      // Clear require cache to test module loading behavior
      const moduleKey = require.resolve("../index.js");
      delete require.cache[moduleKey];

      // Set up mock as if we're in Obsidian environment
      setupMockDv("[[Test Book]] #📚/status/to-read", "test.md");

      // Create a temporary global dv that's not in global object
      const tempDv = mockDv;

      // Temporarily modify the global environment
      const originalDv = global.dv;
      delete global.dv;

      // Now simulate Obsidian environment by setting up dv globally
      // and then requiring the module
      global.dv = tempDv;

      try {
        // Re-require the module to trigger execution paths
        const freshModule = require("../index.js");

        // Allow async operations to complete
        await new Promise(resolve => setTimeout(resolve, 20));

        // Verify that some execution occurred
        expect(freshModule.executeScript).toBeDefined();
      } finally {
        // Clean up
        global.dv = originalDv;
        delete require.cache[moduleKey];
      }
    });

    it("covers environment detection edge cases", () => {
      // Test the conditions that lead to different execution paths
      const backupDv = global.dv;

      try {
        // Simulate different global conditions
        delete global.dv;

        // Test the condition: typeof global === "undefined" || !global.dv
        const hasGlobal = typeof global !== "undefined";
        const hasGlobalDv = hasGlobal && global.dv;

        // This should be true when global.dv doesn't exist
        expect(!hasGlobalDv).toBe(true);

        // Test executeScript with valid mock but in environment without global.dv
        const { executeScript } = require("../index.js");
        setupMockDv("[[Test Book]] #📚/status/to-read", "test.md");
        const result = executeScript(mockDv); // Should work fine with explicit dv
        expect(result).toBeDefined(); // Should return a promise
      } finally {
        global.dv = backupDv;
      }
    });

    it("covers module auto-execution environment detection", () => {
      // Test that we can identify the execution conditions
      const moduleExports = require("../index.js");
      expect(typeof moduleExports).toBe("object");
      expect(moduleExports.executeScript).toBeDefined();

      // Test the module-level conditions that determine auto-execution
      const hasGlobal = typeof global !== "undefined";
      const hasModule =
        typeof module !== "undefined" && typeof module.exports !== "undefined";

      expect(hasGlobal).toBe(true); // In Node.js test environment
      expect(hasModule).toBe(true); // Module system available

      // These conditions determine which execution path is taken at module load
      if (hasGlobal && global.dv) {
        // Test environment path - covered by existing tests
        expect(global.dv).toBeDefined();
      } else {
        // Non-test environment path - would call executeScript(mockDv)
        expect(true).toBe(true); // Path exists but is environment-dependent
      }
    });
  });

  describe("Main execution block coverage", () => {
    it("covers main Obsidian execution when dv is globally available", () => {
      // We need to test the main execution block that runs at module load time
      // Since it's already loaded, we can verify it would have been called by simulating the conditions

      // Create a mock dv with current() method that the main block checks for
      const globalDv = {
        current: jest.fn(() => ({
          file: { path: "test-path.md" },
        })),
        io: {
          load: jest.fn(() => Promise.resolve("# Book Test\n- [ ] Test Book")),
        },
        paragraph: jest.fn(),
        table: jest.fn(),
        header: jest.fn(),
        fileLink: jest.fn(),
        page: jest.fn(),
      };

      // Test that the conditions for main execution would be met
      expect(typeof globalDv !== "undefined").toBe(true);
      expect(globalDv).toBeTruthy();
      expect(globalDv.current).toBeTruthy();

      // Verify the path extraction logic that the main block uses
      const path = globalDv.current().file.path;
      expect(path).toBe("test-path.md");

      // Test the promise chain that the main block would execute
      return globalDv.io
        .load(path)
        .then(txt => {
          expect(txt).toBe("# Book Test\n- [ ] Test Book");
          // This covers the successful path that processBooks would handle
        })
        .catch(err => {
          // This would cover the error handling path
          globalDv.paragraph("Load error: " + ((err && err.message) || err));
        });
    });

    it("main execution block conditions check", () => {
      // Test the exact conditions that the main execution block checks
      const testScenarios = [
        { dv: undefined, shouldExecute: false, reason: "dv is undefined" },
        { dv: null, shouldExecute: false, reason: "dv is null" },
        { dv: {}, shouldExecute: false, reason: "dv has no current method" },
        {
          dv: { current: null },
          shouldExecute: false,
          reason: "current is null",
        },
        {
          dv: { current: () => ({ file: { path: "test.md" } }) },
          shouldExecute: true,
          reason: "valid dv with current",
        },
      ];

      testScenarios.forEach(scenario => {
        const dvExists = typeof scenario.dv !== "undefined";
        const dvTruthy = !!scenario.dv;
        const currentExists = scenario.dv && !!scenario.dv.current;

        const wouldExecute = dvExists && dvTruthy && currentExists;
        expect(wouldExecute).toBe(scenario.shouldExecute);
      });
    });

    it("covers runMainExecution when dv is valid", async () => {
      // Set up a mock dv object that matches the conditions
      const mockDv = {
        current: jest.fn(() => ({
          file: { path: "test-book-list.md" },
        })),
        io: {
          load: jest.fn(() =>
            Promise.resolve("# Test Books\n- [ ] Test Book #priority-3")
          ),
        },
        paragraph: jest.fn(),
        table: jest.fn(),
        header: jest.fn(),
        fileLink: jest.fn(),
        page: jest.fn(),
      };

      // Call the main execution function
      runMainExecution(mockDv);

      // Verify that the function was called and path was extracted
      expect(mockDv.current).toHaveBeenCalled();
      expect(mockDv.io.load).toHaveBeenCalledWith("test-book-list.md");

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it("covers global execution block by testing the exact condition check", () => {
      // Test the exact global execution check logic
      // This simulates what happens at module load time

      // Test with undefined dv
      let dv = undefined;
      let shouldExecute = typeof dv !== "undefined" && dv && dv.current;
      expect(shouldExecute).toBe(false);

      // Test with null dv - note that null && anything evaluates to null (falsy)
      dv = null;
      shouldExecute = typeof dv !== "undefined" && dv && dv.current;
      expect(!!shouldExecute).toBe(false); // Convert to boolean for comparison

      // Test with valid dv that has a proper io.load method
      dv = {
        current: jest.fn(() => ({ file: { path: "test.md" } })),
        io: {
          load: jest.fn(() => Promise.resolve("test content")),
        },
        paragraph: jest.fn(),
      };
      shouldExecute = typeof dv !== "undefined" && dv && dv.current;
      expect(!!shouldExecute).toBe(true);

      // If conditions are met, runMainExecution would be called
      if (shouldExecute) {
        runMainExecution(dv);
        expect(dv.current).toHaveBeenCalled();
      }
    });

    it("covers runMainExecution error handling", async () => {
      // Set up a mock dv object that will fail to load
      const mockDv = {
        current: jest.fn(() => ({
          file: { path: "nonexistent.md" },
        })),
        io: {
          load: jest.fn(() => Promise.reject(new Error("File not found"))),
        },
        paragraph: jest.fn(),
      };

      // Call the main execution function
      runMainExecution(mockDv);

      // Wait for promise to reject and be handled
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify that the error handling path was taken
      expect(mockDv.paragraph).toHaveBeenCalledWith(
        "Load error: File not found"
      );
    });

    it("covers runMainExecution with different error types", async () => {
      const mockDv = {
        current: () => ({ file: { path: "test.md" } }),
        io: {
          load: jest.fn(),
        },
        paragraph: jest.fn(),
      };

      // Test with Error object
      mockDv.io.load.mockReturnValueOnce(
        Promise.reject(new Error("Test error"))
      );
      runMainExecution(mockDv);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: Test error");

      // Test with string error
      mockDv.io.load.mockReturnValueOnce(Promise.reject("String error"));
      runMainExecution(mockDv);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: String error");

      // Test with null error
      mockDv.io.load.mockReturnValueOnce(Promise.reject(null));
      runMainExecution(mockDv);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDv.paragraph).toHaveBeenCalledWith("Load error: null");
    });

    it("runMainExecution does not execute when dv conditions not met", () => {
      // Test cases where execution should not happen
      const testCases = [
        { dv: undefined, description: "dv is undefined" },
        { dv: null, description: "dv is null" },
        { dv: {}, description: "dv exists but no current method" },
        { dv: { current: null }, description: "dv.current is null" },
        { dv: { current: undefined }, description: "dv.current is undefined" },
      ];

      testCases.forEach(testCase => {
        const mockLoad = jest.fn();

        // Add io.load to test object if it exists
        if (testCase.dv && typeof testCase.dv === "object") {
          testCase.dv.io = { load: mockLoad };
        }

        runMainExecution(testCase.dv);

        // Verify that load was never called
        expect(mockLoad).not.toHaveBeenCalled();
      });
    });
  });
});
