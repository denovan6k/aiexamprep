export const siteContent = {
  tagline: "Turn the notes you have into practice that moves you forward.",
  promise:
    "Use the material you are already studying to practise, spot what is still shaky, and walk into your exam better prepared."
};

export const assessmentFormats = [
  "Flashcards",
  "MCQs & multi-select",
  "Short-answer theory",
  "Long-form essays",
  "Mixed mock exams",
  "Oral exam simulations",
  "Presentation defenses"
];

export const userJourneys = [
  {
    title: "First-time student",
    steps: [
      "Sign up and create a course",
      "Upload lecture notes or a textbook",
      "Your material is organised for practice",
      "Create a quiz or flashcard set",
      "Review what you missed and keep moving"
    ]
  },
  {
    title: "Professor-style practice",
    steps: [
      "Open the Agent Builder",
      "Describe your examiner in plain English",
      "Save the question style you expect",
      "Select that profile when generating quizzes",
      "Get feedback that points to the mark you missed"
    ]
  },
  {
    title: "Exam simulation",
    steps: [
      "Select course materials and scope",
      "Configure timer, question mix, and difficulty",
      "Take the mock under exam conditions",
      "Review score, explanations, and weak topics",
      "See what is worth revisiting next"
    ]
  }
];

export const targetUsers = [
  {
    title: "University students",
    description: "For midterms and finals when you need to make the most of your lecture notes."
  },
  {
    title: "Certification candidates",
    description: "For professional exams where practice under pressure makes the difference."
  },
  {
    title: "Study groups & tutors",
    description: "For groups that want to practise together without sharing every raw file."
  }
];

export const testimonials = [
  {
    quote:
      "I uploaded two lecture PDFs and had a timed mock running in under ten minutes. The distractors actually feel like my professor's exams.",
    name: "Amara Osei",
    role: "Biology major · State University",
    rating: 5
  },
  {
    quote:
      "The agent profiles are the killer feature. I set marking strictness once and every quiz matches how our course coordinator grades theory.",
    name: "Daniel Reeves",
    role: "Nursing student · RN certification prep",
    rating: 5
  },
  {
    quote:
      "Weak-topic tracking stopped me from rereading chapters I already knew. It tells me exactly which pathways to drill before finals week.",
    name: "Priya Sharma",
    role: "Pre-med · Organic chemistry",
    rating: 5
  },
  {
    quote:
      "Our study group can share decks without exposing raw slides. That made it much easier to revise together during exam season.",
    name: "Marcus Chen",
    role: "Study group lead · Cloud certification",
    rating: 5
  },
  {
    quote:
      "Flashcards generated from my quiz misses saved hours. I review what I got wrong instead of rebuilding decks from scratch.",
    name: "Elena Vasquez",
    role: "Pharmacy student · Pharmacology",
    rating: 5
  },
  {
    quote:
      "Mock exam timing plus immediate feedback made my revision feel deliberate. It's the first study tool that pushed me to attempt, not just read.",
    name: "James Okonkwo",
    role: "Law student · Bar prep",
    rating: 5
  },
  {
    quote:
      "Professor-style feedback after each question beats a wall of text from a chatbot. I know why an answer is wrong, not just that it is.",
    name: "Sofia Lindström",
    role: "Economics · Exchange student",
    rating: 5
  },
  {
    quote:
      "We run weekly mixed mocks for our certification cohort. Shared agents keep question style consistent across the whole group.",
    name: "Tyler Brooks",
    role: "DevOps cohort · AWS prep",
    rating: 5
  },
  {
    quote:
      "Uploading past papers and getting matching-style MCQs in one session changed how I study. It feels like practicing with real exam papers.",
    name: "Hannah Wright",
    role: "Psychology · Honors program",
    rating: 5
  },
  {
    quote:
      "I use different agents for definitions vs application questions. That split alone made my anatomy revision twice as efficient.",
    name: "Ravi Patel",
    role: "Medical student · Anatomy",
    rating: 5
  },
  {
    quote:
      "The progress dashboard finally shows what to do next instead of a generic streak counter. I open it before every study block.",
    name: "Chloe Nguyen",
    role: "Computer science · Algorithms",
    rating: 5
  },
  {
    quote:
      "Timed mocks with per-question feedback trained me to move faster without panicking. Closer to real exam pressure than anything else I tried.",
    name: "Oliver Grant",
    role: "Accounting · CPA track",
    rating: 5
  }
];

