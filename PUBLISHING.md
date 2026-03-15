# how to publish

a quick guide for adding content to your site.

---

## the basics

your site has three sections. each one is just a folder with markdown files:

| section | folder | url |
|---------|--------|-----|
| notes | `notes/` | `/notes/your-title/` |
| newsletter | `newsletter/` | `/newsletter/your-title/` |
| photos | `photos/` | `/photos/your-title/` |

to publish something, you just:
1. create a `.md` file in the right folder
2. commit and push to github

that's it. github pages builds and deploys automatically.

---

## writing a post

every post starts with a little header block called "frontmatter." here's all you need:

```
---
title: your title here
date: 2026-03-15
---

your content goes here. just write normally.
```

**rules:**
- keep everything lowercase (that's the site's style)
- `title` and `date` are required
- date format is `YYYY-MM-DD` (year-month-day)
- the filename becomes the url (e.g., `my-cool-post.md` → `/notes/my-cool-post/`)

---

## formatting cheat sheet

```markdown
## heading

### smaller heading

regular paragraph text. just type normally.

**bold text**

*italic text*

[link text](https://example.com)

![image description](/public/images/your-image.jpg)

- bullet point
- another bullet point

1. numbered item
2. another numbered item

> a quote or callout
```

---

## adding images

1. put your image file in the `public/images/` folder
2. reference it in your post like this:

```markdown
![description of the image](/public/images/your-image.jpg)
```

---

## publishing with git (step by step)

open your terminal and run these commands:

```bash
# 1. see what's changed
git status

# 2. add your new files
git add notes/my-new-post.md
#  or for images too:
git add notes/my-new-post.md public/images/photo.jpg

# 3. save your changes (the message describes what you did)
git commit -m "add: my new post title"

# 4. push to github (this triggers the deploy)
git push origin main
```

**if you're adding multiple files at once:**
```bash
git add .
git commit -m "add: a few new posts"
git push origin main
```

---

## preview before publishing

want to see how it looks before going live?

```bash
npm run serve
```

then open `http://localhost:8080` in your browser. it auto-refreshes as you edit.

---

## examples

### a note

create `notes/on-minimalism.md`:
```
---
title: on minimalism
date: 2026-03-15
---

less is more. or so they say.

i've been thinking about what it means to own less, and whether
the act of letting go is itself a form of holding on.
```

### a newsletter

create `newsletter/march-update.md`:
```
---
title: march update
date: 2026-03-15
---

hey friends,

here's what i've been up to this month...
```

### a photo post

create `photos/seattle-morning.md`:
```
---
title: seattle morning
date: 2026-03-15
---

![fog rolling over the puget sound](/public/images/seattle-morning.jpg)

caught this on my walk to the coffee shop.
```

---

## quick reference

| what you want to do | command |
|---------------------|---------|
| preview the site locally | `npm run serve` |
| check what files changed | `git status` |
| stage files for commit | `git add <filename>` |
| commit your changes | `git commit -m "your message"` |
| push to github (deploy) | `git push origin main` |
| pull latest changes | `git pull origin main` |
