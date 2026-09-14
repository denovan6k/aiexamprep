import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Knorvex Docs',
  tagline: 'Turn the notes you have into practice that moves you forward.',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  url: 'https://docs.knorvex.com',
  baseUrl: '/',

  organizationName: 'knorvex',
  projectName: 'knorvex',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Knorvex',
      logo: {
        alt: 'Knorvex',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guidesSidebar',
          position: 'left',
          label: 'Guides',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developersSidebar',
          position: 'left',
          label: 'Developers',
        },
        {
          href: 'https://knorvex.com/pricing',
          label: 'Pricing',
          position: 'right',
        },
        {
          href: 'https://knorvex.com/sign-in',
          label: 'Sign in',
          position: 'right',
          className: 'navbar-cta',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
            {
              label: 'Getting started',
              to: '/docs/guides/getting-started',
            },
            {
              label: 'Architecture',
              to: '/docs/developers/architecture',
            },
          ],
        },
        {
          title: 'Product',
          items: [
            {
              label: 'Quizzes & mocks',
              to: '/docs/guides/quizzes',
            },
            {
              label: 'Professor Agents',
              to: '/docs/guides/professor-agents',
            },
            {
              label: 'Billing',
              to: '/docs/guides/billing',
            },
          ],
        },
        {
          title: 'Company',
          items: [
            {
              label: 'App',
              href: 'https://knorvex.com',
            },
            {
              label: 'Privacy',
              href: 'https://knorvex.com/privacy',
            },
            {
              label: 'Terms',
              href: 'https://knorvex.com/terms',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Knorvex. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'powershell', 'python', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