export const faqCategories = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Your notes, question styles, and ways to practise."
  },
  {
    id: "study-tools",
    title: "Study tools",
    description: "Quizzes, timing, feedback, and progress."
  },
  {
    id: "community",
    title: "Community",
    description: "Study groups, sharing rules, and privacy in groups."
  },
  {
    id: "account",
    title: "Account & billing",
    description: "Plans, authentication, and subscription management."
  }
] as const;

export type FaqCategory = (typeof faqCategories)[number];
export type FaqItem = {
  category: FaqCategory["id"];
  question: string;
  answer: string;
};

export const faqs: FaqItem[] = [
  {
    category: "getting-started",
    question: "What file types can I upload?",
    answer:
      "You can bring in PDFs, DOCX files, plain text, and Markdown notes."
  },
  {
    category: "getting-started",
    question: "Can I practise in my lecturer's style?",
    answer:
      "Yes. Save the question formats, marking strictness, favourite topics, and common traps you have noticed, then use that style whenever you practise."
  },
  {
    category: "getting-started",
    question: "What question types are supported?",
    answer:
      "Choose from flashcards, multiple-choice questions, short answers, long-form essays, mixed mock exams, oral exam simulations, and presentation defences."
  },
  {
    category: "study-tools",
    question: "Are quizzes timed?",
    answer:
      "Yes. Set the time, question mix, pass mark, hints, and when you want to see the answers."
  },
  {
    category: "study-tools",
    question: "How does progress tracking work?",
    answer:
      "After each attempt, you can see what is landing, what still needs work, and where your next study session will have the most impact."
  },
  {
    category: "study-tools",
    question: "How are practice questions made?",
    answer:
      "Your practice is built from the material you upload and can include explanations that point back to the relevant notes. Always check key facts against your course material."
  },
  {
    category: "community",
    question: "Can study groups share resources?",
    answer:
      "Yes. Share quizzes, flashcard decks, and saved exam styles with your group. Your raw uploads stay private unless you choose otherwise."
  },
  {
    category: "community",
    question: "What are the privacy rules for community?",
    answer:
      "Uploaded materials stay private unless you explicitly share them. Private groups are visible only to members. Shared resources never leak source files without owner consent."
  },
  {
    category: "account",
    question: "What billing plans are available?",
    answer:
      "Start free with a few courses and uploads. Student Pro gives you more room for regular practice, and team plans are on the way."
  },
  {
    category: "account",
    question: "Is OAuth supported?",
    answer:
      "You can create an account with your email and password. More sign-in options are planned."
  }
];

export const blogCategories = ["Exam strategy", "Study techniques", "AI workflows", "Product updates", "Community"];

export const blogPosts = [
  {
    title: "How to turn lecture notes into active recall",
    description: "A practical workflow for converting passive material into recall prompts and quiz sessions.",
    category: "Study techniques",
    readTime: "6 min",
    featured: true
  },
  {
    title: "Building a professor agent for tricky MCQs",
    description: "How tone, distractors, and marking expectations change the usefulness of generated practice.",
    category: "AI workflows",
    readTime: "8 min",
    featured: false
  },
  {
    title: "A practical guide to mock exam timing",
    description: "Ways to rehearse under pressure without making every study session feel like the final.",
    category: "Exam strategy",
    readTime: "5 min",
    featured: false
  },
  {
    title: "From quiz misses to flashcard decks",
    description: "Turn weak topics into spaced-repetition sessions that actually stick before exam day.",
    category: "Study techniques",
    readTime: "7 min",
    featured: false
  },
  {
    title: "Community study groups: what to share (and what not to)",
    description: "Privacy rules for sharing agents, quizzes, and decks without exposing raw course files.",
    category: "Community",
    readTime: "4 min",
    featured: false
  },
  {
    title: "Knorvex product roadmap Q2",
    description: "Quiz player, billing entitlements, and community moderation coming next.",
    category: "Product updates",
    readTime: "3 min",
    featured: false
  }
];

