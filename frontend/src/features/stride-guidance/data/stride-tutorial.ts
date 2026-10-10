import type { StrideTutorialContent } from "../types";

export const STRIDE_TUTORIAL: StrideTutorialContent[] = [
  {
    category: "SPOOFING",
    name: "Spoofing",
    letter: "S",
    definition:
      "Pretending to be someone or something else. An attacker gains access by impersonating a legitimate user, system, or service.",
    realWorldExample:
      "A hacker steals your session cookie and uses it to access your bank account as if they were you. The bank sees a valid session and grants access.",
    commonMistakes: [
      "Confusing spoofing with tampering - spoofing is about identity, not modification",
      "Forgetting service-to-service authentication can also be spoofed",
      "Assuming HTTPS alone prevents spoofing (it prevents eavesdropping, not impersonation)",
    ],
    quiz: {
      scenario:
        "An attacker intercepts a password reset email and uses the link to change another user's password, gaining access to their account.",
      correctAnswer: "SPOOFING",
      explanation:
        "This is Spoofing because the attacker is impersonating the legitimate user to gain unauthorized access. They're pretending to be someone they're not.",
    },
  },
  {
    category: "TAMPERING",
    name: "Tampering",
    letter: "T",
    definition:
      "Modifying data or code without authorization. An attacker changes data in transit, at rest, or alters application behavior.",
    realWorldExample:
      "An attacker modifies the price field in a shopping cart request from $100 to $1 before it reaches the server, getting products for almost nothing.",
    commonMistakes: [
      "Only thinking about database tampering - data in transit can also be modified",
      "Forgetting that configuration files and logs can be tampered with",
      "Not considering client-side tampering of JavaScript or local storage",
    ],
    quiz: {
      scenario:
        'A malicious user modifies their JWT token to change their role from "user" to "admin" and gains administrative privileges.',
      correctAnswer: "TAMPERING",
      explanation:
        "This is Tampering because the attacker is modifying data (the JWT token) to gain unauthorized capabilities. The token's integrity was compromised.",
    },
  },
  {
    category: "REPUDIATION",
    name: "Repudiation",
    letter: "R",
    definition:
      "Denying having performed an action. A user claims they didn't do something, and there's no way to prove otherwise.",
    realWorldExample:
      "An employee transfers company funds to their personal account, then deletes the audit logs. When questioned, they deny ever making the transfer.",
    commonMistakes: [
      "Thinking only about external attackers - insiders can also repudiate actions",
      "Assuming logging alone is sufficient - logs must be tamper-proof",
      "Forgetting about shared accounts that make attribution impossible",
    ],
    quiz: {
      scenario:
        "A user places an order on an e-commerce site, receives the goods, then claims they never placed the order to get a refund.",
      correctAnswer: "REPUDIATION",
      explanation:
        "This is Repudiation because the user is denying an action they performed. Without proper logging and verification, the system cannot prove they placed the order.",
    },
  },
  {
    category: "INFORMATION_DISCLOSURE",
    name: "Information Disclosure",
    letter: "I",
    definition:
      "Exposing information to unauthorized parties. Sensitive data is leaked through various channels, intentionally or accidentally.",
    realWorldExample:
      "A developer accidentally commits AWS credentials to a public GitHub repository. Attackers find them and use them to access the company's cloud resources.",
    commonMistakes: [
      "Only considering database breaches - error messages can leak info too",
      "Forgetting about metadata exposure (file names, timestamps, user IDs in URLs)",
      "Not thinking about side-channel attacks like timing differences",
    ],
    quiz: {
      scenario:
        'An API returns different error messages: "User not found" vs "Invalid password", allowing attackers to enumerate valid usernames.',
      correctAnswer: "INFORMATION_DISCLOSURE",
      explanation:
        "This is Information Disclosure because the system reveals whether a username exists. This information helps attackers target valid accounts.",
    },
  },
  {
    category: "DENIAL_OF_SERVICE",
    name: "Denial of Service",
    letter: "D",
    definition:
      "Making a system unavailable. Attackers prevent legitimate users from accessing the service by exhausting resources or exploiting vulnerabilities.",
    realWorldExample:
      "An attacker sends millions of requests to a website, overwhelming the servers and making the site unavailable for real customers.",
    commonMistakes: [
      "Only thinking about network-level attacks - application logic can cause DoS too",
      'Forgetting about "low and slow" attacks that evade rate limiting',
      "Not considering that a single expensive query can be a DoS vector",
    ],
    quiz: {
      scenario:
        "An attacker discovers an API endpoint that triggers an expensive database query and calls it repeatedly, causing the database to become unresponsive.",
      correctAnswer: "DENIAL_OF_SERVICE",
      explanation:
        "This is Denial of Service because the attacker is making the system unavailable by exhausting database resources. Legitimate users can no longer access the service.",
    },
  },
  {
    category: "ELEVATION_OF_PRIVILEGE",
    name: "Elevation of Privilege",
    letter: "E",
    definition:
      "Gaining capabilities beyond what was authorized. An attacker escalates from a low-privilege account to a higher-privilege one.",
    realWorldExample:
      "A regular user discovers they can access the admin panel by simply changing the URL from /user/dashboard to /admin/dashboard - the server never checked permissions.",
    commonMistakes: [
      "Only checking authentication, not authorization",
      "Trusting client-side role checks without server validation",
      "Forgetting that privilege escalation can be horizontal (accessing other users' data)",
    ],
    quiz: {
      scenario:
        'A user modifies a request parameter from "user_id=123" to "user_id=456" and gains access to another user\'s private data.',
      correctAnswer: "ELEVATION_OF_PRIVILEGE",
      explanation:
        "This is Elevation of Privilege (specifically horizontal privilege escalation) because the user gained access to resources they weren't authorized to access.",
    },
  },
];
