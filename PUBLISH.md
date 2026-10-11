# Publishing this to GitHub Pages

The repository is already initialised and committed on branch `main`, and
`docs/index.html` is already built. Two steps are left.

## 1. Create the repo and push

On github.com, create a new **public** repository called `our-world`.
Do not let GitHub add a README, .gitignore or licence — this repo already has
them and the extra commit would make the first push fail.

Then, in this folder:

```bash
git remote add origin https://github.com/salrazafilm-debug/our-world.git
git push -u origin main
```

If you'd rather not use git at all: on the empty repo's page click
**uploading an existing file**, drag in everything from this folder, and commit.
That works just as well — the only thing you lose is the commit history, which
is one commit.

## 2. Turn on Pages

Repo → **Settings** → **Pages** → Source: **Deploy from a branch** →
Branch: `main`, folder: `/docs` → Save.

First build takes a minute or two. The site then lives at:

```
https://salrazafilm-debug.github.io/our-world/
```

## Changing it later

Edit `src/index.html`, then:

```bash
npm run check        # catches syntax errors before they ship
npm run build:site   # rewrites docs/index.html
git add -A && git commit -m "..." && git push
```

Pages redeploys on push. `npm run build:site` refuses to write the file if any
photo reference has crept back into the source, so the public build cannot
accidentally start pointing at private images.
