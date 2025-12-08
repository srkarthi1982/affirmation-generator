import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  AffirmationCollections,
  Affirmations,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

const updateCollectionSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.icon !== undefined ||
      input.isDefault !== undefined,
    { message: "At least one field must be provided to update." }
  );

const updateAffirmationSchema = z
  .object({
    id: z.string(),
    text: z.string().min(1).optional(),
    collectionId: z.string().nullable().optional(),
    category: z.string().optional(),
    language: z.string().optional(),
    tags: z.string().optional(),
    useTimeOfDay: z.enum(["morning", "evening", "any"]).optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.text !== undefined ||
      input.collectionId !== undefined ||
      input.category !== undefined ||
      input.language !== undefined ||
      input.tags !== undefined ||
      input.useTimeOfDay !== undefined ||
      input.isFavorite !== undefined,
    { message: "At least one field must be provided to update." }
  );

export const server = {
  createCollection: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const collection = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        description: input.description,
        icon: input.icon,
        isDefault: input.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(AffirmationCollections).values(collection);

      return {
        success: true,
        data: { collection },
      };
    },
  }),

  updateCollection: defineAction({
    input: updateCollectionSchema,
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(AffirmationCollections)
        .where(
          and(
            eq(AffirmationCollections.id, input.id),
            eq(AffirmationCollections.userId, user.id)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Collection not found.",
        });
      }

      const updates = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        updatedAt: new Date(),
      };

      await db
        .update(AffirmationCollections)
        .set(updates)
        .where(
          and(
            eq(AffirmationCollections.id, input.id),
            eq(AffirmationCollections.userId, user.id)
          )
        );

      return {
        success: true,
        data: { collection: { ...existing, ...updates } },
      };
    },
  }),

  deleteCollection: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(AffirmationCollections)
        .where(
          and(
            eq(AffirmationCollections.id, input.id),
            eq(AffirmationCollections.userId, user.id)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Collection not found.",
        });
      }

      await db
        .delete(Affirmations)
        .where(
          and(
            eq(Affirmations.collectionId, input.id),
            eq(Affirmations.userId, user.id)
          )
        );

      await db
        .delete(AffirmationCollections)
        .where(
          and(
            eq(AffirmationCollections.id, input.id),
            eq(AffirmationCollections.userId, user.id)
          )
        );

      return {
        success: true,
      };
    },
  }),

  listCollections: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const collections = await db
        .select()
        .from(AffirmationCollections)
        .where(eq(AffirmationCollections.userId, user.id));

      return {
        success: true,
        data: {
          items: collections,
          total: collections.length,
        },
      };
    },
  }),

  createAffirmation: defineAction({
    input: z.object({
      text: z.string().min(1),
      collectionId: z.string().optional(),
      category: z.string().optional(),
      language: z.string().optional(),
      tags: z.string().optional(),
      useTimeOfDay: z.enum(["morning", "evening", "any"]).optional(),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.collectionId) {
        const [collection] = await db
          .select()
          .from(AffirmationCollections)
          .where(
            and(
              eq(AffirmationCollections.id, input.collectionId),
              eq(AffirmationCollections.userId, user.id)
            )
          );

        if (!collection) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Collection not found.",
          });
        }
      }

      const now = new Date();

      const affirmation = {
        id: crypto.randomUUID(),
        collectionId: input.collectionId ?? null,
        userId: user.id,
        text: input.text,
        category: input.category,
        language: input.language,
        tags: input.tags,
        useTimeOfDay: input.useTimeOfDay,
        isFavorite: input.isFavorite ?? false,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(Affirmations).values(affirmation);

      return {
        success: true,
        data: { affirmation },
      };
    },
  }),

  updateAffirmation: defineAction({
    input: updateAffirmationSchema,
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(Affirmations)
        .where(
          and(
            eq(Affirmations.id, input.id),
            eq(Affirmations.userId, user.id)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Affirmation not found.",
        });
      }

      if (input.collectionId) {
        const [collection] = await db
          .select()
          .from(AffirmationCollections)
          .where(
            and(
              eq(AffirmationCollections.id, input.collectionId),
              eq(AffirmationCollections.userId, user.id)
            )
          );

        if (!collection) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Collection not found.",
          });
        }
      }

      const updates = {
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.collectionId !== undefined
          ? { collectionId: input.collectionId }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.useTimeOfDay !== undefined
          ? { useTimeOfDay: input.useTimeOfDay }
          : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        updatedAt: new Date(),
      };

      await db
        .update(Affirmations)
        .set(updates)
        .where(
          and(
            eq(Affirmations.id, input.id),
            eq(Affirmations.userId, user.id)
          )
        );

      return {
        success: true,
        data: { affirmation: { ...existing, ...updates } },
      };
    },
  }),

  deleteAffirmation: defineAction({
    input: z.object({ id: z.string() }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(Affirmations)
        .where(
          and(
            eq(Affirmations.id, input.id),
            eq(Affirmations.userId, user.id)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Affirmation not found.",
        });
      }

      await db
        .delete(Affirmations)
        .where(
          and(
            eq(Affirmations.id, input.id),
            eq(Affirmations.userId, user.id)
          )
        );

      return {
        success: true,
      };
    },
  }),

  listAffirmations: defineAction({
    input: z
      .object({
        collectionId: z.string().optional(),
        favoritesOnly: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [eq(Affirmations.userId, user.id)];

      if (input?.collectionId) {
        filters.push(eq(Affirmations.collectionId, input.collectionId));
      }

      if (input?.favoritesOnly) {
        filters.push(eq(Affirmations.isFavorite, true));
      }

      const affirmations = await db
        .select()
        .from(Affirmations)
        .where(and(...filters));

      return {
        success: true,
        data: {
          items: affirmations,
          total: affirmations.length,
        },
      };
    },
  }),
};
