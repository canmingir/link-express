export type KernelErrorCode =
  | "LAYER_NAME"
  | "LAYER_DUPLICATE"
  | "LAYER_INACTIVE"
  | "POINT_DEFINITION"
  | "POINT_NAMESPACE"
  | "POINT_DUPLICATE"
  | "POINT_UNKNOWN"
  | "POINT_EMPTY"
  | "POINT_VALIDATION"
  | "SELF_CONTRIBUTION"
  | "CONTRIBUTION_INVALID"
  | "KEY_CONFLICT"
  | "SINGLE_CONFLICT"
  | "WRONG_CARDINALITY"
  | "NOT_SEALED"
  | "SEALED"
  | "INVALID_PHASE"
  | "INSTANCE_EXISTS"
  | "NOT_OVERRIDABLE";

export class KernelError extends Error {
  constructor(
    readonly code: KernelErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "KernelError";
  }
}