export const communityGroups = [
  {
    title: "Biology 201 Finals",
    description: "Shared mock exams, weekly thread reviews, and lecture-summary resources.",
    meta: "124 members · Active",
    visibility: "Public"
  },
  {
    title: "Nursing Pharmacology",
    description: "Drug class decks, clinical scenario quizzes, and concise answer feedback.",
    meta: "86 members · Recommended",
    visibility: "Public"
  },
  {
    title: "Cloud Certification Prep",
    description: "Architecture scenario practice, service comparisons, and timed certification drills.",
    meta: "59 members · Open",
    visibility: "Public"
  },
  {
    title: "Organic Chemistry Lab",
    description: "Mechanism drills, reaction flashcards, and past-paper walkthrough threads.",
    meta: "34 members · Private",
    visibility: "Private"
  }
];

export const communityFeatures = [
  "Group discovery with public and private groups",
  "Discussion threads with replies and pinned posts",
  "Share quizzes, flashcard decks, and professor agents",
  "Member roles: owner, moderator, member",
  "Content reporting and moderation queue",
  "Search across groups and threads"
];

export const legalLastUpdated = "August 13, 2026";

export const gdprSections = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: `Knorvex operates an AI-assisted exam preparation platform. For questions about data protection, contact us via the contact page. We act as the data controller for personal data you provide when registering or using the platform.`
  },
  {
    id: "lawful-basis",
    title: "Lawful basis for processing",
    body: `We process your personal data on the following bases:\n\n• Contract: to provide the study tools and features you signed up for.\n• Legitimate interests: to improve reliability, prevent fraud, and operate the platform securely.\n• Consent: for optional features such as marketing communications and non-essential analytics, where you have explicitly opted in.\n• Legal obligation: where required by applicable law.`
  },
  {
    id: "your-rights",
    title: "Your rights under GDPR",
    body: `If you are located in the European Economic Area, UK, or a jurisdiction with equivalent rights, you have the right to:\n\n• Access a copy of the personal data we hold about you.\n• Correct inaccurate or incomplete data.\n• Request deletion ("right to be forgotten") subject to legal and contractual obligations.\n• Restrict or object to processing in certain circumstances.\n• Data portability — receive your data in a structured, machine-readable format.\n• Withdraw consent at any time for consent-based processing, without affecting prior processing.\n• Lodge a complaint with your local supervisory authority.\n\nTo exercise any of these rights, contact us through the contact page. We will respond within 30 days.`
  },
  {
    id: "data-transfers",
    title: "International data transfers",
    body: `Knorvex uses service providers that may process data outside your jurisdiction, including the EEA. Where data is transferred internationally, we rely on standard contractual clauses, adequacy decisions, or equivalent safeguards as required by applicable data protection law.`
  },
  {
    id: "copyright-materials",
    title: "Uploaded materials — copyright responsibility",
    body: `You are solely responsible for ensuring you have the legal right to upload, share, and process any materials you provide to Knorvex.\n\nThis includes, but is not limited to:\n\n• Textbooks, journal articles, and course packs protected by copyright.\n• Lecture slides or handouts owned by your institution or instructor.\n• Third-party documents, PDFs, or proprietary course materials.\n\nKnorvex processes your uploaded materials to generate study aids (quizzes, flashcards, summaries) for your personal educational use. This does not constitute an endorsement of any copyright infringement.\n\nIf you upload copyrighted material, you represent that you are doing so under a lawful exception (such as personal study or fair use/fair dealing in your jurisdiction) or with the rights holder's permission.\n\nKnorvex reserves the right to remove materials reported as infringing and to suspend accounts that repeatedly violate intellectual property rights.`
  },
  {
    id: "ai-use-of-materials",
    title: "How your materials are used to enhance AI responses",
    body: `When you upload study materials, Knorvex extracts and chunks the text content. These chunks are:\n\n• Stored in your private account and are not visible to other users by default.\n• Sent as context to AI providers (such as OpenRouter or OpenAI) to generate quizzes, explanations, and feedback grounded in your specific material.\n• Used to build semantic search indexes within your account so that generated content is relevant to what you are actually studying.\n\nThis is a core feature of the platform: without your material, the AI can only generate generic knowledge questions. With your material, the AI grounds every question and explanation in the specific content of your course.\n\nWe do not use your uploaded materials to train public AI foundation models. Your chunks are processed under your account and subject to the data retention terms in our Privacy Policy.`
  },
  {
    id: "dpa",
    title: "Data processing agreements",
    body: `If you are an institution or business using Knorvex and require a Data Processing Agreement (DPA) for GDPR compliance, contact us through the contact page. We will work with you to put appropriate contractual protections in place.`
  },
  {
    id: "complaints",
    title: "Complaints",
    body: `If you have a concern about how we process your personal data, please contact us first and we will try to resolve the issue. You also have the right to lodge a complaint with the supervisory authority in your country of residence.`
  }
];

