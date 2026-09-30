import type { z } from "zod";
import type { suggestTaskBodySchema } from "./ai-task.schema";

export type SuggestTaskInput = z.infer<typeof suggestTaskBodySchema>;
