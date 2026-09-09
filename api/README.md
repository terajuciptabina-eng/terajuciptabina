# Temporary GitHub Account API

`auth.js` is the temporary account bridge used by the Homeowner and Contractor Sign Up / Sign In pages.

Required deployment environment variables:

- `GITHUB_TOKEN` — a server-side GitHub token with repository Contents read/write permission.
- `GITHUB_REPO` — optional; defaults to `terajuciptabina-eng/terajuciptabina`.

The GitHub token must never be placed in frontend HTML or JavaScript.

The deployed API is expected at:
`https://terajuciptabina.vercel.app/api/auth`

This is a temporary authentication bridge. Replace it later with the proper authentication/database system and migrate the JSON account records.
