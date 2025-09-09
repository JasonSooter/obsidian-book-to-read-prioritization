# Edge Cases Test File

## Books with Alternative Syntax

1. Book with inline field status::currently-reading media-type::audio priority::5
2. * [[Alternative List Marker]] #📚/status/to-read #priority/2
3. - Another List Style #📚/status/up-next #slot/family #priority/3
4. [[Book with Pipe|Display Name]] #📚/status/currently-reading #media-type/print #priority/4

## Malformed or Missing Data

1. [[Book Without Status Tag]] #media-type/print #priority/3
2. Book Without Priority #📚/status/to-read #media-type/audio
3. [[Minimal Book]] #📚/status/currently-reading
4. Book with invalid priority #📚/status/to-read #priority/10
5. Book with zero priority #📚/status/to-read #priority/0
6. Book with negative priority #📚/status/to-read #priority/-1

## Duplicate Titles

1. [[Duplicate Book]] #📚/status/currently-reading #media-type/print #priority/5
2. [[Duplicate Book]] #📚/status/to-read #media-type/audio #priority/3

## Code Blocks That Should Be Ignored

```
1. [[Fake Book Inside Code Block]] #📚/status/currently-reading
2. Another fake book #📚/status/to-read
```

```dataviewjs
// This should be ignored
const fakeBook = "[[Not A Real Book]]";
```

## Books With Special Characters and Spacing

1.     [[Book With Extra Spacing]]     #📚/status/currently-reading    #priority/2   
2. [[Book-with-dashes]] #📚/status/to-read #media-type/print #priority/1
3. [[Book_with_underscores]] #📚/status/currently-reading #media-type/family #priority/3
4. [[Book (with parentheses)]] #📚/status/up-next #priority/4
5. Book with "quotes" and special chars! #📚/status/to-read #priority/2

## Different Media Type Formats

1. [[Old Slot Format]] #slot/audio #📚/status/currently-reading #priority/3
2. [[Mixed Format]] #media-type/family #slot/print #📚/status/to-read #priority/2
3. Book with unknown media #📚/status/currently-reading #media-type/ebook #priority/1

## Books By Author Syntax

1. Book Title by Author Name #📚/status/to-read #priority/3
2. [[Another Book]] by [[Famous Author]] #📚/status/currently-reading #media-type/audio #priority/4
3. Simple book by simple author #📚/status/up-next #priority/1

## Empty or Invalid Sections

## Empty Section

## Another Empty Section

Some text that is not a book.

1. Not a book line without any tags
2. Another regular line

## Mixed Valid and Invalid

1. [[Valid Book]] #📚/status/currently-reading #priority/3
2. Invalid book without proper tags
3. [[Another Valid Book]] #📚/status/to-read #media-type/print #priority/2
4. Just text with # hashtag but no book status
