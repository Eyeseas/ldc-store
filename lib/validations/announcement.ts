import { z } from "zod";

// datetime-local 输入格式（不含时区）。之所以用约束而不是直接 z.date()，
// 是因为 Server Actions 参数序列化对 Date 类型不稳定，使用 string 更可靠。
const dateTimeLocalSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    "无效的时间格式"
  );

export const announcementSchema = z
  .object({
    title: z.string().min(1, "标题不能为空").max(100, "标题最多100字符"),
    content: z.string().min(1, "内容不能为空").max(10000, "内容最多10000字符"),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    startAt: dateTimeLocalSchema.default(""),
    endAt: dateTimeLocalSchema.default(""),
  })
  .superRefine((data, ctx) => {
    // 关键：时间范围是可选的，但如果同时存在则必须满足 endAt >= startAt
    if (!data.startAt || !data.endAt) return;
    const start = new Date(data.startAt);
    const end = new Date(data.endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "结束时间不能早于开始时间",
      });
    }
  });

export const createAnnouncementSchema = announcementSchema;
export const updateAnnouncementSchema = announcementSchema;

export type AnnouncementInput = z.input<typeof announcementSchema>;
export type AnnouncementOutput = z.infer<typeof announcementSchema>;
export type CreateAnnouncementInput = z.input<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.input<typeof updateAnnouncementSchema>;

