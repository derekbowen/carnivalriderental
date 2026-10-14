import { accessDb } from "../src/lib/access/db";
import { siteUrl } from "../src/lib/config";
import { dispatchFollowups } from "../src/lib/concierge/followup";
accessDb().then(db => dispatchFollowups(db, siteUrl())).then(result => { console.log(result); process.exit(0); }).catch(() => { console.error("Follow-up dispatch failed; inspect configuration. No recipient details logged."); process.exit(1); });