export const privacyPolicySections = [
  {
    id: "introduction",
    title: "Introduction",
    body: `Knorvex ("we", "us", "our") provides an AI-assisted exam preparation platform for students, study groups, and educators. This Privacy Policy explains what personal data we collect, how we use it, and the choices you have.\n\nBy using Knorvex, you agree to the practices described here. If you do not agree, please do not use the service.`
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: `Account information: name, email address, password hash, and profile preferences you provide at registration.\n\nStudy materials: files you upload (PDF, DOCX, TXT, Markdown), extracted text, metadata, and generated artifacts such as quizzes, flashcards, and chat history.\n\nUsage data: quiz attempts, scores, topic mastery, agent configurations, billing status, and feature usage needed to run the product.\n\nCommunity content: posts, replies, votes, group memberships, and shared resources when you participate in study groups.\n\nPayment data: subscription status and billing identifiers processed by Stripe. We do not store full card numbers on our servers.`
  },
  {
    id: "how-we-use-data",
    title: "How we use your data",
    body: `We use your data to authenticate you, deliver study features, generate practice content grounded in your materials, track progress, process subscriptions, moderate community content, and improve reliability and safety.\n\nWe do not sell your personal data. We do not use your private uploaded materials to train public foundation models without your explicit consent.`
  },
  {
    id: "ai-processing",
    title: "AI processing",
    body: `Knorvex sends relevant prompts and document chunks to configured AI providers to generate quizzes, explanations, and feedback. Outputs are validated against strict schemas where possible.\n\nSource chunks may be cited in generated responses. We design pipelines to reduce prompt-injection risk from uploaded files, but you should not upload content you are not permitted to process.`
  },
  {
    id: "sharing",
    title: "When we share data",
    body: `We share data with service providers that help us operate Knorvex, including hosting, payment (Stripe), email delivery, and AI inference providers bound by contractual obligations.\n\nIn study groups, content you explicitly share (quizzes, decks, agents, posts) is visible to members according to group permissions. Raw uploads remain private unless you choose to share derived resources.\n\nWe may disclose information if required by law or to protect users, our rights, and platform safety.`
  },
  {
    id: "retention",
    title: "Data retention",
    body: `We retain account and study data while your account is active and as needed to provide the service. If you delete materials or close your account, we remove or anonymize data within a reasonable period, subject to legal, security, and backup retention requirements.\n\nCommunity posts and shared resources may remain visible to groups until removed by you, a moderator, or an administrator.`
  },
  {
    id: "your-rights",
    title: "Your rights & choices",
    body: `Depending on your location, you may have rights to access, correct, delete, or export your personal data, and to object to or restrict certain processing.\n\nYou can update profile settings in the app, manage billing through Stripe, and contact us to request account deletion or data export.`
  },
  {
    id: "security",
    title: "Security",
    body: `We use industry-standard measures including encrypted transport (HTTPS), access controls, and hashed credentials. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.`
  },
  {
    id: "children",
    title: "Children",
    body: `Knorvex is intended for users who can lawfully consent to online services in their jurisdiction. If you believe a child has provided personal data without appropriate consent, contact us and we will take appropriate steps.`
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: `We may update this Privacy Policy as the product evolves. Material changes will be posted on this page with an updated "Last updated" date. Continued use after changes constitutes acceptance of the revised policy.`
  }
];

