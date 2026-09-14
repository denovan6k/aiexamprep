import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import styles from './styles.module.css';

const guideLinks = [
  ['Get started', '/docs/guides/getting-started'],
  ['Materials and courses', '/docs/guides/materials-and-courses'],
  ['Professor Agents', '/docs/guides/professor-agents'],
  ['Quizzes and mock exams', '/docs/guides/quizzes'],
];

const developerLinks = [
  ['Architecture', '/docs/developers/architecture'],
  ['API overview', '/docs/developers/api-overview'],
  ['Media storage', '/docs/developers/media-storage'],
  ['Deployment', '/docs/developers/deployment'],
];

const popularDocs = [
  {
    title: 'Chat and generation',
    description: 'Turn a conversation into structured study artifacts.',
    to: '/docs/guides/chat-and-generation',
  },
  {
    title: 'Flashcards',
    description: 'Build focused recall from materials and quiz misses.',
    to: '/docs/guides/flashcards',
  },
  {
    title: 'Media storage',
    description: 'Configure local, Cloudinary, or S3 storage.',
    to: '/docs/developers/media-storage',
  },
  {
    title: 'Docs workflow',
    description: 'Keep documentation current as the product changes.',
    to: '/docs/developers/docs-workflow',
  },
];

export default function HomepageFeatures(): ReactNode {
  const notesQuiz =
    require('../../../../client/public/images/marketing/notes-quiz.png').default;

  return (
    <>
      <section className={styles.audiences}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <Heading as="h2">Choose the path that fits your work.</Heading>
            <p>
              Learn the product as a student, or get the technical context you
              need to contribute with confidence.
            </p>
          </div>

          <div className={styles.audienceGrid}>
            <article className={styles.guidePanel}>
              <div>
                <span className={styles.panelIndex}>For students</span>
                <Heading as="h3">Turn course material into better practice.</Heading>
                <p>
                  Set up a course, build professor-style practice, and use weak
                  topics to decide what comes next.
                </p>
              </div>
              <nav className={styles.linkList} aria-label="Student guides">
                {guideLinks.map(([label, to]) => (
                  <Link key={to} to={to}>
                    <span>{label}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </nav>
            </article>

            <article className={styles.developerPanel}>
              <div>
                <span className={styles.panelIndex}>For developers</span>
                <Heading as="h3">Understand the system before you change it.</Heading>
                <p>
                  Get from local setup to architecture, API boundaries, media,
                  and deployment.
                </p>
              </div>
              <nav className={styles.linkList} aria-label="Developer docs">
                {developerLinks.map(([label, to]) => (
                  <Link key={to} to={to}>
                    <span>{label}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </nav>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.workflow}>
        <div className={styles.workflowInner}>
          <div className={styles.workflowImage}>
            <img
              src={notesQuiz}
              alt="Course notes arranged around a quiz running in Knorvex"
              width="1024"
              height="683"
              loading="lazy"
            />
          </div>
          <div className={styles.workflowCopy}>
            <Heading as="h2">From the notes you have to the practice you need.</Heading>
            <p className={styles.workflowIntro}>
              Knorvex keeps the path simple and the source material visible.
            </p>
            <div className={styles.workflowSteps}>
              <div>
                <strong>Bring your materials</strong>
                <span>Organise notes, textbooks, slides, and past papers by course.</span>
              </div>
              <div>
                <strong>Shape the practice</strong>
                <span>Choose a Professor Agent, format, difficulty, and scope.</span>
              </div>
              <div>
                <strong>Review what matters</strong>
                <span>Use feedback and weak topics to plan the next session.</span>
              </div>
            </div>
            <Link className={styles.textLink} to="/docs/guides/getting-started">
              Follow the getting started guide
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.popular}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <Heading as="h2">Frequently opened</Heading>
            <p>Direct routes to the references people use while studying and shipping.</p>
          </div>
          <div className={styles.popularGrid}>
            {popularDocs.map((item) => (
              <Link key={item.to} to={item.to} className={styles.resourceLink}>
                <Heading as="h3">{item.title}</Heading>
                <p>{item.description}</p>
                <span aria-hidden="true">Open ↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <div>
            <Heading as="h2">Ready to put your notes to work?</Heading>
            <p>Open Knorvex and build your first focused practice session.</p>
          </div>
          <Link
            className="button button--primary button--lg button--knorvex"
            href="https://knorvex.com/sign-in">
            Open Knorvex
          </Link>
        </div>
      </section>
    </>
  );
}
