# Grounding-Rate Test

Satisfies the proposal's **primary evaluation metric** (Section 6.1): the
percentage of AI-assistant answers that correctly cite an existing, relevant
file in the indexed repository. Target: >= 85%.

This has to run against your own live app (it makes real chat requests
through your real database and Gemini key), so it can't be pre-computed —
run it yourself with the app running locally.

## 1. Check the questions first

Open `grounding-questions.json`. Each entry is a question plus the file I'd
*expect* a correct answer to cite, based on file names I saw during earlier
testing of naayak. I don't have full visibility into your repo's exact file
tree, so **skim this list and fix any `expectedFile` that's wrong** (e.g. if
`models/grievance.js` is actually at a different path in your repo) before
running the test — otherwise you'll get false failures on a correct answer
that just cited a differently-named file.

Feel free to add/remove/edit questions to better match your actual repo.

## 2. Get your session cookie

1. Open the app in your browser and make sure you're signed in.
2. Open DevTools (F12 or Cmd+Option+I) → Application (Chrome) or Storage
   (Firefox) tab → Cookies → `http://localhost:3000`.
3. Find the cookie named `session_user_id` and copy its **value** (just the
   number, not the whole cookie string).

## 3. Run it

With `npm run dev` already running in another terminal:

```bash
SESSION_COOKIE=<value from step 2> OWNER=SarthakSoni31 REPO=naayak npm run test:grounding
```

Replace `OWNER`/`REPO` with whichever indexed repo you want to test against.

It'll print PASS/FAIL for each question as it goes (with a ~2 second pause
between each, to stay under Gemini's free-tier rate limit), then print a
final grounding rate and write a full markdown report to
`scripts/grounding-report.md` — that file is what you paste into your
project report.

## What counts as a "pass"

An answer passes if the `expectedFile` for that question appears as a
prefix of at least one of the sources the chat API actually returned. This
directly mirrors the proposal's own definition: "measured by comparing
cited file references against a manually verified answer key."