export const cookiePolicySections = [
  {
    id: "what-are-cookies",
    title: "What are cookies?",
    body: `Cookies are small text files stored on your device when you visit a website. They help websites remember your session, preferences, and certain usage information.\n\nKnorvex also uses similar technologies such as local storage for authentication tokens and UI preferences.`
  },
  {
    id: "essential-cookies",
    title: "Essential cookies",
    body: `These are required for Knorvex to function. They include session and authentication cookies that keep you signed in, protect your account, and maintain security during requests.\n\nWithout essential cookies, core features such as chat, quizzes, and account settings will not work properly.`
  },
  {
    id: "functional-cookies",
    title: "Functional cookies & storage",
    body: `We store preferences such as theme selection, sidebar state, and local client settings to improve your experience across visits.\n\nThese are not used for advertising and are limited to product functionality.`
  },
  {
    id: "analytics-cookies",
    title: "Analytics",
    body: `We may use privacy-conscious analytics to understand feature usage, diagnose errors, and improve performance. If enabled, analytics cookies collect aggregated usage data and do not include the contents of your uploaded study materials.\n\nYou can limit non-essential cookies through your browser settings.`
  },
  {
    id: "third-party-cookies",
    title: "Third-party cookies",
    body: `Payment flows handled by Stripe may set cookies required for fraud prevention and checkout security.\n\nEmbedded content or future integrations may set their own cookies under their respective policies.`
  },
  {
    id: "managing-cookies",
    title: "Managing cookies",
    body: `Most browsers let you block or delete cookies. Blocking essential cookies may prevent you from signing in or using Knorvex.\n\nTo manage cookies, review your browser's privacy settings or device controls. You can also clear site data for Knorvex in your browser.`
  },
  {
    id: "contact-cookies",
    title: "Questions",
    body: `If you have questions about our use of cookies, contact privacy@knorvex.local or visit the contact page.`
  }
];

