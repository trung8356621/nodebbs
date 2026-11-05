/**
 * Ad slot seed data (English technical display names).
 */

import { adSlots, ads } from '../../extensions/ads/schema.js';
import { eq } from 'drizzle-orm';
import { BaseSeeder } from './base.js';
import chalk from 'chalk';

/**
 * Default ad slots
 */
export const DEFAULT_AD_SLOTS = [
  {
    code: 'home_header_banner',
    name: 'Home header banner',
    description: 'Banner slot at the top of the home page',
    width: 970,
    height: 90,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'home_footer_banner',
    name: 'Home footer banner',
    description: 'Banner slot above the home page footer',
    width: 970,
    height: 90,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'home_sidebar_top',
    name: 'Home sidebar top',
    description: 'Ad slot at the top of the home sidebar',
    width: 300,
    height: 250,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'home_sidebar_bottom',
    name: 'Home sidebar bottom',
    description: 'Ad slot at the bottom of the home sidebar',
    width: 300,
    height: 250,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'topic_list_inline',
    name: 'Topic list inline',
    description: 'Inline ad slot inside the home topic list',
    width: 728,
    height: 90,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'topic_detail_top',
    name: 'Topic detail top',
    description: 'Ad slot at the top of the topic detail page',
    width: 728,
    height: 90,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'topic_detail_bottom',
    name: 'Topic detail bottom',
    description: 'Ad slot at the bottom of the topic detail page',
    width: 728,
    height: 90,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'topic_sidebar_top',
    name: 'Topic sidebar top',
    description: 'Ad slot at the top of the topic detail sidebar',
    width: 300,
    height: 250,
    maxAds: 1,
    isActive: true,
  },
  {
    code: 'topic_sidebar_bottom',
    name: 'Topic sidebar bottom',
    description: 'Ad slot at the bottom of the topic detail sidebar',
    width: 300,
    height: 250,
    maxAds: 1,
    isActive: true,
  },
];

export class AdsSeeder extends BaseSeeder {
  constructor() {
    super('ads');
  }

  /**
   * Initialize ad slots
   * @param {Object} db - Drizzle database instance
   * @param {boolean} reset - Whether to reset existing rows
   */
  async init(db, reset = false) {
    this.logger.header('Initialize ad slots');

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const skipped = [];

    for (const slot of DEFAULT_AD_SLOTS) {
      try {
        const [existing] = await db
          .select()
          .from(adSlots)
          .where(eq(adSlots.code, slot.code))
          .limit(1);

        if (existing) {
          if (reset) {
            await db.update(adSlots).set(slot).where(eq(adSlots.code, slot.code));
            updatedCount++;
            this.logger.success(`Reset: ${slot.name} (${slot.code})`);
          } else {
            skippedCount++;
            skipped.push(`${slot.name} (${slot.code})`);
          }
        } else {
          await db.insert(adSlots).values(slot);
          addedCount++;
          this.logger.success(`Added: ${slot.name} (${slot.code})`);
        }
      } catch (error) {
        this.logger.error(`Failed: ${slot.name}`, error);
      }
    }

    if (skipped.length > 0) {
      this.logger.info(`Skipped: ${skipped.join(', ')} (already exists)`);
    }

    this.logger.summary({
      total: DEFAULT_AD_SLOTS.length,
      addedCount,
      updatedCount,
      skippedCount,
    });
    return {
      total: DEFAULT_AD_SLOTS.length,
      addedCount,
      updatedCount,
      skippedCount,
    };
  }

  async list() {
    this.logger.header('Default ad slots');
    DEFAULT_AD_SLOTS.forEach((slot) => {
      this.logger.item(`${chalk.bold(slot.name)} (${slot.code})`, '📢');
      this.logger.detail(slot.description);
    });
    this.logger.divider();
    this.logger.result(`Total: ${DEFAULT_AD_SLOTS.length} slots`);
  }

  async clean(db) {
    this.logger.warn('Clearing ad data...');
    await db.delete(ads);
    this.logger.success('Cleared ads');
    for (const slot of DEFAULT_AD_SLOTS) {
      await db.delete(adSlots).where(eq(adSlots.code, slot.code));
      this.logger.success(`Deleted slot: ${slot.code}`);
    }
  }
}
