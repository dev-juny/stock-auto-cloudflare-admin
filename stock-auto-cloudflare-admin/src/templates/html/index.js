import { head } from './head';
import { loginScreen } from './loginScreen';
import { loadingScreen } from './loadingScreen';
import { appScreen } from './appScreen';
import { modalHtml } from './modal';
import { foot } from './foot';
export const adminHtml = head + loginScreen + loadingScreen + appScreen + modalHtml + foot;
