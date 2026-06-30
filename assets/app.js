/* =========================================================
   Conference Management System – Prototype framework
   Vanilla JS. Builds the app shell (sidebar, topbar, role
   switcher, breadcrumbs), manages the simulated role, and
   provides a localStorage-backed data store + helpers.

   NOTE: This is a UI/navigation prototype only. No backend,
   no auth, no real validation logic.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "cms_proto_v3";
  var ROLE_KEY = "cms_proto_role";
  var WS_KEY = "cms_proto_ws"; // last active workspace (admin | author)
  var CONF_KEY = "cms_proto_conf"; // current (single active) conference id

  /* ---------- Roles ---------- */
  var ROLES = {
    admin: { label: "Conference Admin", home: "dashboard-admin.html" },
    lead: { label: "Track Lead", home: "dashboard-lead.html" },
    author: { label: "Author", home: "dashboard-author.html" },
    reviewer: { label: "Reviewer", home: "dashboard-reviewer.html" },
  };

  /* ---------- Navigation per role ---------- */
  var NAV = {
    admin: [
      { ic: "▣", label: "Dashboard", href: "dashboard-admin.html" },
      { ic: "▤", label: "Conferences", href: "conferences.html" },
      { ic: "＋", label: "Create Conference", href: "create-conference.html" },
      { ic: "◷", label: "Submission Workflow", href: "papers.html" },
    ],
    lead: [
      { ic: "▣", label: "Dashboard", href: "dashboard-lead.html" },
      { ic: "◷", label: "Submission Workflow", href: "papers.html" },
      { ic: "⇄", label: "Review Assignment", href: "review-assignment.html" },
      { ic: "◎", label: "Review Analysis", href: "review-analysis.html" },
      {
        ic: "✓",
        label: "Acceptance Decision",
        href: "acceptance-decision.html",
      },
    ],
    author: [
      { ic: "▣", label: "Dashboard", href: "dashboard-author.html" },
      { ic: "▦", label: "Call for Papers", href: "cfp.html" },
      { ic: "↥", label: "Submit Paper", href: "submit-paper.html" },
      { ic: "▤", label: "My Submissions", href: "my-submissions.html" },
    ],
    reviewer: [
      { ic: "▣", label: "Dashboard", href: "dashboard-reviewer.html" },
      { ic: "▤", label: "Review Paper", href: "review-paper.html" },
    ],
  };

  /* ---------- Workspaces (acquired roles) + their navigation ---------- */
  var WORKSPACES = {
    admin: { label: "Conference Admin", home: "conference-overview.html" },
    author: { label: "Author", home: "dashboard-author.html" },
    lead: { label: "Track Lead", home: "dashboard-lead.html" },
    reviewer: { label: "Reviewer", home: "review-paper.html" },
  };
  // Always-visible "Menu" items are built per-shell (Home, My Conferences for admins, Browse CFPs).
  var WS_NAV = {
    admin: [
      {
        ic: "▣",
        label: "Overview",
        href: "conference-overview.html",
        conf: true,
      },
      { ic: "▦", label: "Tracks", href: "configure-tracks.html", conf: true },
      {
        ic: "▤",
        label: "Call For Papers",
        href: "publish-cfp.html",
        conf: true,
      },
      { ic: "≣", label: "Papers", href: "papers.html", conf: true },
      {
        ic: "⚙",
        label: "Edit Conference",
        href: "create-conference.html",
        conf: true,
        extra: "&edit=1",
      },
    ],
    author: [
      { ic: "▣", label: "Dashboard", href: "dashboard-author.html" },
      { ic: "▤", label: "My Papers", href: "my-submissions.html" },
      { ic: "↥", label: "Submit Paper", href: "submit-paper.html" },
      {
        ic: "≡",
        label: "Submission History",
        href: "my-submissions.html?view=history",
      },
    ],
    lead: [
      { ic: "▣", label: "Dashboard", href: "dashboard-lead.html" },
      { ic: "⇄", li: "users", label: "Track Team", href: "track-team.html" },
      { ic: "⇄", li: "user-check", label: "Review Assignment", href: "review-assignment.html" },
      { ic: "◎", label: "Review Analysis", href: "review-analysis.html" },
      { ic: "✓", label: "Acceptance Decision", href: "acceptance-decision.html" },
    ],
    reviewer: [
      { ic: "▣", label: "Dashboard", href: "dashboard-reviewer.html" },
      { ic: "▤", label: "Review Paper", href: "review-paper.html" },
    ],
  };

  /* ---------- Sidebar icons (Lucide). Unicode kept as offline fallback. ---------- */
  var ICON_MAP = {
    "⌂": "home", "▣": "layout-dashboard", "▤": "file-text", "▦": "layers",
    "≣": "files", "◷": "git-branch", "⚙": "settings", "＋": "plus",
    "↥": "upload", "≡": "history", "⇄": "users", "◎": "bar-chart-2", "✓": "check-circle"
  };
  function navIcon(n) {
    var name = n.li || ICON_MAP[n.ic] || "circle";
    return '<span class="ic"><i data-lucide="' + name + '">' + n.ic + "</i></span>";
  }

  /* ---------- Country / region list (shared by forms) ---------- */
  var COUNTRIES = ["Australia", "Bangladesh", "Brazil", "Canada", "China", "Egypt", "France",
    "Germany", "India", "Indonesia", "Italy", "Japan", "Kenya", "Malaysia", "Nepal", "Netherlands",
    "Nigeria", "Pakistan", "Philippines", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
    "Spain", "Sri Lanka", "Sweden", "Switzerland", "Turkey", "United Arab Emirates", "United Kingdom",
    "United States", "Vietnam", "Other"];

  /* ---------- Page metadata: which role owns it + breadcrumb ---------- */
  var PAGES = {
    // ----- Workspace model (new navigation) -----
    onboarding: { ws: "onboarding", crumbs: [] },
    "account-settings": { account: true, crumbs: ["Account Settings"] },

    // Conference Admin workspace (conference-scoped)
    "conference-overview": { ws: "admin", conf: true, crumbs: ["Overview"] },
    "configure-tracks": { ws: "admin", conf: true, crumbs: ["Tracks"] },
    "publish-cfp": { ws: "admin", conf: true, crumbs: ["Call For Papers"] },
    papers: { ws: "admin", conf: true, crumbs: ["Papers & Pipeline"] },
    pipeline: { ws: "admin", conf: true, crumbs: ["Papers & Pipeline"] },
    "create-conference": { account: true, crumbs: ["Create Conference"] }, // neutral: onboarding (create) or admin (edit)

    // Author workspace
    "dashboard-author": { ws: "author", crumbs: ["Dashboard"] },
    "my-submissions": { ws: "author", crumbs: ["My Papers"] },
    "submit-paper": { ws: "author", crumbs: ["Submit Paper"] },
    "submission-detail": { ws: "author", crumbs: ["My Papers", "Submission"] },
    cfp: { account: true, crumbs: ["Browse CFPs"] }, // general: keeps current workspace

    conferences: { ws: "admin", crumbs: ["My Conferences"] },

    // ----- Track Lead workspace -----
    "dashboard-lead": { ws: "lead", crumbs: ["Dashboard"] },
    "track-team": { account: true, conf: true, crumbs: ["Track Team"] },
    "review-assignment": { ws: "lead", crumbs: ["Review Assignment"] },
    "review-analysis": { ws: "lead", crumbs: ["Review Analysis"] },
    "acceptance-decision": { ws: "lead", crumbs: ["Acceptance Decision"] },

    // ----- Reviewer workspace -----
    "dashboard-reviewer": { ws: "reviewer", crumbs: ["Dashboard"] },
    "review-paper": { ws: "reviewer", crumbs: ["Review Paper"] },
    "review-submit": { ws: "reviewer", crumbs: ["Review Paper", "Review"] },

    // ----- Legacy role pages (kept, hidden from nav — deferred) -----
    "dashboard-admin": { role: "admin", crumbs: ["Dashboard"] },
  };

  /* ---------- Role state ---------- */
  function getRole() {
    var r = localStorage.getItem(ROLE_KEY);
    return ROLES[r] ? r : "admin";
  }
  function setRole(r) {
    if (ROLES[r]) localStorage.setItem(ROLE_KEY, r);
  }

  /* ============================================================
     AUTH  (accounts + session — prototype only, localStorage)
     Stored under its own key so "Reset demo data" doesn't log out.
     Passwords are plain text: fine for a prototype, NOT for real use.
     ============================================================ */
  var AUTH_KEY = "cms_proto_auth";
  function seedAuth() {
    return {
      accounts: [
        {
          id: "ACC-1001",
          firstName: "Demo",
          lastName: "User",
          email: "demo@confmanage.org",
          mobile: "",
          country: "India",
          affiliation: "ConfManage",
          password: "demo1234",
          role: "",
          roles: ["admin", "author"],
          createdAt: "2026-01-01",
        },
      ],
      session: null,
      rememberedEmail: "",
    };
  }
  function loadAuth() {
    var raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      var s = seedAuth();
      localStorage.setItem(AUTH_KEY, JSON.stringify(s));
      return s;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var s2 = seedAuth();
      localStorage.setItem(AUTH_KEY, JSON.stringify(s2));
      return s2;
    }
  }
  function saveAuth(a) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(a));
  }

  function authEmailExists(email) {
    return loadAuth().accounts.some(function (x) {
      return x.email.toLowerCase() === String(email || "").toLowerCase();
    });
  }
  function authSignup(acc) {
    var a = loadAuth();
    acc.id = "ACC-" + (1001 + a.accounts.length);
    acc.role = ""; // new accounts carry no role by default
    acc.createdAt = new Date().toISOString().slice(0, 10);
    a.accounts.push(acc);
    a.session = {
      email: acc.email,
      name: acc.firstName + " " + acc.lastName,
      remember: true,
      at: Date.now(),
    };
    a.rememberedEmail = acc.email;
    saveAuth(a);
    return acc;
  }
  function authLogin(email, password, remember) {
    var a = loadAuth();
    var acc = a.accounts.find(function (x) {
      return (
        x.email.toLowerCase() === String(email || "").toLowerCase() &&
        x.password === password
      );
    });
    if (!acc) return false;
    a.session = {
      email: acc.email,
      name: acc.firstName + " " + acc.lastName,
      remember: !!remember,
      at: Date.now(),
    };
    a.rememberedEmail = remember ? acc.email : "";
    saveAuth(a);
    return true;
  }
  function authCurrent() {
    var a = loadAuth();
    if (!a.session) return null;
    return (
      a.accounts.find(function (x) {
        return x.email.toLowerCase() === a.session.email.toLowerCase();
      }) || null
    );
  }
  function authLogout() {
    var a = loadAuth();
    a.session = null;
    a.rememberedEmail = ""; // logging out forgets the prefilled email
    saveAuth(a);
  }
  // DEMO ONLY: switch the active session to an existing account without a
  // password. Powers the floating demo account switcher so a complete,
  // multi-person flow (Admin/Author + Track Lead/Reviewer) can be shown on one
  // browser. Not a real auth path — real login still goes through authLogin().
  function authSwitchTo(email) {
    var a = loadAuth();
    var acc = a.accounts.find(function (x) {
      return x.email.toLowerCase() === String(email || "").toLowerCase();
    });
    if (!acc) return false;
    a.session = {
      email: acc.email,
      name: acc.firstName + " " + acc.lastName,
      remember: true,
      at: Date.now(),
    };
    a.rememberedEmail = acc.email;
    saveAuth(a);
    return true;
  }

  /* ---------- Workspaces / acquired roles ---------- */
  function getWorkspace() {
    return localStorage.getItem(WS_KEY) || "onboarding";
  }
  function setWorkspace(w) {
    if (WORKSPACES[w]) localStorage.setItem(WS_KEY, w);
  }
  function getConf() {
    return localStorage.getItem(CONF_KEY) || "";
  }
  function setConf(id) {
    if (id) localStorage.setItem(CONF_KEY, id);
  }

  function authRoles() {
    var cu = authCurrent();
    return cu && cu.roles ? cu.roles : [];
  }
  function authHasRole(r) {
    return authRoles().indexOf(r) >= 0;
  }
  function authGrantRole(r) {
    var a = loadAuth();
    if (!a.session) return;
    var acc = a.accounts.find(function (x) {
      return x.email.toLowerCase() === a.session.email.toLowerCase();
    });
    if (!acc) return;
    if (!acc.roles) acc.roles = [];
    if (acc.roles.indexOf(r) < 0) acc.roles.push(r);
    saveAuth(a);
  }
  // Where to send the user after login: onboarding for new users, else the last
  // active workspace (restoring the remembered conference for admin).
  function landingHref() {
    var roles = authRoles();
    if (!roles.length) return "onboarding.html";
    var ws = localStorage.getItem(WS_KEY);
    if (roles.indexOf(ws) < 0)
      ws = roles.indexOf("admin") >= 0 ? "admin" : roles[0];
    if (ws === "admin") {
      var c = getConf();
      return "conference-overview.html" + (c ? "?conf=" + c : "");
    }
    return WORKSPACES[ws] ? WORKSPACES[ws].home : "onboarding.html";
  }

  /* ---------- Account-bound role records (Phase 2) ---------- */
  // The reviewer record whose email matches the logged-in account, or null.
  function currentReviewer(db) {
    db = db || load();
    var cu = authCurrent();
    if (!cu) return null;
    return db.reviewers.find(function (r) {
      return r.email && r.email.toLowerCase() === cu.email.toLowerCase();
    }) || null;
  }
  // The track-lead record whose email matches the logged-in account, or null.
  function currentLead(db) {
    db = db || load();
    var cu = authCurrent();
    if (!cu) return null;
    return db.trackLeads.find(function (l) {
      return l.email && l.email.toLowerCase() === cu.email.toLowerCase();
    }) || null;
  }
  // Tracks owned by the logged-in track lead.
  function currentLeadTrackIds(db) {
    db = db || load();
    var lead = currentLead(db);
    if (!lead) return [];
    return db.tracks.filter(function (t) { return t.trackLeadId === lead.id; })
      .map(function (t) { return t.id; });
  }
  // Conflict of interest: is this paper authored by the logged-in account?
  function isOwnPaper(paper) {
    var cu = authCurrent();
    if (!cu || !paper) return false;
    if (paper.email && cu.email && paper.email.toLowerCase() === cu.email.toLowerCase()) return true;
    var pn = ((paper.authorFirst || "") + " " + (paper.authorLast || "")).trim().toLowerCase();
    var an = ((cu.firstName || "") + " " + (cu.lastName || "")).trim().toLowerCase();
    return pn !== "" && pn === an;
  }

  /* ============================================================
     DATA STORE  (seed data for a believable, clickable flow)
     ============================================================ */
  function seed() {
    return {
      invitations: seedInvitations(),
      conferences: [
        {
          id: "CONF-2025-001",
          name: "International Conference on Applied Computing",
          acronym: "ICAC 2025",
          webPage: "https://icac2025.example.org",
          venue: "Grand Riverside Convention Centre",
          city: "Pune",
          country: "India",
          startDate: "2025-11-12",
          endDate: "2025-11-14",
          abstractDeadline: "2025-08-15",
          submissionDeadline: "2025-09-01",
          status: "cfp", // draft | configured | cfp
          cfpContent:
            "ICAC 2025 invites original research contributions in applied computing. Papers must be original, unpublished, and not under review elsewhere. Submissions are double-blind and limited to 8 pages in the conference template. Please select the most relevant track on submission.",
          createdBy: "demo@confmanage.org",
        },
        {
          id: "CONF-2025-002",
          name: "Symposium on Data & Society",
          acronym: "SDS 2025",
          webPage: "",
          venue: "City University Auditorium",
          city: "Bengaluru",
          country: "India",
          startDate: "2025-12-05",
          endDate: "2025-12-06",
          abstractDeadline: "2025-09-20",
          submissionDeadline: "2025-10-05",
          status: "draft",
          cfpContent: "",
          createdBy: "demo@confmanage.org",
        },
      ],
      trackLeads: [
        {
          id: "TL-01", firstName: "Anita", lastName: "Rao", name: "Dr. Anita Rao",
          email: "anita.rao@univpune.edu", phone: "", affiliation: "University of Pune",
          organization: "University of Pune", country: "India",
          status: "accepted", conferenceId: "CONF-2025-001",
        },
        {
          id: "TL-02", firstName: "Vikram", lastName: "Singh", name: "Dr. Vikram Singh",
          email: "v.singh@iitd.ac.in", phone: "", affiliation: "IIT Delhi",
          organization: "IIT Delhi", country: "India",
          status: "accepted", conferenceId: "CONF-2025-001",
        },
      ],
      tracks: [
        {
          id: "TRK-01",
          conferenceId: "CONF-2025-001",
          name: "Machine Learning & AI",
          description:
            "Theory and applications of ML, deep learning and AI systems.",
          trackLeadId: "TL-01",
          trackLead: "Dr. Anita Rao",
          maxPapers: 40,
        },
        {
          id: "TRK-02",
          conferenceId: "CONF-2025-001",
          name: "Cloud & Distributed Systems",
          description:
            "Cloud platforms, distributed computing, edge and serverless.",
          trackLeadId: "TL-02",
          trackLead: "Dr. Vikram Singh",
          maxPapers: 30,
        },
        {
          id: "TRK-03",
          conferenceId: "CONF-2025-001",
          name: "Human–Computer Interaction",
          description: "Usability, interaction design and accessibility.",
          trackLeadId: "TL-01",
          trackLead: "Dr. Anita Rao",
          maxPapers: 25,
        },
      ],
      papers: [
        {
          id: "PAP-1001",
          conferenceId: "CONF-2025-001",
          trackId: "TRK-01",
          authorFirst: "Rahul",
          authorLast: "Mehta",
          email: "rahul.mehta@example.com",
          country: "India",
          affiliation: "IIT Bombay",
          title: "Efficient Transformers for Low-Resource Languages",
          abstract:
            "We present a parameter-efficient transformer variant that improves performance on low-resource language tasks while reducing memory footprint.",
          keywords: "transformers, NLP, low-resource, efficiency",
          fileName: "icac_transformers_v1.pdf",
          version: 1,
          status: "submitted",
          submissionDate: "2025-08-10",
          decisionRemarks: "",
        },
        {
          id: "PAP-1002",
          conferenceId: "CONF-2025-001",
          trackId: "TRK-02",
          authorFirst: "Demo",
          authorLast: "User",
          email: "demo@confmanage.org",
          country: "India",
          affiliation: "ConfManage",
          title: "Latency-Aware Scheduling for Serverless Edge Functions",
          abstract:
            "A scheduling approach that reduces tail latency for serverless functions deployed at the network edge.",
          keywords: "serverless, edge, scheduling, latency",
          fileName: "icac_serverless_v2.pdf",
          version: 2,
          status: "submitted",
          submissionDate: "2025-08-18",
          decisionRemarks: "",
        },
        {
          id: "PAP-1003",
          conferenceId: "CONF-2025-001",
          trackId: "TRK-01",
          authorFirst: "Rahul",
          authorLast: "Mehta",
          email: "rahul.mehta@example.com",
          country: "India",
          affiliation: "IIT Bombay",
          title: "Self-Supervised Pretraining for Tabular Data",
          abstract:
            "We explore self-supervised objectives tailored to heterogeneous tabular datasets.",
          keywords: "self-supervised, tabular, representation learning",
          fileName: "icac_tabular_v1.pdf",
          version: 1,
          status: "submitted",
          submissionDate: "2025-08-22",
          decisionRemarks: "",
        },
      ],
      reviewers: [
        {
          id: "REV-01", firstName: "Sanjay", lastName: "Kulkarni",
          email: "s.kulkarni@example.edu", phone: "+91 98200 11111",
          organization: "University of Pune", affiliation: "University of Pune", country: "India",
          role: "Reviewer", status: "accepted", trackIds: ["TRK-01"], invitation: "",
        },
        {
          id: "REV-02", firstName: "Meera", lastName: "Iyer",
          email: "meera.iyer@example.edu", phone: "+91 98200 22222",
          organization: "IISc Bengaluru", affiliation: "IISc Bengaluru", country: "India",
          role: "Reviewer", status: "accepted", trackIds: ["TRK-01"], invitation: "",
        },
        {
          id: "REV-03", firstName: "David", lastName: "Park",
          email: "d.park@example.edu", phone: "+1 415 555 0144",
          organization: "Stanford University", affiliation: "Stanford University", country: "USA",
          role: "Reviewer", status: "accepted", trackIds: ["TRK-02"], invitation: "",
        },
      ],
      assignments: [
        {
          id: "ASG-01",
          reviewerId: "REV-01",
          paperId: "PAP-1001",
          date: "2025-08-12",
          status: "completed",
          trackId: "TRK-01",
          assignedBy: "Dr. Anita Rao",
        },
        {
          id: "ASG-02",
          reviewerId: "REV-02",
          paperId: "PAP-1001",
          date: "2025-08-12",
          status: "completed",
          trackId: "TRK-01",
          assignedBy: "Dr. Anita Rao",
        },
        {
          id: "ASG-03",
          reviewerId: "REV-03",
          paperId: "PAP-1002",
          date: "2025-08-20",
          status: "pending",
          trackId: "TRK-02",
          assignedBy: "Dr. Vikram Singh",
        },
      ],
      reviews: [
        {
          id: "RV-01",
          paperId: "PAP-1001",
          reviewerId: "REV-01",
          score: 8,
          recommendation: "Accept",
          comments:
            "Solid contribution with clear experiments. Minor clarity issues in Section 4.",
          submittedAt: "2025-08-25",
        },
        {
          id: "RV-02",
          paperId: "PAP-1001",
          reviewerId: "REV-02",
          score: 6,
          recommendation: "Revision Required",
          comments:
            "Promising, but needs comparison against more recent baselines.",
          submittedAt: "2025-08-26",
        },
      ],
      activities: [
        {
          email: "demo@confmanage.org",
          action: "submit_paper",
          title: "Efficient Transformers for Low-Resource Languages",
          id: "PAP-1001",
          timestamp: "2025-08-10T14:30:00.000Z"
        },
        {
          email: "demo@confmanage.org",
          action: "create_conference",
          title: "Symposium on Data & Society",
          id: "CONF-2025-002",
          timestamp: "2026-06-25T11:00:00.000Z"
        }
      ],
      paperVersions: [
        {
          paperId: "PAP-1001",
          version: 1,
          title: "Efficient Transformers for Low-Resource Languages",
          abstract: "We present a parameter-efficient transformer variant that improves performance on low-resource language tasks while reducing memory footprint.",
          keywords: "transformers, NLP, low-resource, efficiency",
          fileName: "icac_transformers_v1.pdf",
          date: "2025-08-10"
        },
        {
          paperId: "PAP-1002",
          version: 1,
          title: "Latency-Aware Scheduling for Serverless Edge Functions",
          abstract: "A scheduling approach that reduces tail latency for serverless functions deployed at the network edge.",
          keywords: "serverless, edge, scheduling, latency",
          fileName: "icac_serverless_v1.pdf",
          date: "2025-08-15"
        },
        {
          paperId: "PAP-1002",
          version: 2,
          title: "Latency-Aware Scheduling for Serverless Edge Functions",
          abstract: "A scheduling approach that reduces tail latency for serverless functions deployed at the network edge. Updated with tail latency optimization details.",
          keywords: "serverless, edge, scheduling, latency",
          fileName: "icac_serverless_v2.pdf",
          date: "2025-08-18"
        },
        {
          paperId: "PAP-1003",
          version: 1,
          title: "Self-Supervised Pretraining for Tabular Data",
          abstract: "We explore self-supervised objectives tailored to heterogeneous tabular datasets.",
          keywords: "self-supervised, tabular, representation learning",
          fileName: "icac_tabular_v1.pdf",
          date: "2025-08-22"
        }
      ]
    };
  }

  function load() {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      var s = seed();
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      return s;
    }
    try {
      var d = JSON.parse(raw);
      // Non-destructive migration: add collections introduced after this store was created.
      var changed = false;
      if (!d.invitations) { d.invitations = seedInvitations(); changed = true; }
      if (!d.activities) { d.activities = []; changed = true; }
      if (!d.paperVersions) { d.paperVersions = []; changed = true; }
      // Conferences are now owned by an account email. Re-attribute legacy seed
      // data (created before ownership scoping) to the demo account.
      if (Array.isArray(d.conferences)) {
        d.conferences.forEach(function (cf) {
          if (cf.createdBy === "Conference Admin") {
            cf.createdBy = "demo@confmanage.org";
            changed = true;
          }
        });
      }
      if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(d));
      return d;
    } catch (e) {
      var s2 = seed();
      localStorage.setItem(STORE_KEY, JSON.stringify(s2));
      return s2;
    }
  }
  function save(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }
  function reset() {
    localStorage.removeItem(STORE_KEY);
  }
  // Track Lead / Reviewer invitations. Pre-seed two PENDING invitations for the
  // demo account so the invite -> accept flow is explorable (roles NOT pre-granted).
  function seedInvitations() {
    var t = new Date().toISOString();
    return [
      { id: "INV-01", type: "lead", conferenceId: "CONF-2025-001", trackId: "TRK-01",
        email: "demo@confmanage.org", name: "Demo User", status: "pending",
        invitedBy: "Conference Admin", timestamp: t },
      { id: "INV-02", type: "reviewer", conferenceId: "CONF-2025-001", trackId: "TRK-01",
        email: "demo@confmanage.org", name: "Demo User", status: "pending",
        invitedBy: "Dr. Anita Rao (Track Lead)", timestamp: t }
    ];
  }
  function logActivity(action, title, id) {
    var cu = authCurrent();
    if (!cu) return;
    var db = load();
    if (!db.activities) db.activities = [];
    db.activities.push({
      email: cu.email,
      action: action,
      title: title,
      id: id,
      timestamp: new Date().toISOString()
    });
    save(db);
  }

  /* ---------- Small helpers ---------- */
  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "—";
    var dt = new Date(d + "T00:00:00");
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  function nextId(prefix, arr) {
    var max = 0;
    arr.forEach(function (x) {
      var n = parseInt(String(x.id).replace(/\D/g, ""), 10);
      if (n > max) max = n;
    });
    return prefix + (max + 1);
  }
  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // Public CFP web page (EasyChair-style). slug from the acronym; the pretty URL
  // is illustrative, the real (local) link opens the standalone public page.
  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
  function publicUrl(conf) {
    return (
      "https://confmanage.org/cfp/" +
      (slug(conf && conf.acronym) || (conf && conf.id) || "")
    );
  }
  function publicHref(conf) {
    return "public-cfp.html?conf=" + (conf && conf.id);
  }

  function statusBadge(status) {
    var map = {
      draft: ["draft", "Draft"],
      configured: ["assigned", "Tracks Configured"],
      cfp: ["published", "CFP Published"],
      submitted: ["submitted", "Submitted"],
      assigned: ["assigned", "Assigned"],
      pending: ["pending", "Pending"],
      completed: ["completed", "Completed"],
      accepted: ["accepted", "Accepted"],
      rejected: ["rejected", "Rejected"],
      revision: ["revision", "Revision Required"],
    };
    var m = map[status] || ["draft", status || "—"];
    return '<span class="badge ' + m[0] + '">' + esc(m[1]) + "</span>";
  }

  /* ---------- Toast ---------- */
  function toast(title, desc, type) {
    var wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    var t = document.createElement("div");
    t.className = "toast" + (type === "err" ? " err" : "");
    t.innerHTML =
      '<div><div class="tt">' +
      esc(title) +
      "</div>" +
      (desc ? '<div class="td">' + esc(desc) + "</div>" : "") +
      "</div>";
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .3s";
      t.style.opacity = "0";
      setTimeout(function () {
        t.remove();
      }, 300);
    }, 3200);
  }

  /* ---------- Build the shell (dual-mode) ---------- */
  function buildShell() {
    var page = document.body.getAttribute("data-page");
    var meta = PAGES[page];
    if (meta && (meta.ws || meta.account)) buildWorkspaceShell(page, meta);
    else buildLegacyShell(page, meta || { role: getRole(), crumbs: [] });
  }

  // Shared footer wiring (logout + reset) used by both shells.
  function wireShellFooter() {
    var rd = document.getElementById("reset-data");
    if (rd)
      rd.addEventListener("click", function (e) {
        e.preventDefault();
        if (confirm("Reset all demo data back to the seeded sample set?")) {
          reset();
          location.reload();
        }
      });
    var lo = document.getElementById("logout-link");
    if (lo)
      lo.addEventListener("click", function (e) {
        e.preventDefault();
        authLogout();
        location.href = "index.html";
      });
  }

  function mountShell(shell) {
    var tpl = document.getElementById("page-content");
    if (tpl) tpl.remove();
    document.body.insertAdjacentHTML("beforeend", shell);
  }

  /* ----- New workspace shell (onboarding / admin / author / account) ----- */
  function buildWorkspaceShell(page, meta) {
    var ws = meta.account ? getWorkspace() : meta.ws;
    if (ws === "admin" || ws === "author") setWorkspace(ws);

    var cu = authCurrent();
    var acctName = cu ? cu.firstName + " " + cu.lastName : "User";
    var acctEmail = cu ? cu.email : "";

    // Single active conference for admin scoping.
    var confId = param("conf") || getConf();
    if (param("conf")) setConf(param("conf"));
    // The "My CFP" list is where a conference is chosen, not worked in — don't
    // carry a previously-opened conference into context here, so the conference
    // tools (Overview, Tracks, CFP, …) stay hidden until one is opened.
    if (page === "conferences") confId = "";
    var confName = "";
    if (ws === "admin" && confId) {
      var cf = load().conferences.find(function (x) {
        return x.id === confId;
      });
      if (cf) confName = cf.acronym || cf.name;
      else confId = ""; // stale / deleted conference -> treat as none selected
    }

    // Conference tools only make sense inside a conference. With none selected,
    // show just the entry point (Create Conference); My Conferences stays in the Menu.
    var navList = WS_NAV[ws] || [];
    if (ws === "admin" && !confId)
      navList = [
        {
          ic: "＋",
          label: "Create Conference",
          href: "create-conference.html",
        },
      ];

    var curView = param("view") || "";
    var navItems = navList
      .map(function (n) {
        var href = n.href;
        if (n.conf && confId)
          href = n.href.split("?")[0] + "?conf=" + confId + (n.extra || "");
        var base = href.split("?")[0].replace(".html", "");
        var iv = (href.match(/view=([^&]+)/) || [])[1] || "";
        var active = base === page && iv === curView ? " active" : "";
        return (
          '<a class="nav-item' + active + '" href="' + href + '">' +
          navIcon(n) + esc(n.label) + "</a>"
        );
      })
      .join("");
    var groupTitle = WORKSPACES[ws] ? WORKSPACES[ws].label : "Account";
    var navGroup = navItems
      ? '<div class="nav-group"><div class="nav-group-title">' +
        groupTitle +
        "</div>" +
        navItems +
        "</div>"
      : "";

    // Menu items. My CFP (conferences list) for admins on any workspace.
    var gen = [{ ic: "⌂", li: "home", label: "Home", href: "onboarding.html" }];
    if (authHasRole("admin"))
      gen.push({ ic: "▤", li: "folder", label: "My CFP", href: "conferences.html" });
    gen.push({ ic: "▦", li: "newspaper", label: "CFP", href: "public-cfp.html" });
    var generalItems = gen
      .map(function (n) {
        var base = n.href.split("?")[0].replace(".html", "");
        var active = base === page ? " active" : "";
        return (
          '<a class="nav-item' + active + '" href="' + n.href + '">' +
          navIcon(n) + esc(n.label) + "</a>"
        );
      })
      .join("");
    var generalGroup =
      '<div class="nav-group"><div class="nav-group-title">Menu</div>' +
      generalItems +
      "</div>";

    var homeHref =
      ws === "admin"
        ? "conference-overview.html" + (confId ? "?conf=" + confId : "")
        : WORKSPACES[ws]
          ? WORKSPACES[ws].home
          : "onboarding.html";
    var homeLabel = WORKSPACES[ws] ? WORKSPACES[ws].label : "Home";
    var crumbs = (meta.crumbs || []).slice();
    // Show the conference name only on conference-scoped pages, not on lists like My Conferences.
    if (ws === "admin" && meta.conf && confName)
      crumbs = [confName].concat(crumbs);
    var crumbHtml = ['<a href="' + homeHref + '">' + esc(homeLabel) + "</a>"]
      .concat(
        crumbs.map(function (c, i, arr) {
          var cls = i === arr.length - 1 ? "cur" : "";
          return (
            '<span class="sep">/</span><span class="' +
            cls +
            '">' +
            esc(c) +
            "</span>"
          );
        }),
      )
      .join("");
    var pageTitle =
      meta.crumbs && meta.crumbs.length
        ? meta.crumbs[meta.crumbs.length - 1]
        : homeLabel;

    var np = acctName.trim().split(/\s+/);
    var initials = (
      np.length > 1 ? np[0][0] + np[1][0] : (np[0] || "U").slice(0, 2)
    ).toUpperCase();

    var tpl = document.getElementById("page-content");
    var contentHtml = tpl ? tpl.innerHTML : "";

    var shell =
      '<div class="layout">' +
      '<aside class="sidebar">' +
      '<a class="brand" href="onboarding.html" title="Home"><span class="logo">CM</span><span>ConfManage</span></a>' +
      '<div class="sidebar-scroll">' +
      generalGroup +
      navGroup +
      "</div>" +
      '<div class="sidebar-bottom">' +
      '<div class="side-user"><span class="avatar">' +
      initials +
      "</span>" +
      '<span class="su-meta"><span class="su-name">' +
      esc(acctName) +
      '</span><span class="su-sub">' +
      esc(acctEmail) +
      "</span></span></div>" +
      '<div class="sidebar-foot"><a href="account-settings.html#profile">Profile</a><span class="dotsep">·</span><a href="account-settings.html">Settings</a><span class="dotsep">·</span><a href="#" id="logout-link">Log out</a></div>' +
      '<div class="sidebar-foot" style="padding-top:0"><a href="#" id="reset-data">Reset demo data</a></div>' +
      "</div>" +
      "</aside>" +
      '<div class="main">' +
      '<header class="topbar">' +
      '<div class="topbar-left">' +
      '<div class="breadcrumb">' +
      crumbHtml +
      "</div>" +
      '<div class="topbar-title">' +
      esc(pageTitle) +
      "</div>" +
      "</div>" +
      '<div class="topbar-right">' +
      (WORKSPACES[ws] ? '<span class="role-indicator">Workspace · <strong>' + esc(WORKSPACES[ws].label) + "</strong></span>" : "") +
      '<span class="avatar topbar-avatar" title="' +
      esc(acctName) +
      '">' +
      initials +
      "</span>" +
      "</div>" +
      "</header>" +
      '<main class="content">' +
      contentHtml +
      "</main>" +
      "</div>" +
      "</div>" +
      '<div class="toast-wrap" id="toast-wrap"></div>';

    mountShell(shell);
    if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
    wireShellFooter();
  }

  /* ----- Legacy role shell (kept for deferred Reviewer/Track Lead pages) ----- */
  function buildLegacyShell(page, meta) {
    var role = meta.role || getRole();
    if (meta.role) setRole(role);

    var navItems = NAV[role]
      .map(function (n) {
        var active = n.href.replace(".html", "") === page ? " active" : "";
        return (
          '<a class="nav-item' + active + '" href="' + n.href + '">' +
          navIcon(n) + esc(n.label) + "</a>"
        );
      })
      .join("");

    var pageTitle =
      meta.crumbs && meta.crumbs.length
        ? meta.crumbs[meta.crumbs.length - 1]
        : ROLES[role].label;
    var crumbHtml = [
      '<a href="' + ROLES[role].home + '">' + esc(ROLES[role].label) + "</a>",
    ]
      .concat(
        (meta.crumbs || []).map(function (c, i, arr) {
          var cls = i === arr.length - 1 ? "cur" : "";
          return (
            '<span class="sep">/</span><span class="' +
            cls +
            '">' +
            esc(c) +
            "</span>"
          );
        }),
      )
      .join("");

    var parts = ROLES[role].label.split(" ");
    var initials = (
      parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
    ).toUpperCase();
    var cu = authCurrent();
    var sessSub = cu ? esc(cu.email) : "Demo session";

    var tpl = document.getElementById("page-content");
    var contentHtml = tpl ? tpl.innerHTML : "";

    var shell =
      '<div class="layout">' +
      '<aside class="sidebar">' +
      '<a class="brand" href="onboarding.html" title="Home — create a conference or browse public CFPs"><span class="logo">CM</span><span>ConfManage</span></a>' +
      '<div class="sidebar-scroll"><div class="nav-group"><div class="nav-group-title">' +
      esc(ROLES[role].label) +
      " (legacy)</div>" +
      navItems +
      "</div></div>" +
      '<div class="sidebar-bottom">' +
      '<div class="side-user"><span class="avatar">' +
      initials +
      "</span>" +
      '<span class="su-meta"><span class="su-name">' +
      esc(ROLES[role].label) +
      '</span><span class="su-sub">' +
      sessSub +
      "</span></span></div>" +
      '<div class="sidebar-foot"><a href="#" id="logout-link">Log out</a><span class="dotsep">·</span><a href="#" id="reset-data">Reset demo data</a></div>' +
      "</div>" +
      "</aside>" +
      '<div class="main">' +
      '<header class="topbar">' +
      '<div class="topbar-left">' +
      '<div class="breadcrumb">' +
      crumbHtml +
      "</div>" +
      '<div class="topbar-title">' +
      esc(pageTitle) +
      "</div>" +
      "</div>" +
      '<div class="topbar-right">' +
      '<span class="role-indicator">Role · <strong>' + esc(ROLES[role].label) + "</strong></span>" +
      '<span class="avatar topbar-avatar" title="' +
      esc(ROLES[role].label) +
      '">' +
      initials +
      "</span>" +
      "</div>" +
      "</header>" +
      '<main class="content">' +
      contentHtml +
      "</main>" +
      "</div>" +
      "</div>" +
      '<div class="toast-wrap" id="toast-wrap"></div>';

    mountShell(shell);
    if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
    wireShellFooter();
  }

  /* ============================================================
     PROCESS-INSTANCE WORKFLOW  (read-only, derived from data)
     7-step activity model. States: done | active | pending | skipped.
     ============================================================ */
  function statusLabel(s) {
    return s === "accepted"
      ? "Accepted"
      : s === "rejected"
        ? "Rejected"
        : s === "revision"
          ? "Revision Required"
          : s === "assigned"
            ? "Assigned"
            : s === "submitted"
              ? "Submitted"
              : s || "—";
  }

  function workflow(paper, db) {
    db = db || load();
    var asgs = db.assignments.filter(function (a) {
      return a.paperId === paper.id;
    });
    var revs = db.reviews.filter(function (r) {
      return r.paperId === paper.id;
    });
    var reviewed = {};
    revs.forEach(function (r) {
      reviewed[r.reviewerId] = true;
    });

    var assignedCount = asgs.length;
    var reviewedCount = asgs.filter(function (a) {
      return reviewed[a.reviewerId];
    }).length;
    // Seed data may carry reviews without explicit assignments — fall back.
    if (assignedCount === 0 && revs.length > 0) {
      assignedCount = revs.length;
      reviewedCount = revs.length;
    }

    var allReviewed = assignedCount > 0 && reviewedCount >= assignedCount;
    var revisionRequested =
      paper.status === "revision" ||
      revs.some(function (r) {
        return r.recommendation === "Revision Required";
      });
    var finalDecided =
      paper.status === "accepted" || paper.status === "rejected";

    var steps = [];
    steps.push({
      key: "submit",
      short: "Submit",
      label: "Submission received",
      owner: "Author",
      state: "done",
      detail:
        "Submitted " + fmtDate(paper.submissionDate) + " · v" + paper.version,
    });

    steps.push({
      key: "assign",
      short: "Assign",
      label: "Reviewers assigned & notified",
      owner: "Track Lead",
      state: assignedCount > 0 ? "done" : "active",
      detail:
        assignedCount > 0
          ? assignedCount + " reviewer(s) assigned & notified"
          : "Awaiting reviewer assignment",
    });

    steps.push({
      key: "review",
      short: "Review",
      label: "Review, comments & score",
      owner: "Reviewer(s)",
      state: assignedCount === 0 ? "pending" : allReviewed ? "done" : "active",
      detail:
        assignedCount === 0
          ? "Blocked until reviewers are assigned"
          : reviewedCount + " of " + assignedCount + " reviews submitted",
    });

    var rvState, rvDetail;
    if (!revisionRequested) {
      rvState = "skipped";
      rvDetail = "No revision requested";
    } else if (paper.status === "revision") {
      rvState = "active";
      rvDetail = "Awaiting author’s revised submission";
    } else if (paper.version > 1) {
      rvState = "done";
      rvDetail = "Author resubmitted (v" + paper.version + ")";
    } else {
      rvState = "active";
      rvDetail = "Awaiting author’s revised submission";
    }
    steps.push({
      key: "revision",
      short: "Revision",
      label: "Author revision (if requested)",
      owner: "Author",
      state: rvState,
      detail: rvDetail,
    });

    steps.push({
      key: "finalize",
      short: "Finalize",
      label: "Reviews finalized",
      owner: "Reviewer(s)",
      state: assignedCount === 0 ? "pending" : allReviewed ? "done" : "active",
      detail: allReviewed
        ? "All reviewers submitted their recommendation"
        : "Awaiting reviewer recommendations",
    });

    // Decision is blocked while an author revision is still outstanding.
    var revisionOutstanding = rvState === "active";
    steps.push({
      key: "decision",
      short: "Decision",
      label: "Track Lead decision",
      owner: "Track Lead",
      state: finalDecided
        ? "done"
        : allReviewed && !revisionOutstanding
          ? "active"
          : "pending",
      detail: finalDecided
        ? "Decision: " + statusLabel(paper.status)
        : revisionOutstanding
          ? "Blocked until the author resubmits"
          : allReviewed
            ? "Awaiting final decision"
            : "Blocked until reviews complete",
    });

    steps.push({
      key: "confirm",
      short: "Notify",
      label: "Author notified of decision",
      owner: "Author",
      state: finalDecided ? "done" : "pending",
      detail: finalDecided
        ? "Final outcome shared with the author"
        : "Pending final decision",
    });

    var currentIndex = -1,
      i;
    for (i = 0; i < steps.length; i++) {
      if (steps[i].state === "active") {
        currentIndex = i;
        break;
      }
    }
    if (currentIndex === -1) {
      for (i = 0; i < steps.length; i++) {
        if (steps[i].state === "pending") {
          currentIndex = i;
          break;
        }
      }
    }

    var completed = steps.every(function (s) {
      return s.state === "done" || s.state === "skipped";
    });
    var doneCount = steps.filter(function (s) {
      return s.state === "done";
    }).length;
    var totalCount = steps.filter(function (s) {
      return s.state !== "skipped";
    }).length;
    var current = currentIndex >= 0 ? steps[currentIndex] : null;

    return {
      steps: steps,
      currentIndex: currentIndex,
      current: current,
      pendingOn: current ? current.owner : null,
      pendingLabel: current ? current.label : "Process complete",
      completed: completed,
      status:
        paper.status === "rejected"
          ? "rejected"
          : completed
            ? "completed"
            : "in-progress",
      doneCount: doneCount,
      totalCount: totalCount,
    };
  }

  function trackerCompact(paper, db) {
    var wf = workflow(paper, db);
    var nodes = wf.steps
      .map(function (s, i) {
        var inner =
          s.state === "done" ? "✓" : s.state === "skipped" ? "–" : i + 1;
        return (
          '<div class="wf-node ' +
          s.state +
          (i === wf.currentIndex ? " current" : "") +
          '" title="' +
          esc(s.label) +
          '">' +
          '<span class="wf-dot">' +
          inner +
          '</span><span class="wf-cap">' +
          esc(s.short) +
          "</span></div>"
        );
      })
      .join("");
    var caption = wf.completed
      ? '<span class="wf-status ' +
        wf.status +
        '">' +
        (wf.status === "rejected" ? "✕ Rejected" : "✓ Completed") +
        "</span>"
      : '<span class="wf-pending">Pending on <strong>' +
        esc(wf.pendingOn) +
        "</strong> · " +
        esc(wf.pendingLabel) +
        "</span>";
    return (
      '<div class="wf-compact"><div class="wf-track">' +
      nodes +
      "</div>" +
      '<div class="wf-meta">' +
      caption +
      '<span class="wf-progress">' +
      wf.doneCount +
      "/" +
      wf.totalCount +
      " done</span></div></div>"
    );
  }

  function trackerTimeline(paper, db) {
    var wf = workflow(paper, db);
    var items = wf.steps
      .map(function (s, i) {
        var icon =
          s.state === "done" ? "✓" : s.state === "skipped" ? "–" : i + 1;
        return (
          '<li class="wf-step ' +
          s.state +
          (i === wf.currentIndex ? " current" : "") +
          '">' +
          '<span class="wf-bullet">' +
          icon +
          "</span>" +
          '<div class="wf-body"><div class="wf-head"><span class="wf-label">' +
          esc(s.label) +
          "</span>" +
          '<span class="wf-owner">' +
          esc(s.owner) +
          "</span></div>" +
          '<div class="wf-detail">' +
          esc(s.detail) +
          "</div></div></li>"
        );
      })
      .join("");
    return '<ul class="wf-timeline">' + items + "</ul>";
  }

  /* ---------- Public API ---------- */
  /* ============================================================
     DOWNLOAD / EXPORT  (client-side only)
     Bulk attachment + spreadsheet export for Track Lead / Reviewer.
     - CSV: dependency-free, opens in Excel/Sheets.
     - Attachment: the prototype stores only the file *name*, never the bytes,
       so we generate a small, valid placeholder PDF from the paper's metadata.
     - ZIP: via JSZip when present, else falls back to individual downloads.
     ============================================================ */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function sanitizeFileName(s) {
    return (
      String(s || "")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "file"
    );
  }

  function paperPdfName(p) {
    var name = ((p.authorFirst || "") + " " + (p.authorLast || "")).trim();
    return sanitizeFileName(name + " " + (p.title || p.id || "paper")) + ".pdf";
  }

  // ---- CSV ----
  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function papersToCsv(papers, db) {
    db = db || load();
    var cols = ["Paper ID", "Title", "Submitter", "Email", "Affiliation", "Country",
      "Track", "Keywords", "Abstract", "Submission Date", "Status", "Version", "File Name"];
    var rows = [cols.map(csvCell).join(",")];
    (papers || []).forEach(function (p) {
      var t = (db.tracks || []).find(function (x) { return x.id === p.trackId; }) || {};
      rows.push([
        p.id, p.title, ((p.authorFirst || "") + " " + (p.authorLast || "")).trim(),
        p.email, p.affiliation, p.country, t.name || p.trackId || "",
        p.keywords, p.abstract, p.submissionDate, p.status, p.version, p.fileName,
      ].map(csvCell).join(","));
    });
    return rows.join("\r\n");
  }
  function downloadPapersCsv(papers, db, filename) {
    // BOM so Excel reads UTF-8 correctly.
    var csv = "﻿" + papersToCsv(papers, db);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename || "papers.csv");
  }

  // ---- Placeholder PDF (minimal, valid single-page document) ----
  function pdfEscape(s) {
    return String(s == null ? "" : s)
      .replace(/[\r\n]+/g, " ")
      .replace(/[^\x20-\x7E]/g, "?") // keep ASCII so string length == byte length
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }
  function pdfWrap(s, max) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    if (!s) return [""];
    var words = s.split(" "), lines = [], cur = "";
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = "0" + s;
    return s;
  }
  function buildPaperPdfString(paper, db) {
    db = db || load();
    var t = (db.tracks || []).find(function (x) { return x.id === paper.trackId; }) || {};
    var name = ((paper.authorFirst || "") + " " + (paper.authorLast || "")).trim();
    var lines = [];
    pdfWrap(paper.title || "Untitled", 80).forEach(function (l) { lines.push(l); });
    lines.push("");
    lines.push("Paper ID: " + (paper.id || ""));
    lines.push("Author: " + name);
    lines.push("Email: " + (paper.email || ""));
    lines.push("Affiliation: " + (paper.affiliation || ""));
    lines.push("Country: " + (paper.country || ""));
    lines.push("Track: " + (t.name || paper.trackId || ""));
    lines.push("Submission Date: " + (paper.submissionDate || ""));
    lines.push("Status: " + (paper.status || ""));
    lines.push("Version: " + (paper.version || 1));
    lines.push("Keywords: " + (paper.keywords || ""));
    lines.push("Original file: " + (paper.fileName || ""));
    lines.push("");
    lines.push("Abstract:");
    pdfWrap(paper.abstract || "", 90).forEach(function (l) { lines.push(l); });
    lines.push("");
    lines.push("---");
    lines.push("Prototype placeholder - the original uploaded file is not stored.");

    var ops = "BT\n/F1 12 Tf\n50 760 Td\n15 TL\n";
    lines.forEach(function (l) { ops += "(" + pdfEscape(l) + ") Tj T*\n"; });
    ops += "ET";

    var objs = [
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
      "<</Length " + ops.length + ">>\nstream\n" + ops + "\nendstream",
    ];
    var header = "%PDF-1.4\n";
    var body = "", offsets = [], pos = header.length;
    objs.forEach(function (o, i) {
      offsets.push(pos);
      var obj = (i + 1) + " 0 obj\n" + o + "\nendobj\n";
      body += obj;
      pos += obj.length;
    });
    var xrefPos = header.length + body.length;
    var xref = "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offsets.forEach(function (off) { xref += pad10(off) + " 00000 n \n"; });
    var trailer = "trailer\n<</Size " + (objs.length + 1) +
      "/Root 1 0 R>>\nstartxref\n" + xrefPos + "\n%%EOF";
    return header + body + xref + trailer;
  }
  function buildPaperPdfBlob(paper, db) {
    return new Blob([buildPaperPdfString(paper, db)], { type: "application/pdf" });
  }

  // ---- ZIP of attachments (JSZip if available, else individual downloads) ----
  function uniqueName(used, base) {
    if (!used[base]) { used[base] = 1; return base; }
    var n = used[base]++;
    return base.replace(/\.pdf$/i, "") + " (" + n + ").pdf";
  }
  function downloadPapersZip(papers, db, zipName) {
    db = db || load();
    papers = papers || [];
    if (!papers.length) return;
    if (window.JSZip) {
      var zip = new JSZip(), used = {};
      papers.forEach(function (p) {
        zip.file(uniqueName(used, paperPdfName(p)), buildPaperPdfString(p, db));
      });
      zip.generateAsync({ type: "blob" }).then(function (blob) {
        downloadBlob(blob, zipName || "submissions.zip");
      });
    } else {
      // Fallback: stagger individual downloads so the browser doesn't drop them.
      papers.forEach(function (p, i) {
        setTimeout(function () {
          downloadBlob(buildPaperPdfBlob(p, db), paperPdfName(p));
        }, i * 350);
      });
    }
  }

  window.CMS = {
    load: load,
    save: save,
    reset: reset,
    param: param,
    esc: esc,
    fmtDate: fmtDate,
    nextId: nextId,
    uid: uid,
    slug: slug,
    publicUrl: publicUrl,
    publicHref: publicHref,
    workflow: workflow,
    trackerCompact: trackerCompact,
    trackerTimeline: trackerTimeline,
    auth: {
      load: loadAuth,
      signup: authSignup,
      login: authLogin,
      logout: authLogout,
      current: authCurrent,
      switchTo: authSwitchTo,
      emailExists: authEmailExists,
      roles: authRoles,
      hasRole: authHasRole,
      grantRole: authGrantRole,
      landingHref: landingHref,
      save: saveAuth,
    },
    getWorkspace: getWorkspace,
    setWorkspace: setWorkspace,
    getConf: getConf,
    setConf: setConf,
    currentReviewer: currentReviewer,
    currentLead: currentLead,
    currentLeadTrackIds: currentLeadTrackIds,
    isOwnPaper: isOwnPaper,
    downloadBlob: downloadBlob,
    sanitizeFileName: sanitizeFileName,
    paperPdfName: paperPdfName,
    papersToCsv: papersToCsv,
    downloadPapersCsv: downloadPapersCsv,
    buildPaperPdfBlob: buildPaperPdfBlob,
    downloadPapersZip: downloadPapersZip,
    WORKSPACES: WORKSPACES,
    COUNTRIES: COUNTRIES,
    statusBadge: statusBadge,
    toast: toast,
    ROLES: ROLES,
    getRole: getRole,
    setRole: setRole,
    logActivity: logActivity
  };

  /* ---------- Light interactivity: animate stat numbers on load ---------- */
  function animateStats() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    var nodes = document.querySelectorAll(".stat .n");
    nodes.forEach(function (node) {
      var target = parseInt(String(node.textContent).replace(/\D/g, ""), 10);
      if (isNaN(target) || target <= 0) return;
      var dur = 700,
        start = null;
      node.classList.add("counting");
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        node.textContent = Math.round(eased * target);
        if (p < 1) requestAnimationFrame(step);
        else node.textContent = target;
      }
      requestAnimationFrame(step);
    });
  }

  /* ============================================================
     DEMO ACCOUNT SWITCHER  (prototype convenience, not production)
     A floating widget to hop between saved accounts without a password,
     so one browser can act out the full multi-person flow
     (Admin/Author <-> Track Lead/Reviewer) during a live demo.
     ============================================================ */
  var ROLE_SHORT = {
    admin: "Admin",
    author: "Author",
    lead: "Track Lead",
    reviewer: "Reviewer",
  };

  function devSwitcherStyles() {
    if (document.getElementById("cmsdev-style")) return;
    var s = document.createElement("style");
    s.id = "cmsdev-style";
    s.textContent =
      ".cmsdev{position:fixed;right:16px;bottom:16px;z-index:9999;font-family:inherit}" +
      ".cmsdev *{box-sizing:border-box}" +
      ".cmsdev-btn{display:inline-flex;align-items:center;gap:8px;background:#1e1b4b;color:#fff;border:1px solid #4338ca;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}" +
      ".cmsdev-btn:hover{background:#312e81}" +
      ".cmsdev-dot{width:7px;height:7px;border-radius:50%;background:#34d399}" +
      ".cmsdev-panel{position:absolute;right:0;bottom:48px;width:300px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.22);overflow:hidden;display:none}" +
      ".cmsdev.open .cmsdev-panel{display:block}" +
      ".cmsdev-hd{padding:11px 14px;background:#1e1b4b;color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;display:flex;justify-content:space-between;align-items:center}" +
      ".cmsdev-hd small{font-weight:500;opacity:.7}" +
      ".cmsdev-list{max-height:300px;overflow:auto}" +
      ".cmsdev-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;text-align:left;width:100%;background:#fff;border-left:0;border-right:0;border-top:0}" +
      ".cmsdev-row:hover{background:#f8fafc}" +
      ".cmsdev-row.active{background:#eef2ff;cursor:default}" +
      ".cmsdev-av{width:34px;height:34px;border-radius:50%;background:#4338ca;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 auto}" +
      ".cmsdev-meta{min-width:0;flex:1}" +
      ".cmsdev-name{font-size:13px;font-weight:650;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".cmsdev-mail{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".cmsdev-roles{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}" +
      ".cmsdev-tag{font-size:10px;font-weight:600;padding:1px 7px;border-radius:999px;background:#e0e7ff;color:#3730a3}" +
      ".cmsdev-tag.none{background:#f1f5f9;color:#94a3b8}" +
      ".cmsdev-cur{font-size:10px;font-weight:700;color:#059669}" +
      ".cmsdev-ft{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #f1f5f9}" +
      ".cmsdev-ft a{flex:1;text-align:center;font-size:12px;font-weight:600;text-decoration:none;padding:7px;border-radius:8px;border:1px solid #e5e7eb;color:#334155}" +
      ".cmsdev-ft a:hover{background:#f8fafc}";
    document.head.appendChild(s);
  }

  function devInitials(acc) {
    var f = (acc.firstName || "").trim();
    var l = (acc.lastName || "").trim();
    if (f && l) return (f[0] + l[0]).toUpperCase();
    return (f || acc.email || "U").slice(0, 2).toUpperCase();
  }

  function mountDevSwitcher() {
    if (document.getElementById("cmsdev")) return;
    devSwitcherStyles();
    var a = loadAuth();
    var accounts = a.accounts || [];
    var cu = authCurrent();
    var curEmail = cu ? cu.email.toLowerCase() : "";

    var rows = accounts
      .map(function (acc) {
        var roles = acc.roles && acc.roles.length
          ? acc.roles
              .map(function (r) {
                return '<span class="cmsdev-tag">' + esc(ROLE_SHORT[r] || r) + "</span>";
              })
              .join("")
          : '<span class="cmsdev-tag none">No role yet</span>';
        var isCur = acc.email.toLowerCase() === curEmail;
        return (
          '<button class="cmsdev-row' + (isCur ? " active" : "") + '" data-email="' +
          esc(acc.email) + '"' + (isCur ? " disabled" : "") + ">" +
          '<span class="cmsdev-av">' + esc(devInitials(acc)) + "</span>" +
          '<span class="cmsdev-meta">' +
          '<div class="cmsdev-name">' + esc(acc.firstName + " " + acc.lastName) +
          (isCur ? ' <span class="cmsdev-cur">• current</span>' : "") + "</div>" +
          '<div class="cmsdev-mail">' + esc(acc.email) + "</div>" +
          '<div class="cmsdev-roles">' + roles + "</div>" +
          "</span></button>"
        );
      })
      .join("");

    var label = cu ? esc(cu.firstName) : "Demo login";

    var wrap = document.createElement("div");
    wrap.className = "cmsdev";
    wrap.id = "cmsdev";
    wrap.innerHTML =
      '<button class="cmsdev-btn" id="cmsdev-toggle"><span class="cmsdev-dot"></span>' +
      "⇄ " + label + "</button>" +
      '<div class="cmsdev-panel">' +
      '<div class="cmsdev-hd"><span>Demo · switch account</span><small>no password</small></div>' +
      '<div class="cmsdev-list">' + (rows || '<div style="padding:14px;font-size:12px;color:#64748b">No accounts yet.</div>') + "</div>" +
      '<div class="cmsdev-ft">' +
      '<a href="signup.html">＋ New account</a>' +
      (cu ? '<a href="#" id="cmsdev-logout">Log out</a>' : '<a href="index.html">Login page</a>') +
      "</div></div>";
    document.body.appendChild(wrap);

    document.getElementById("cmsdev-toggle").addEventListener("click", function () {
      wrap.classList.toggle("open");
    });
    Array.prototype.forEach.call(wrap.querySelectorAll(".cmsdev-row:not(.active)"), function (row) {
      row.addEventListener("click", function () {
        var email = row.getAttribute("data-email");
        if (authSwitchTo(email)) location.href = landingHref();
      });
    });
    var lo = document.getElementById("cmsdev-logout");
    if (lo)
      lo.addEventListener("click", function (e) {
        e.preventDefault();
        authLogout();
        location.href = "index.html";
      });
  }

  // Standalone public pages (e.g. the public CFP web page) have no data-page
  // and therefore intentionally do not get the role-based app shell.
  if (document.body.getAttribute("data-page")) buildShell();
  mountDevSwitcher();
  window.addEventListener("load", animateStats);
})();
