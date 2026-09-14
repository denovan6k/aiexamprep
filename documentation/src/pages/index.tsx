import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const heroStudy =
    require('../../../client/public/images/marketing/hero-study.png').default;

  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Knorvex documentation</p>
          <Heading as="h1">Study with purpose. Build with context.</Heading>
          <p className={styles.heroSummary}>
            Clear product guides for students and practical references for the
            people building Knorvex.
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg button--knorvex"
              to="/docs/guides/getting-started">
              Explore guides
            </Link>
            <Link
              className="button button--secondary button--lg button--knorvex"
              to="/docs/developers/architecture">
              Developer docs
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <img
            src={heroStudy}
            alt="A student practising with Knorvex alongside course notes"
            width="819"
            height="546"
          />
          <div className={styles.heroNote}>
            <strong>Start with your material.</strong>
            <span>Move from notes to focused practice.</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="Knorvex product guides and developer documentation for material-first exam prep.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
