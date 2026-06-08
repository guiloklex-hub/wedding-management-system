import type { ZodError } from "zod";

export type ZodTranslator = (key: string, values?: Record<string, string | number | Date>) => string;

const ISSUE_CODE_TO_KEY: Record<string, string> = {
  invalid_type: "zod.required",
  invalid_format: "zod.invalidEmail",
  too_small: "zod.tooShort",
  too_big: "zod.tooLong",
  invalid_value: "zod.invalidEnum",
  custom: "zod.invalid",
  not_multiple_of: "zod.invalidNumber",
  invalid_union: "zod.invalid",
  invalid_key: "zod.invalid",
  invalid_element: "zod.invalid",
  unrecognized_keys: "zod.invalid",
};

export function zodErrorMessage(error: ZodError, t: ZodTranslator): string {
  const issue = error.issues[0];
  if (!issue) return t("zod.invalid");
  const i18nKey = (issue as { params?: { i18nKey?: string } }).params?.i18nKey;
  if (i18nKey) return t(i18nKey);
  if (issue.message && !/^(Required|Expected|Invalid|String|Number|Array|Too\s|Unrecognized)/i.test(issue.message)) {
    return issue.message;
  }
  return t(ISSUE_CODE_TO_KEY[issue.code] ?? "zod.invalid");
}