export const termsOfServiceSections = [
  {
    id: "acceptance",
    title: "Acceptance of terms",
    body: `By accessing or using Knorvex, you agree to these Terms of Service and our Privacy Policy. If you are using Knorvex on behalf of an organization, you represent that you have authority to bind that organization.`
  },
  {
    id: "service",
    title: "The service",
    body: `Knorvex provides tools to upload study materials, configure professor agents, generate practice questions, track progress, and collaborate in study groups.\n\nFeatures may change during beta and early access. We may add, modify, or discontinue features with reasonable notice where practical.`
  },
  {
    id: "accounts",
    title: "Accounts",
    body: `You must provide accurate registration information and keep your credentials secure. You are responsible for activity under your account.\n\nNotify us promptly if you suspect unauthorized access.`
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: `You may not use Knorvex to violate academic integrity rules, infringe intellectual property, harass others, distribute malware, attempt unauthorized access, or upload content you do not have rights to use.\n\nWe may suspend or terminate accounts that violate these terms or pose risk to the platform or other users.`
  },
  {
    id: "content",
    title: "Your content",
    body: `You retain ownership of materials you upload. You grant Knorvex a limited license to host, process, and display your content solely to provide the service, including AI-assisted generation and progress features.\n\nYou are responsible for ensuring you have permission to upload and process your materials.`
  },
  {
    id: "billing",
    title: "Billing & subscriptions",
    body: `Paid plans are billed through Stripe according to the pricing shown at checkout. Subscriptions renew automatically unless cancelled before the renewal date.\n\nRefunds, if any, are handled according to the plan terms displayed at purchase and applicable law.`
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: `Knorvex is a study aid, not a substitute for official course materials, instructors, or exam boards. AI-generated content may contain errors. Always verify critical information against your syllabus and trusted sources.\n\nThe service is provided "as is" to the fullest extent permitted by law.`
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: `To the maximum extent permitted by law, Knorvex and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or academic outcomes arising from use of the service.`
  },
  {
    id: "termination",
    title: "Termination",
    body: `You may stop using Knorvex at any time. We may suspend or terminate access for violations, security risks, or discontinuation of the service.\n\nProvisions that by nature should survive termination will remain in effect.`
  },
  {
    id: "changes-terms",
    title: "Changes",
    body: `We may update these Terms from time to time. Updated terms will be posted on this page. Material changes may require additional notice. Continued use after updates constitutes acceptance.`
  }
];

/** @deprecated Use privacyPolicySections */
export const privacySections = [
  {
    title: "Uploaded materials",
    body: "Study files you upload remain private by default. They are used to generate practice, explanations, flashcards, and progress insights only for your account or explicitly authorized groups."
  },
  {
    title: "Account & billing data",
    body: "Profile, subscription status, usage limits, and study activity support authentication, Stripe billing, entitlements, and personalized learning flows."
  },
  {
    title: "Community content",
    body: "Group posts, shared resources, replies, and moderation actions are visible according to group permissions. Private groups are hidden from non-members."
  },
  {
    title: "AI & data use",
    body: "Generated content is validated against strict schemas. Source chunks are cited where possible. Prompt injection from uploaded files is actively considered in pipeline design."
  },
  {
    title: "Your controls",
    body: "You choose what to share. Deleting materials or leaving groups should remove your contributions according to the retention policy implemented at launch."
  },
  {
    title: "Legal status",
    body: "This page is a product-planning placeholder. Reviewed legal copy will replace it before public launch."
  }
];

export const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    detail: "Try focused practice with the notes you already have.",
    features: ["3 courses", "10 uploads / month", "20 quiz generations", "2 professor agents", "Community access"],
    limits: { courses: 3, uploads: 10, quizzes: 20, agents: 2 },
    highlighted: false,
    cta: "Try it free",
    href: "/sign-up"
  },
  {
    name: "Student Pro",
    price: "$12",
    period: "/month",
    yearlyPrice: "$96",
    yearlyPeriod: "/year",
    detail: "More practice, more flexibility, and a clearer view of what to study next.",
    features: [
      "Unlimited courses",
      "Unlimited uploads",
      "Unlimited quiz generations",
      "Unlimited professor agents",
      "Advanced timer & marking rules",
      "Stripe billing portal",
      "Priority generation"
    ],
    limits: { courses: "∞", uploads: "∞", quizzes: "∞", agents: 5 },
    highlighted: true,
    cta: "Upgrade to Pro",
    href: "/sign-in",
    planCode: "pro_monthly" as const
  },
  {
    name: "Enterprise",
    price: "$39",
    period: "/month",
    yearlyPrice: "$390",
    yearlyPeriod: "/year",
    detail: "For power users and institutions that need unlimited usage plus priority support.",
    features: [
      "Unlimited uploads",
      "Unlimited quiz generations",
      "Unlimited professor agents",
      "Priority support",
      "Advanced admin controls",
      "Dedicated support",
      "Institutional invoicing (later)"
    ],
    limits: { courses: "∞", uploads: "∞", quizzes: "∞", agents: "∞" },
    highlighted: false,
    cta: "Upgrade to Enterprise",
    href: "/sign-in",
    planCode: "enterprise_monthly" as const
  }
];

