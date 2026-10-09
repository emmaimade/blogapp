// DRAFT legal copy. Each section says what it must cover, not the final wording.
// Replace it with reviewed text (a generator such as Termly/iubenda, then a lawyer,
// especially for the Nigeria Data Protection Act 2023).

interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
}

export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How Inko collects, uses and protects your personal data.',
    intro: 'This policy explains what personal data Inko collects, why we collect it, and the choices you have.',
    sections: [
      { heading: 'Who we are', body: 'The legal entity operating Inko, its registered address, and how to reach whoever is responsible for data protection.' },
      { heading: 'Data we collect', body: 'Account details (name, email, password hash), workspace content you create, billing records from Paystack, contact form and support messages, and technical data such as IP address and session information.' },
      { heading: 'How we use it', body: 'Providing the service, billing, security and abuse prevention, transactional emails, and support. State the lawful basis for each use as required by the NDPA.' },
      { heading: 'Who we share it with', body: 'Processors such as Paystack (payments), the email delivery provider and hosting providers, and where data may be transferred outside Nigeria.' },
      { heading: 'Cookies', body: 'Inko uses a strictly necessary session cookie to keep you signed in. List any analytics or marketing cookies here if they are added later.' },
      { heading: 'Retention', body: 'How long each kind of data is kept, including the 30-day account deletion window.' },
      { heading: 'Your rights', body: 'Access, correction, deletion, objection and data portability, and how to exercise them, including the right to complain to the Nigeria Data Protection Commission.' },
      { heading: 'Security', body: 'The measures used to protect your data, at a high level.' },
      { heading: 'Changes to this policy', body: 'How you will be told about material changes.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'The terms that apply when you use Inko.',
    intro: 'These terms govern your use of Inko. By creating an account you agree to them.',
    sections: [
      { heading: 'Your account', body: 'Eligibility, keeping credentials secure, and responsibility for activity in your workspaces.' },
      { heading: 'Your content', body: 'You own what you publish. Inko only needs a licence to host and display it so the service can work.' },
      { heading: 'Acceptable use', body: 'Your use must follow the Acceptable Use Policy, which forms part of these terms.' },
      { heading: 'Plans, billing and renewal', body: 'Plans are billed in naira through Paystack and renew automatically until cancelled. Covers trials, upgrades, downgrades and taxes.' },
      { heading: 'Cancellation and refunds', body: 'How to cancel, what happens at the end of the paid period, and when refunds are or are not given.' },
      { heading: 'Suspension and termination', body: 'When Inko may suspend or close an account, and what happens to your data afterwards.' },
      { heading: 'Availability and changes', body: 'No guaranteed uptime unless agreed in writing. Features may change over time.' },
      { heading: 'Liability', body: 'Disclaimers and limits of liability.' },
      { heading: 'Governing law', body: 'Which law applies and where disputes are resolved.' },
      { heading: 'Changes to these terms', body: 'How you will be told about changes, and when they take effect.' },
    ],
  },
  acceptableUse: {
    title: 'Acceptable Use Policy',
    description: 'What you may and may not publish or do on Inko.',
    intro: 'Inko hosts blogs for many people. This policy sets out what is not allowed, so the platform stays safe for everyone.',
    sections: [
      { heading: 'Illegal content', body: 'Content that breaks applicable law, including content that exploits children, incites violence, or infringes intellectual property.' },
      { heading: 'Harmful content', body: 'Harassment, hate speech, threats, doxxing, and non-consensual intimate imagery.' },
      { heading: 'Spam and deception', body: 'Spam, phishing, malware, impersonation, and misleading or fraudulent content.' },
      { heading: 'Abuse of the service', body: 'Attempts to break security, access other workspaces, overload the service, or get around plan limits.' },
      { heading: 'Reporting', body: 'How readers and users can report content that breaks this policy.' },
      { heading: 'Enforcement', body: 'What Inko may do in response, from removing content to suspending accounts.' },
    ],
  },
} satisfies Record<string, LegalDocument>;
