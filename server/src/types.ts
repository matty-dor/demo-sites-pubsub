import { z } from 'zod';

export const fieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'timestamp',
  'object',
  'array',
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const schemaNodeSchema: z.ZodType<SchemaNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    key: z.string().min(1),
    type: fieldTypeSchema,
    fields: z.array(schemaNodeSchema).optional(),
    item: schemaNodeSchema.optional(),
  }),
);

export type SchemaNode = {
  id: string;
  key: string;
  type: FieldType;
  fields?: SchemaNode[];
  item?: SchemaNode;
};

export const mockEventSchema = z
  .object({
    name: z.string().min(1),
    schema: z.array(schemaNodeSchema),
  })
  .superRefine((data, ctx) => {
    const hasCustomerId = data.schema.some(
      (n) =>
        n.key === 'customer_id' &&
        (n.type === 'string' || n.type === 'number'),
    )
    if (!hasCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Schema must include a root field named customer_id with type string or number',
        path: ['schema'],
      })
    }
  });

export type MockEventInput = z.infer<typeof mockEventSchema>;

export const mappingEntrySchema = z.object({
  value: z.string(),
  imageUrl: z.string(),
});

export const dynamicContentInputSchema = z.object({
  title: z.string().min(1).optional(),
  fieldPath: z.string(),
  defaultImageUrl: z.string().optional().nullable(),
  mappings: z.array(mappingEntrySchema),
});

export type DynamicContentInput = z.infer<typeof dynamicContentInputSchema>;
