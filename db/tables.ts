/**
 * Affirmation Generator - create and organize positive affirmations.
 *
 * Design goals:
 * - Collections (e.g. "Morning", "Confidence", "Work").
 * - Affirmations belong to collections, with tags & language.
 */

import { defineTable, column, NOW } from "astro:db";

export const AffirmationCollections = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                             // "Morning Boost", "Self-confidence"
    description: column.text({ optional: true }),
    icon: column.text({ optional: true }),           // emoji/icon
    isDefault: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Affirmations = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    collectionId: column.text({
      references: () => AffirmationCollections.columns.id,
      optional: true,
    }),
    userId: column.text(),                           // owner (for personal custom ones)

    text: column.text(),                             // affirmation sentence
    category: column.text({ optional: true }),       // "confidence", "health", "gratitude"
    language: column.text({ optional: true }),       // "en", "ta", etc.
    tags: column.text({ optional: true }),           // JSON or comma-separated labels

    useTimeOfDay: column.text({ optional: true }),   // "morning", "evening", "any"
    isFavorite: column.boolean({ default: false }),
    isSystem: column.boolean({ default: false }),    // system-curated vs user-generated

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  AffirmationCollections,
  Affirmations,
} as const;
