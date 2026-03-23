---
title: Books & PDFs
---

> [!INFO]
> - PDF Setup Guide
>
> ### Local PDF
>
> Drop files into `content/.files/My-Book.pdf` — auto-discovered with thumbnail, page count, and file size. No other config needed. To add tags, use a `pdf-local` block.
>
> #### Tag a local PDF
>
> ```pdf-local
> slug: .files/My-Book.pdf
> tags: Category One, Category Two
> ```
>
> ### External PDF (opens in viewer)
>
> ```pdf-external
> title: Book Title
> url: https://example.com/file.pdf
> description: Optional note
> tags: Category
> ```
>
> ### Web Link (opens in new tab)
>
> ```pdf-link
> title: Link Title
> url: https://example.com/page
> description: Optional note
> tags: Category
> ```
>
> ### Group (multiple versions in one card, with dropdown)
>
> ```pdf-group
> name: Group Name
> tags: Category
> - .files/local.pdf | Local Label | hidden
> - https://example.com/online.pdf | Online PDF
> - https://example.com/page | Reference Page
> ```
>
> Items: `path-or-url | Label | hidden`
> Add `hidden` to suppress that item as a standalone card — it still appears in the group dropdown.
> Items starting with `http` that end in `.pdf` open in the viewer; other URLs open in a new tab.
>
> ### Summary
>
> | Type | Block | Standalone card? |
> | --- | --- | --- |
> | Local PDF | auto (any `.pdf` in `content/`) | yes, unless `hidden` in group |
> | External PDF | `pdf-external` | yes, unless `hidden` in group |
> | Web link | `pdf-link` | yes |
> | Group | `pdf-group` | yes (group card with dropdown) |

```pdf-local
slug: .files/Dead-Sea-Scrolls.pdf
tags: 
```

```pdf-local
slug: .files/Ascension-of-Isaiah.pdf
tags: Apocrypha
```

```pdf-external
title: De Solstitiis et Aequinoctiis
url: https://www.roger-pearse.com/weblog/wp-content/uploads/2022/02/De-Solstitiis-et-Aequinoctiis-Image-2022.pdf
description: Early church text on the solstices and equinoxes
tags: Early Church
```

```pdf-link
title: Book of Jubilees
url: https://www.pseudepigrapha.com/jubilees/index.htm
description: Online text at pseudepigrapha.com
tags: Apocrypha
```

```pdf-link
title: Book of Enoch
url: https://sacred-texts.com/bib/boe/index.htm
description: Full text at sacred-texts.com
tags: Apocrypha
```

```pdf-link
title: Christmas Origins
url: https://godmadeus.com/Holiday/Christmas/ch2.php
description: Article on the origins of Christmas traditions
tags: Holidays, Christmas
```

```plaintext
slug: .files/Apocylpse of El.pdf
tags: 
```