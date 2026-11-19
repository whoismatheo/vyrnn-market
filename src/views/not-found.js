import { createStateMessage } from '../components/state-message.js';
import { t } from '../i18n/index.js';

export default {
  mount(container) {
    container.append(
      createStateMessage({
        title: t('notFound.title'),
        message: t('notFound.message'),
        action: { label: t('notFound.action'), href: '/' },
      }),
    );
  },
};
