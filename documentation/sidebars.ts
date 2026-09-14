import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  guidesSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'guides/getting-started',
      },
      items: [
        'guides/getting-started',
        'guides/materials-and-courses',
        'guides/professor-agents',
        'guides/chat-and-generation',
        'guides/chat-projects',
        'guides/quizzes',
        'guides/flashcards',
        'guides/progress',
        'guides/community',
        'guides/billing',
        'guides/account-and-privacy',
      ],
    },
  ],
  developersSidebar: [
    {
      type: 'category',
      label: 'Developers',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'developers/architecture',
      },
      items: [
        'developers/architecture',
        'developers/api-overview',
        'developers/chat-visualizations',
        'developers/chat-projects',
        'developers/media-storage',
        'developers/headroom',
        'developers/deployment',
        'developers/docs-workflow',
      ],
    },
  ],
};

export default sidebars;
