# @feather/assets

Shared images, videos and brand files for every app.

- `brand/logo.svg` is the main logo. The current file is a **placeholder**; replace it with the real one and keep the same file name.
  The logo is shown on a light surface in the sidebar and top bar, at a height of 32–40 px. A square or wide mark works.
- Put more files under `images/` or `videos/` and import them in a frontend like this:

```js
import logoUrl from '@feather/assets/brand/logo.svg';
```
