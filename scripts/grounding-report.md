# Grounding-Rate Test Report

Repository: `SarthakSoni31/naayak`
Date: 2026-09-07T20:28:22.203Z
Questions: 15
Grounding rate: **13/15 (86.7%)**
Proposal target: >= 85%

| # | Question | Expected file | Sources returned | Result |
|---|---|---|---|---|
| 1 | Where is authentication handled? | `middleware/auth.js` | `middleware/auth.js:36-43`, `src/routes/auth.js:141-149`, `middleware/auth.js:1-40`, `src/routes/auth.js:36-75`, `src/routes/auth.js:71-110`, `src/routes/auth.js:106-145` | Pass |
| 2 | How does GitHub OAuth login work in this app? | `middleware/auth.js` | `middleware/auth.js:36-43`, `src/routes/auth.js:141-149`, `app.js:71-96`, `public/css/naayak.css:141-180`, `app.js:1-40`, `middleware/auth.js:1-40` | Pass |
| 3 | How are new grievances automatically classified into categories? | `helpers/classifier.js` | `src/routes/citizen.js:71-110`, `helpers/classifier.js:1-29`, `helpers/classifier.js:30-60`, `models/grievance.js:1-40`, `models/department.js:1-14`, `src/routes/citizen.js:106-145` | Pass |
| 4 | How is urgency determined for a grievance? | `helpers/classifier.js` | `models/grievance.js:36-74`, `src/routes/admin.js:106-145`, `src/routes/citizen.js:71-110`, `src/routes/adhikari.js:71-110`, `public/css/naayak.css:736-775`, `src/routes/admin.js:246-275` | Fail |
| 5 | How are grievances mapped to a department? | `helpers/classifier.js` | `src/routes/citizen.js:71-110`, `src/routes/citizen.js:106-145`, `src/routes/admin.js:106-145`, `src/routes/citizen.js:141-178`, `src/routes/admin.js:71-110`, `src/routes/adhikari.js:36-75` | Fail |
| 6 | What fields does the grievance model have? | `models/grievance.js` | `src/routes/citizen.js:71-110`, `models/grievance.js:36-74`, `public/css/naayak.css:736-775`, `models/grievance.js:1-40`, `src/routes/admin.js:246-275`, `src/routes/admin.js:106-145` | Pass |
| 7 | What fields are on the admin user model? | `models/admin.js` | `models/admin.js:1-23`, `config/passport.js:1-40`, `config/passport.js:36-75`, `models/adhikari.js:1-30`, `seed.js:1-37`, `src/routes/auth.js:106-145` | Pass |
| 8 | What fields are on the citizen model? | `models/citizen.js` | `src/api/users.js:1-18`, `config/passport.js:36-75`, `seed.js:1-37`, `src/routes/auth.js:141-149`, `models/citizen.js:1-29`, `config/passport.js:1-40` | Pass |
| 9 | What does the department model look like? | `models/department.js` | `models/department.js:1-14`, `src/api/departments.js:1-18`, `src/routes/admin.js:176-215`, `seed.js:38-118`, `seed.js:1-37`, `public/css/naayak.css:736-775` | Pass |
| 10 | What does the adhikari (official) model contain? | `models/adhikari.js` | `src/routes/admin.js:176-215`, `seed.js:1-37`, `src/routes/admin.js:1-40`, `src/routes/adhikari.js:106-121`, `config/passport.js:1-40`, `models/adhikari.js:1-30` | Pass |
| 11 | How does an official's dashboard calculate assigned grievance counts? | `src/routes/adhikari.js` | `src/routes/admin.js:246-275`, `src/routes/adhikari.js:1-40`, `models/grievance.js:36-74`, `src/routes/admin.js:1-40`, `public/css/naayak.css:736-775`, `src/routes/citizen.js:71-110` | Pass |
| 12 | How does the admin dashboard aggregate statistics? | `src/routes/admin.js` | `src/routes/admin.js:246-275`, `src/routes/adhikari.js:1-40`, `src/routes/admin.js:36-75`, `src/routes/admin.js:1-40`, `public/css/naayak.css:561-600`, `middleware/auth.js:36-43` | Pass |
| 13 | How does pagination work on the grievance listing page? | `src/routes/admin.js` | `src/routes/citizen.js:71-110`, `public/css/naayak.css:736-775`, `src/routes/citizen.js:141-178`, `src/routes/citizen.js:106-145`, `src/routes/admin.js:36-75`, `src/routes/adhikari.js:1-40` | Pass |
| 14 | Where can a citizen file a new grievance? | `src/routes/citizen.js` | `src/routes/admin.js:106-145`, `models/grievance.js:36-74`, `src/routes/citizen.js:71-110`, `src/routes/adhikari.js:71-110`, `src/routes/admin.js:246-275`, `src/routes/citizen.js:36-75` | Pass |
| 15 | What does a citizen's dashboard show them? | `src/routes/citizen.js` | `middleware/auth.js:36-43`, `public/css/naayak.css:561-600`, `public/css/naayak.css:351-390`, `public/css/naayak.css:71-110`, `src/routes/citizen.js:141-178`, `src/routes/auth.js:141-149` | Pass |