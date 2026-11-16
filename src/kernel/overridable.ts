import Joi from "joi";
import { KernelError } from "./errors";
import { point, type PointRef } from "./point";

type Fn = (...args: any[]) => any;

export type Functions = Record<string, Fn>;

export type Wrapper<F extends Fn> = (next: F) => F;

export type Extension<T extends Functions> = {
  [K in keyof T]?: Wrapper<T[K]>;
};

export interface Surface<T extends Functions = Functions> {
  readonly ref: PointRef<Extension<T>>;
  readonly schema: Joi.Schema;
  compose(extensions: Extension<T>[]): void;
  restore(): void;
}

const SURFACE = Symbol("overridable");

export function overridable<T extends Functions>(id: string, base: T): Readonly<T> {
  let current: T = { ...base };
  const names = Object.keys(base) as (keyof T & string)[];

  const surface: Surface<T> = {
    ref: point<Extension<T>>(id),
    schema: Joi.object(
      Object.fromEntries(names.map((name) => [name, Joi.func()])),
    ),
    compose(extensions) {
      const next: T = { ...base };

      for (const extension of extensions) {
        for (const name of names) {
          const wrap = extension[name];
          if (!wrap) continue;

          const wrapped = wrap(next[name]);

          if (typeof wrapped !== "function") {
            throw new KernelError(
              "CONTRIBUTION_INVALID",
              `${id}.${name}: an extension must return a function`,
            );
          }

          next[name] = wrapped;
        }
      }

      current = next;
    },
    restore() {
      current = { ...base };
    },
  };

  const functions = Object.fromEntries(
    names.map((name) => [name, (...args: unknown[]) => current[name](...args)]),
  );

  Object.defineProperty(functions, SURFACE, { value: surface });

  return Object.freeze(functions) as Readonly<T>;
}

export function surfaceOf<T extends Functions>(functions: T): Surface<T> {
  const surface = (functions as { [SURFACE]?: Surface<T> })[SURFACE];

  if (!surface) {
    throw new KernelError(
      "NOT_OVERRIDABLE",
      "only objects created with overridable() can be opened or extended",
    );
  }

  return surface;
}
