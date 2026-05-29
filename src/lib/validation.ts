import { z } from "zod";

export const money = z.coerce.number().min(0).max(1_000_000);
