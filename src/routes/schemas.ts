import { z } from 'zod';

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || year < 1 || month === undefined || day === undefined) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];

  return maximumDay !== undefined && day >= 1 && day <= maximumDay;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'must use YYYY-MM-DD format')
  .refine(isCalendarDate, 'must be a valid calendar date');

export const searchQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(100),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.coerce.number().int().min(1).max(20),
  })
  .superRefine((value, context) => {
    if (value.checkOut <= value.checkIn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: 'must be after checkIn',
      });
    }
  });

export type SearchQuery = z.infer<typeof searchQuerySchema>;