export const agentProfiles = [
  {
    title: "Dr. Valeria Chen MCQ Examiner",
    description: "Application-heavy biology questions with close distractors and short explanations after each attempt.",
    meta: "Biology 201 · Active",
    style: "Application-heavy, tricky distractors"
  },
  {
    title: "Pharmacology Oral Prep",
    description: "Rapid-fire prompts for mechanisms, contraindications, interactions, and concise clinical reasoning.",
    meta: "Nursing · Active",
    style: "Rapid-fire, clinical reasoning"
  },
  {
    title: "Cloud Certification Coach",
    description: "Scenario-driven prompts covering architecture tradeoffs, security boundaries, and managed services.",
    meta: "Certification · Active",
    style: "Scenario-driven, architecture focus"
  }
];

export const agentFields = [
  "Name & subject area",
  "Difficulty level",
  "Question style & formats",
  "Marking strictness",
  "Favorite topics & common traps",
  "Feedback tone",
  "Expected answer structure",
  "Rubric preferences"
];

export const quizConfigs = [
  "Course/material scope",
  "Professor agent selection",
  "Question count & types",
  "Difficulty & topic weighting",
  "Timer & per-question timer",
  "Randomize questions/options",
  "Hints, negative marking, pass mark",
  "Exam mode vs practice mode"
];

export const quizzes = [
  {
    title: "Midterm Mock: Cell Signaling",
    description: "40 mixed MCQs with a 50-minute timer and explanations unlocked after submission.",
    meta: "Due today · Exam mode"
  },
  {
    title: "Pharmacology Short Answers",
    description: "Theory prompts focused on mechanisms, side effects, and patient counseling language.",
    meta: "12 questions · Practice"
  },
  {
    title: "Cloud Security Review",
    description: "Scenario questions covering IAM, encryption, network access, and incident response basics.",
    meta: "Adaptive · 30 min timer"
  },
  {
    title: "Organic Chemistry Mechanisms",
    description: "Multi-step reaction pathways with drawing-style short answers and rubric marking.",
    meta: "Draft · 20 questions"
  }
];

export const flashcardDecks = [
  {
    title: "Cell Biology Definitions",
    description: "Concise recall cards for pathways, transport terms, organelle functions, and lab vocabulary.",
    meta: "86 cards · 12 due today"
  },
  {
    title: "Drug Classes",
    description: "Mechanisms, adverse effects, contraindications, and examples grouped for spaced review.",
    meta: "142 cards · 42 due"
  },
  {
    title: "Cloud Acronyms",
    description: "Exam-facing service names, security terminology, and architecture shorthand.",
    meta: "58 cards · 19 new"
  }
];

export const progressTopics = [
  {
    title: "Strong: Membrane transport",
    description: "Consistent accuracy across MCQs and flashcards. Keep warm with short mixed reviews.",
    meta: "91% mastery",
    tone: "success" as const
  },
  {
    title: "Watch: Signal transduction",
    description: "Good definitions, weaker application questions when pathways are combined.",
    meta: "68% mastery",
    tone: "warning" as const
  },
  {
    title: "Review: Drug interactions",
    description: "Misses cluster around contraindications and overlapping adverse effects.",
    meta: "49% mastery",
    tone: "danger" as const
  },
  {
    title: "Review: IAM & encryption",
    description: "Scenario questions on policy boundaries need more practice before the cert exam.",
    meta: "52% mastery",
    tone: "danger" as const
  }
];

