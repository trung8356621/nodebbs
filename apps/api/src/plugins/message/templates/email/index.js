/**
 * Email template registry.
 */
import welcomeTemplate from './welcome.js';
import verificationCodeTemplate from './verification-code.js';

const templates = {
  welcome: welcomeTemplate,
  'verification-code': verificationCodeTemplate,
};

/**
 * @param {string} templateName
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function getEmailTemplate(templateName, data) {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Email template not found: ${templateName}`);
  }
  return template(data);
}

export function getAvailableTemplates() {
  return Object.keys(templates);
}

export default {
  getEmailTemplate,
  getAvailableTemplates,
};
