const { z } = require('zod');
const Value = z.union([z.string().max(30000), z.number().finite(), z.boolean(), z.null()]);
const ProviderId = z.enum(['glm', 'kimi', 'doubao', 'deepseek', 'qwen']);
const Column = z.object({ title: z.string().max(120), width: z.number().min(40).max(1200).default(160), readOnly: z.boolean().optional() }).strict();
const Sheet = z
    .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        columns: z.array(Column).min(1).max(100),
        data: z.array(z.array(Value).max(100)).max(1000),
        style: z.record(z.string().max(300)).default({}),
        readOnlyCells: z
            .array(z.string().regex(/^[A-Z]{1,2}[1-9]\d{0,3}$/))
            .max(100000)
            .default([]),
        mergeCells: z.record(z.tuple([z.number().int().positive(), z.number().int().positive()])).default({}),
    })
    .strict();
const Workbook = z
    .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        revision: z.number().int().nonnegative(),
        sheets: z.array(Sheet).min(1).max(20),
        activeSheetId: z.string().uuid(),
        updatedAt: z.string().optional(),
    })
    .strict()
    .superRefine((b, ctx) => {
        if (new Set(b.sheets.map((s) => s.id)).size !== b.sheets.length || !b.sheets.some((s) => s.id === b.activeSheetId))
            ctx.addIssue({ code: 'custom', message: '工作表标识不一致' });
        for (const s of b.sheets) if (s.data.some((r) => r.length > s.columns.length)) ctx.addIssue({ code: 'custom', message: '数据列数超过表头' });
    });
const Filter = z
    .object({
        column: z.number().int().min(0).max(99),
        op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'empty', 'notEmpty']),
        value: Value.optional(),
    })
    .strict()
    .refine((f) => ['empty', 'notEmpty'].includes(f.op) || f.value !== undefined, '筛选条件缺少比较值');
const Query = z
    .object({
        filters: z.array(Filter).max(12).default([]),
        groupBy: z.array(z.number().int().min(0).max(99)).max(3).default([]),
        aggregates: z
            .array(
                z
                    .object({
                        op: z.enum(['count', 'sum', 'average', 'min', 'max']),
                        column: z.number().int().min(0).max(99).optional(),
                        name: z.string().min(1).max(60),
                    })
                    .strict()
            )
            .min(1)
            .max(10),
        orderBy: z.object({ field: z.string().max(60), direction: z.enum(['asc', 'desc']) }).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
    })
    .strict();
const Action = z.discriminatedUnion('type', [
    z
        .object({
            type: z.literal('fillCells'),
            filters: z.array(Filter).max(12),
            columns: z.array(z.number().int().min(0).max(99)).min(1).max(100),
            value: Value,
        })
        .strict(),
    z.object({ type: z.literal('insertColumns'), titles: z.array(z.string().min(1).max(120)).min(1).max(10) }).strict(),
    z.object({ type: z.literal('appendRows'), rows: z.array(z.array(Value).max(100)).min(1).max(100) }).strict(),
    z
        .object({
            type: z.literal('setCells'),
            cells: z
                .array(z.object({ rowId: z.string(), column: z.number().int().min(0).max(99), value: Value }).strict())
                .min(1)
                .max(5000),
        })
        .strict(),
    z.object({ type: z.literal('sortRows'), column: z.number().int().min(0).max(99), direction: z.enum(['asc', 'desc']) }).strict(),
    z
        .object({
            type: z.literal('highlight'),
            filters: z.array(Filter).max(12),
            columns: z.array(z.number().int().min(0).max(99)).min(1).max(100),
            color: z.enum(['yellow', 'green', 'blue', 'red']),
        })
        .strict(),
]);
const Result = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('fill'),
            rows: z.array(z.object({ rowId: z.string(), values: z.array(Value).min(1).max(10), reason: z.string().max(1000).optional() }).strict()).max(1000),
        })
        .strict(),
    z
        .object({
            kind: z.literal('clean'),
            suggestions: z
                .array(z.object({ rowId: z.string(), column: z.number().int().min(0).max(99), value: Value, reason: z.string().min(1).max(1000) }).strict())
                .max(5000),
        })
        .strict(),
    z
        .object({ kind: z.literal('table'), columns: z.array(z.string().min(1).max(120)).min(1).max(100), rows: z.array(z.array(Value).max(100)).max(1000) })
        .strict(),
    z.object({ kind: z.literal('answer'), answer: z.string().min(1).max(30000), citations: z.array(z.string()).max(1000).default([]) }).strict(),
    z.object({ kind: z.literal('query'), query: Query }).strict(),
    z.object({ kind: z.literal('summary') }).strict(),
    z.object({ kind: z.literal('formula'), formula: z.string().max(4000).optional(), explanation: z.string().min(1).max(6000) }).strict(),
    z.object({ kind: z.literal('operations'), actions: z.array(Action).min(1).max(10), explanation: z.string().max(3000) }).strict(),
    z.object({ kind: z.literal('clarify'), question: z.string().min(1).max(2000) }).strict(),
]);
const JobRequest = z
    .object({
        kind: z.enum(['fill', 'table', 'clean', 'ask', 'formula', 'operate']),
        cleanMode: z.enum(['normalize', 'split', 'missing', 'duplicates']).default('normalize'),
        providerId: ProviderId,
        model: z.string().min(1).max(180),
        workbookId: z.string().uuid(),
        sheetId: z.string().uuid(),
        revision: z.number().int().nonnegative(),
        range: z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]),
        instruction: z.string().min(1).max(12000),
        fields: z.array(z.string().min(1).max(120)).max(10).default([]),
        text: z.string().max(60000).default(''),
        targetColumn: z.number().int().min(0).max(99).optional(),
    })
    .strict();
const ProviderConfig = z
    .object({
        apiKey: z.string().trim().min(1).max(500).optional(),
        model: z.string().min(1).max(180),
        baseUrl: z.string().url().max(300),
        format: z.enum(['json_object', 'prompt']).default('json_object'),
    })
    .strict();
module.exports = { Value, Workbook, Sheet, Result, Query, Filter, Action, JobRequest, ProviderConfig, ProviderId };
