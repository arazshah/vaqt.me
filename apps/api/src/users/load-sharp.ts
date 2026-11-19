import type sharpType from 'sharp';

// sharp ships prebuilt native binaries, and the Linux x64 ones need an
// x86-64-v2 CPU. On a VM exposing a baseline CPU (e.g. KVM's default
// "kvm64") merely importing it throws — and a top-level import used to take
// the whole API down at boot. It is loaded lazily instead: the API always
// starts, and only avatar uploads report the problem.
export type SharpFn = typeof sharpType;

let loading: Promise<SharpFn> | undefined;

export function loadSharp(): Promise<SharpFn> {
  loading ??= import('sharp').then(
    (mod) => (mod as unknown as { default: SharpFn }).default,
  );
  return loading;
}
