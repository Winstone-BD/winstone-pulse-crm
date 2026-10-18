/**
 * @lovable.dev/mcp-js requires Zod 4 schemas at runtime (it converts them to
 * JSON Schema with zod/v4), but its declared types still come from Zod 3
 * classic. Author tool inputs with `zod/v4` and pass the shape through
 * `toolShape` — the only cast lives here. Handler args are annotated manually
 * because the bridge erases per-key inference.
 */
import type { ZodRawShape } from "zod";
import { z as z4 } from "zod/v4";

export const z = z4;

/** Map a zod/v4 raw shape onto the Zod-3 shape type mcp-js declares. */
export function toolShape<S extends z4.ZodRawShape>(shape: S): ZodRawShape {
  return shape as unknown as ZodRawShape;
}
