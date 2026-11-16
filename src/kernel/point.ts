import type Joi from "joi";
import { KernelError } from "./errors";

export type Cardinality = "list" | "keyed" | "single";

export interface PointRef<T> {
  readonly id: string;
  readonly __item?: T;
}

export const point = <T>(id: string): PointRef<T> => ({ id });

export interface PointDefinition<T> {
  cardinality: Cardinality;
  schema: Joi.Schema;
  description?: string;
  key?: (item: T) => string;
  builtins?: T[];
  default?: T;
  validate?: (handle: PointHandle<T>) => void;
}

export interface Contribution<T> {
  layer: string;
  key?: string;
  item: T;
}

export interface PointHandle<T> {
  readonly id: string;
  items(): T[];
  get(key: string): T | undefined;
  has(key: string): boolean;
  value(): T;
  contributions(): Contribution<T>[];
}

export interface PointSummary {
  id: string;
  owner: string;
  cardinality: Cardinality;
  description?: string;
  contributions: { layer: string; key?: string }[];
}

export class ExtensionPoint<T> implements PointHandle<T> {
  private readonly entries: Contribution<T>[] = [];
  private sealed = false;
  private readonly fallback?: T;

  constructor(
    readonly id: string,
    readonly owner: string,
    private readonly definition: PointDefinition<T>,
  ) {
    const { cardinality } = definition;

    if (cardinality === "single" && definition.builtins?.length) {
      throw new KernelError(
        "POINT_DEFINITION",
        `${id}: a single extension point takes a default, not builtins`,
      );
    }

    if (cardinality !== "single" && definition.default !== undefined) {
      throw new KernelError(
        "POINT_DEFINITION",
        `${id}: only single extension points take a default`,
      );
    }

    if (cardinality === "keyed" && !definition.key) {
      throw new KernelError(
        "POINT_DEFINITION",
        `${id}: a keyed extension point needs a key function`,
      );
    }

    if (definition.default !== undefined) {
      this.fallback = this.check(owner, definition.default);
    }

    for (const item of definition.builtins ?? []) {
      this.add(owner, item);
    }
  }

  get cardinality(): Cardinality {
    return this.definition.cardinality;
  }

  add(layer: string, item: T): void {
    if (this.sealed) {
      throw new KernelError(
        "SEALED",
        `${this.id}: ${layer} cannot contribute after the app has been sealed`,
      );
    }

    const value = this.check(layer, item);

    if (this.cardinality === "single" && this.entries.length) {
      throw new KernelError(
        "SINGLE_CONFLICT",
        `${this.id} accepts one contribution; ${this.entries[0].layer} already provided it (attempted by ${layer})`,
      );
    }

    let key: string | undefined;

    if (this.cardinality === "keyed") {
      key = this.definition.key!(value);
      const existing = this.entries.find((entry) => entry.key === key);

      if (existing) {
        throw new KernelError(
          "KEY_CONFLICT",
          `${this.id}: key "${key}" is already contributed by ${existing.layer} (attempted by ${layer})`,
        );
      }
    }

    this.entries.push({ layer, key, item: value });
  }

  seal(): void {
    this.sealed = true;
  }

  verify(): void {
    if (
      this.cardinality === "single" &&
      !this.entries.length &&
      this.fallback === undefined
    ) {
      throw new KernelError(
        "POINT_EMPTY",
        `${this.id} needs exactly one contribution and has none`,
      );
    }

    try {
      this.definition.validate?.(this);
    } catch (error) {
      throw new KernelError(
        "POINT_VALIDATION",
        `${this.id}: ${(error as Error).message}`,
      );
    }
  }

  items(): T[] {
    this.ensureReadable("items", ["list", "keyed"]);
    return this.entries.map((entry) => entry.item);
  }

  get(key: string): T | undefined {
    this.ensureReadable("get", ["keyed"]);
    return this.entries.find((entry) => entry.key === key)?.item;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  value(): T {
    this.ensureReadable("value", ["single"]);
    const value = this.entries[0]?.item ?? this.fallback;

    if (value === undefined) {
      throw new KernelError("POINT_EMPTY", `${this.id} has no contribution`);
    }

    return value;
  }

  contributions(): Contribution<T>[] {
    this.ensureReadable("contributions", ["list", "keyed", "single"]);

    if (!this.entries.length && this.fallback !== undefined) {
      return [{ layer: this.owner, item: this.fallback }];
    }

    return this.entries.map((entry) => ({ ...entry }));
  }

  summary(): PointSummary {
    return {
      id: this.id,
      owner: this.owner,
      cardinality: this.cardinality,
      description: this.definition.description,
      contributions: this.entries.map(({ layer, key }) => ({ layer, key })),
    };
  }

  private ensureReadable(method: string, allowed: Cardinality[]): void {
    if (!this.sealed) {
      throw new KernelError(
        "NOT_SEALED",
        `${this.id} cannot be read before the app is sealed`,
      );
    }

    if (!allowed.includes(this.cardinality)) {
      throw new KernelError(
        "WRONG_CARDINALITY",
        `${this.id} is ${this.cardinality}; ${method}() is not available`,
      );
    }
  }

  private check(layer: string, item: T): T {
    const { error, value } = this.definition.schema.validate(item, {
      abortEarly: false,
    });

    if (error) {
      throw new KernelError(
        "CONTRIBUTION_INVALID",
        `${this.id}: contribution from ${layer} is invalid: ${error.message}`,
      );
    }

    return value as T;
  }
}
