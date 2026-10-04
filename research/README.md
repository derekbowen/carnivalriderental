# Operator research

`operator-research-template.xlsx` is the template for collecting carnival ride companies and the rides they offer (regenerate it with `python3 scripts/make-research-template.py`).

- Sheets: **Companies** (one row per company), **Rides** (one row per ride type per company), instructions and dropdown lists.
- Public information only, with a `source_url` on every row. Blank means "not stated" — never guessed.
- It feeds the **internal** supplier list (`suppliers` → `relationship = researched_prospect`, `ride_units` → unverified) used as the call sheet. It is not public listing data and is never used to create Sharetribe accounts in an operator's name.
- Public catalog listings stay ride-family offerings ("Sourcing on request"); the count of researched companies is not shown publicly.
- Filled-in copies contain third-party contact details: keep them out of this repo (share them directly), until an import path with storage rules exists.
